"""
MQTT Subscriber Worker
Lắng nghe dữ liệu từ MQTT broker và lưu vào database theo khung giờ (1 Hour / 1 File)
"""
import requests
import sys
import os
import paho.mqtt.client as mqtt
from datetime import datetime, timedelta, timezone
import hashlib
import json
import base64
from concurrent.futures import ThreadPoolExecutor
# 1. Lấy đường dẫn của thư mục gốc (Navis-Cloud-Project)
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, ROOT_DIR)

from dotenv import load_dotenv
load_dotenv(os.path.join(ROOT_DIR, '.env'), override=True)

# 2. Lấy đường dẫn của thư mục backend và nhét vào path
BACKEND_DIR = os.path.join(ROOT_DIR, 'backend')
sys.path.insert(0, BACKEND_DIR)

from app.core.mqtt_config import MQTTConfig
from app.core.database import SessionLocal
from app.models.schema import Telemetry, Device, Alarm, RawDataLog
from worker.parsers import GNSSParser

class MQTTSubscriber:
    """MQTT Subscriber để nhận dữ liệu GNSS"""
    
    def __init__(self):
        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=MQTTConfig.CLIENT_ID)
        self.client.username_pw_set(MQTTConfig.BROKER_USERNAME, MQTTConfig.BROKER_PASSWORD)
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect
        self.client.on_subscribe = self.on_subscribe
        
        self.db = None
        self.parser = GNSSParser()
        self.message_count = 0
        self.sdr_buffer = {}
        self.executor = ThreadPoolExecutor(max_workers=4)
    def on_connect(self, client, userdata, flags, reason_code, properties):
        if reason_code == 0:
            print("✅ Đã kết nối MQTT broker thành công!")
            for topic, qos in MQTTConfig.SUBSCRIBE_TOPICS:
                client.subscribe(topic, qos=qos)
        else:
            print(f"❌ Lỗi kết nối MQTT: rc={reason_code}")
    
    def on_disconnect(self, client, userdata, disconnect_flags, reason_code, properties):
        if reason_code != 0:
            print(f"❌ Mất kết nối MQTT không mong muốn (rc={reason_code})")
        else:
            print("✅ Đã ngắt kết nối MQTT an toàn")
    
    def on_subscribe(self, client, userdata, mid, reason_codes, properties):
        pass
    
    def on_message(self, client, userdata, msg):
        self.message_count += 1
        topic = msg.topic
        payload = msg.payload.decode('utf-8')
        
        try:
            mqtt_message = self.parser.parse_mqtt_message(payload)
            if not mqtt_message: return
            
            schema_name = mqtt_message.schema
            if "detect.ublox" in schema_name:
                self.handle_detect_epoch(mqtt_message)
            elif "detect.sdr" in schema_name:
                self.handle_detect_sdr(mqtt_message)
            elif "raw.sdr" in schema_name:
                self.executor.submit(self.handle_raw_sdr, mqtt_message)
            elif "health" in schema_name:
                self.handle_health_data(mqtt_message)
            elif "position" in schema_name:
                self.handle_position_data(mqtt_message)
            elif "raw.ublox" in schema_name:
                self.executor.submit(self.handle_raw_ublox, mqtt_message)
            elif "cmd.init" in schema_name:
                self.handle_cmd_init(mqtt_message)
            elif "cmd.ack" in schema_name:
                self.handle_cmd_ack(mqtt_message)
                
        except Exception as e:
            print(f"   ❌ Lỗi xử lý message: {e}")
    
    def handle_detect_epoch(self, message):
        """Xử lý dữ liệu detect/epoch (Main telemetry data)"""
        try:
            db = SessionLocal()
            telemetry_data = self.parser.extract_telemetry_data(message)
            if not telemetry_data: return
            
            device = db.query(Device).filter(Device.device_id == message.device_id).first()
            if not device: return
                
            device.last_seen = datetime.now(timezone.utc)
            if telemetry_data.get("latitude") and telemetry_data.get("longitude"):
                device.latitude = telemetry_data["latitude"]
                device.longitude = telemetry_data["longitude"]
            
            telemetry = Telemetry(
                device_id=device.id,
                event_id=message.event_id,
                seq=message.seq,
                timestamp=telemetry_data["event_time"],
                latitude=telemetry_data.get("latitude"),
                longitude=telemetry_data.get("longitude"),
                height_m=telemetry_data.get("height_m"),
                avg_cno_dbhz=telemetry_data.get("avg_cno_dbhz"),
                sat_count=telemetry_data.get("sat_count", 0),
                pdop=telemetry_data.get("pdop"),
                is_spoofed=telemetry_data.get("spoofing"),
                status=telemetry_data.get("status"),
                signals_data=telemetry_data.get("signals_data", []),
                detectors_data=telemetry_data.get("detectors")
            )
            db.add(telemetry)
            db.commit()
            
            # Chuyển đổi event_time sang string trước khi JSON serialize
            if "event_time" in telemetry_data and hasattr(telemetry_data["event_time"], "isoformat"):
                telemetry_data["event_time"] = telemetry_data["event_time"].isoformat()

            try:
                requests.post(
                    f"http://localhost:8000/api/internal/broadcast/{message.device_id}",
                    json={"event_type": "telemetry_update", "schema": "gnss.detect.ublox.v1", "data": telemetry_data},
                    timeout=2
                )
            except Exception:
                pass
        except Exception as e:
            db.rollback()
        finally:
            db.close()
    
    def handle_health_data(self, message):
        """Xử lý Health Data và GẮN CỜ ALARM LÊN FILE RAW"""
        try:
            db = SessionLocal()
            health_data = self.parser.extract_health_data(message)
            raw_data = message.data if isinstance(message.data, dict) else {}
            event_type = raw_data.get("event_type") or (health_data and health_data.get("event_type"))
            
            device = db.query(Device).filter(Device.device_id == message.device_id).first()
            if not device: return

            # 🚨 SỬA LỖI OFFLINE ẢO: Cập nhật thời gian sống
            device.last_seen = datetime.now(timezone.utc)

            alarm_saved = False 
            webhook_payload = None

            # 1. BẮT CẢNH BÁO BẢO MẬT & ĐÁNH DẤU FILE
            if event_type == "spoofing_detected" or event_type == "alarm":
                msg_desc = raw_data.get("message", "Phát hiện giả mạo tín hiệu GPS!")
                severity = raw_data.get("severity", "Critical")
                
                # Tạo cảnh báo trên Web
                alarm = Alarm(device_id=device.id, severity=severity, event_desc=msg_desc, status="Active")
                db.add(alarm)
                alarm_saved = True
                webhook_payload = {"event_type": "alarm", "schema": "gnss.health.v1", "data": {"severity": severity, "message": msg_desc}}

                # ĐÁNH DẤU CỜ HAS_ALARM CHO FILE CỦA GIỜ HIỆN TẠI
                current_time = datetime.now(timezone.utc)
                start_of_hour = current_time.replace(minute=0, second=0, microsecond=0)
                
                db.query(RawDataLog).filter(
                    RawDataLog.device_id == device.id,
                    RawDataLog.start_time == start_of_hour
                ).update({"has_alarm": True})

            # 2. XỬ LÝ LỖI DROP/BACKLOG
            if health_data:
                total_dropped = (health_data.get("ingress_dropped", 0) + health_data.get("detect_dropped", 0) + health_data.get("raw_dropped", 0))
                if total_dropped > 0:
                    existing_drop_alarm = db.query(Alarm).filter(Alarm.device_id == device.id, Alarm.event_desc.like("Dropped % frames total"), Alarm.status == "Active").first()
                    new_desc = f"Dropped {total_dropped} frames total"
                    if not existing_drop_alarm:
                        alarm = Alarm(device_id=device.id, severity="Warning", event_desc=new_desc, status="Active")
                        db.add(alarm)
                        alarm_saved = True
                    else:
                        if existing_drop_alarm.event_desc != new_desc:
                            existing_drop_alarm.event_desc = new_desc
                            alarm_saved = True

                total_backlog = (health_data.get("ingress_backlog", 0) + health_data.get("detect_backlog", 0))
                existing_backlog_alarm = db.query(Alarm).filter(Alarm.device_id == device.id, Alarm.event_desc.like("High processing backlog%"), Alarm.status == "Active").first()
                if total_backlog > 100:
                    new_desc = f"High processing backlog: {total_backlog} messages"
                    if not existing_backlog_alarm:
                        alarm = Alarm(device_id=device.id, severity="Warning", event_desc=new_desc, status="Active")
                        db.add(alarm)
                        alarm_saved = True
                    else:
                        if existing_backlog_alarm.event_desc != new_desc:
                            existing_backlog_alarm.event_desc = new_desc
                            alarm_saved = True
                else:
                    if existing_backlog_alarm:
                        existing_backlog_alarm.status = "Resolved"
                        alarm_saved = True

            if alarm_saved:
                db.commit()
                if webhook_payload:
                    try:
                        requests.post(f"http://localhost:8000/api/internal/broadcast/{message.device_id}", json=webhook_payload, timeout=2)
                    except Exception: pass

        except Exception as e:
            db.rollback()
        finally:
            db.close()
    
    def handle_position_data(self, message):
        """Xử lý dữ liệu position"""
        try:
            db = SessionLocal()
            device = db.query(Device).filter(Device.device_id == message.device_id).first()
            if not device: return

            if "lat_deg" in message.data and "lon_deg" in message.data:
                device.latitude = message.data["lat_deg"]
                device.longitude = message.data["lon_deg"]
                device.last_seen = datetime.now(timezone.utc)
                db.commit()

                try:
                    requests.post(
                        f"http://localhost:8000/api/internal/broadcast/{message.device_id}",
                        json={"event_type": "position_update", "data": {"lat_deg": device.latitude, "lon_deg": device.longitude}},
                        timeout=2
                    )
                except Exception: pass
        except Exception:
            db.rollback()
        finally:
            db.close()
    
    def handle_raw_ublox(self, message):
        """LƯU FILE NỐI ĐUÔI THEO KHUNG 1 TIẾNG (APPEND UBX)"""
        try:
            db = SessionLocal()
            device = db.query(Device).filter(Device.device_id == message.device_id).first()
            if not device: return

            # 🚨 SỬA LỖI OFFLINE ẢO: Cập nhật thời gian sống khi mạch gửi file
            device.last_seen = datetime.now(timezone.utc)

            raw_b64 = message.data.get("raw_base64", "")
            if not raw_b64: return
            raw_bytes = base64.b64decode(raw_b64)
            
            # Tính toán khung giờ hiện tại
            current_time = datetime.now(timezone.utc)
            start_of_hour = current_time.replace(minute=0, second=0, microsecond=0)
            
            today_str = start_of_hour.strftime("%Y-%m-%d")
            storage_dir = os.path.join(BACKEND_DIR, "storage", "raw_logs", today_str)
            os.makedirs(storage_dir, exist_ok=True)

            # Tên file gom theo khung giờ: deviceId_YYYYMMDD_HH00.ubx
            hour_str = start_of_hour.strftime("%H00")
            filename = f"{message.device_id}_{today_str.replace('-','')}_{hour_str}.ubx"
            file_path = os.path.join(storage_dir, filename)

            # GHI NỐI ĐUÔI (Mode 'ab' thay vì 'wb')
            with open(file_path, "ab") as f:
                f.write(raw_bytes)

            # Kiểm tra xem Database đã có bản ghi cho file của giờ này chưa
            raw_log = db.query(RawDataLog).filter(
                RawDataLog.device_id == device.id,
                RawDataLog.file_type == "ubx",
                RawDataLog.start_time == start_of_hour
            ).first()

            if raw_log:
                # Cập nhật thời điểm kết thúc và kích thước file
                raw_log.end_time = current_time
                raw_log.file_size_bytes += len(raw_bytes)
            else:
                # Tạo bản ghi mới cho một khung giờ mới
                raw_log = RawDataLog(
                    device_id=device.id,
                    start_time=start_of_hour,
                    end_time=current_time,
                    file_type="ubx",
                    file_path=file_path,
                    file_size_bytes=len(raw_bytes),
                    has_alarm=False
                )
                db.add(raw_log)
            db.commit()

        except Exception as e:
            print(f"   ❌ Lỗi lưu file UBX theo giờ: {e}")
            db.rollback()
        finally:
            db.close()

    def handle_cmd_init(self, message):
        print(f"   🟢 Thiết bị {message.device_id} vừa báo cáo ONLINE (Init)")

    def handle_cmd_ack(self, message):
        try:
            requests.post(
                f"http://localhost:8000/api/internal/broadcast/{message.device_id}",
                json={"event_type": "command_ack", "data": message.data},
                timeout=2
            )
        except Exception: pass
    
    def handle_detect_sdr(self, message):
        """Xử lý kết quả AI nhận diện Jamming từ SDR và LƯU VÀO DATABASE"""
        try:
            db = SessionLocal()
            device = db.query(Device).filter(Device.device_id == message.device_id).first()
            if not device: return

            # 🚨 SỬA LỖI OFFLINE ẢO: Cập nhật thời gian sống
            device.last_seen = datetime.now(timezone.utc)
            
            raw_data = message.data if isinstance(message.data, dict) else {}
            sdr_class = raw_data.get('class', 'Unknown Anomaly')
            confidence = raw_data.get('confidence', 0)
            
            # 1. Tạo một Cảnh Báo (Alarm) ghi vào lịch sử sự kiện
            msg_desc = f"SDR AI Detect: Phát hiện '{sdr_class}' (Độ tin cậy: {confidence}%)"
            alarm = Alarm(
                device_id=device.id,
                severity="Critical" if "jamming" in sdr_class.lower() or "spoofing" in sdr_class.lower() else "Warning",
                event_desc=msg_desc,
                status="Active"
            )
            db.add(alarm)
            
            # 2. Lưu toàn bộ bức ảnh (Base64) và kết quả phân loại vào bảng Telemetry
            telemetry = Telemetry(
                device_id=device.id,
                timestamp=message.event_time,
                is_spoofed=True if "spoofing" in sdr_class.lower() else False,
                status=sdr_class,
                detectors_data=raw_data  # Lưu trọn vẹn JSON chứa chuỗi ảnh Base64
            )
            db.add(telemetry)
            
            db.commit()

            # 3. Bắn Webhook sang FastAPI để Web hiển thị Real-time
            requests.post(
                f"http://localhost:8000/api/internal/broadcast/{message.device_id}",
                json={"event_type": "sdr_detect", "schema": "gnss.detect.sdr.v1", "data": raw_data},
                timeout=2
            )
            
        except Exception as e:
            print(f"   ⚠️ Lỗi lưu SDR Detect: {e}")
            db.rollback()
        finally:
            db.close()

    def handle_raw_sdr(self, message):
        """GHÉP CHUNK SDR VÀ LƯU VÀO FILE .BIN THEO KHUNG 1 TIẾNG"""
        try:
            db = SessionLocal()
            data = message.data
            
            file_id = data.get("file_id")
            chunk_index = data.get("chunk_index")
            chunk_count = data.get("chunk_count")
            chunk_b64 = data.get("chunk_base64")
            file_sha256 = data.get("file_sha256")

            if not file_id or chunk_index is None or chunk_count is None or not chunk_b64:
                return

            if file_id not in self.sdr_buffer:
                self.sdr_buffer[file_id] = {
                    "chunks": {}, "count": chunk_count, "device_id": message.device_id,
                    "timestamp": message.event_time, "file_sha256": file_sha256
                }

            self.sdr_buffer[file_id]["chunks"][chunk_index] = chunk_b64
            current_chunks = len(self.sdr_buffer[file_id]["chunks"])

            if current_chunks == chunk_count:
                device = db.query(Device).filter(Device.device_id == message.device_id).first()
                if not device:
                    del self.sdr_buffer[file_id]
                    return
                device.last_seen = datetime.now(timezone.utc)
                assembled_bytes = bytearray()
                for i in range(chunk_count):
                    if i not in self.sdr_buffer[file_id]["chunks"]:
                        del self.sdr_buffer[file_id]
                        return
                    assembled_bytes.extend(base64.b64decode(self.sdr_buffer[file_id]["chunks"][i]))

                if file_sha256 and hashlib.sha256(assembled_bytes).hexdigest() != file_sha256:
                    del self.sdr_buffer[file_id]
                    return

                # Tính toán khung giờ hiện tại
                current_time = datetime.now(timezone.utc)
                start_of_hour = current_time.replace(minute=0, second=0, microsecond=0)
                
                today_str = start_of_hour.strftime("%Y-%m-%d")
                storage_dir = os.path.join(BACKEND_DIR, "storage", "raw_logs", today_str)
                os.makedirs(storage_dir, exist_ok=True)

                # Tên file gom theo khung giờ: deviceId_YYYYMMDD_HH00.bin
                hour_str = start_of_hour.strftime("%H00")
                filename = f"{message.device_id}_{today_str.replace('-','')}_{hour_str}.bin"
                file_path = os.path.join(storage_dir, filename)

                # GHI NỐI ĐUÔI
                with open(file_path, "ab") as f:
                    f.write(assembled_bytes)

                raw_log = db.query(RawDataLog).filter(
                    RawDataLog.device_id == device.id,
                    RawDataLog.file_type == "bin",
                    RawDataLog.start_time == start_of_hour
                ).first()

                if raw_log:
                    raw_log.end_time = current_time
                    raw_log.file_size_bytes += len(assembled_bytes)
                else:
                    raw_log = RawDataLog(
                        device_id=device.id,
                        start_time=start_of_hour,
                        end_time=current_time,
                        file_type="bin",
                        file_path=file_path,
                        file_size_bytes=len(assembled_bytes),
                        has_alarm=False
                    )
                    db.add(raw_log)
                db.commit()
                
                del self.sdr_buffer[file_id]

        except Exception as e:
            print(f"   ❌ Lỗi ghép SDR: {e}")
            db.rollback()
        finally:
            db.close()

    def start(self):
        print("\n🚀 MQTT Subscriber đang khởi động...")
        try:
            self.client.connect(MQTTConfig.BROKER_HOST, MQTTConfig.BROKER_PORT, keepalive=MQTTConfig.KEEP_ALIVE)
            self.client.loop_forever()
        except Exception as e:
            print(f"❌ Lỗi kết nối: {e}")
            return False
        return True
    
    def stop(self):
        print("\n🛑 Dừng MQTT Subscriber...")
        self.client.disconnect()
        self.client.loop_stop()

def main():
    subscriber = MQTTSubscriber()
    try:
        subscriber.start()
    except KeyboardInterrupt:
        subscriber.stop()

if __name__ == "__main__":
    main()