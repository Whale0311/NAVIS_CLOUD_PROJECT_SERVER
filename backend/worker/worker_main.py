"""
MQTT Subscriber Worker
Lắng nghe dữ liệu từ MQTT broker và lưu vào database
"""
import requests
import sys
import os
import paho.mqtt.client as mqtt
from datetime import datetime, timezone
import hashlib
import json
import base64
# 1. Lấy đường dẫn của thư mục gốc (Navis-Cloud-Project)
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, ROOT_DIR)

from dotenv import load_dotenv
load_dotenv(os.path.join(ROOT_DIR, '.env'), override=True)

# 2. Lấy đường dẫn của thư mục backend và nhét vào path
BACKEND_DIR = os.path.join(ROOT_DIR, 'backend')
sys.path.insert(0, BACKEND_DIR)

# Bây giờ thay vì 'from backend.app...', ta chỉ cần 'from app...'
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
        
    def on_connect(self, client, userdata, flags, reason_code, properties):
        """Callback khi kết nối với MQTT broker"""
        if reason_code == 0:
            print("✅ Đã kết nối MQTT broker thành công!")
            print(f"   Host: {MQTTConfig.BROKER_HOST}:{MQTTConfig.BROKER_PORT}")
            print(f"   User: {MQTTConfig.BROKER_USERNAME}")
            
            # Subscribe tất cả topics
            for topic, qos in MQTTConfig.SUBSCRIBE_TOPICS:
                client.subscribe(topic, qos=qos)
                print(f"   📡 Subscribed: {topic} (QoS {qos})")
        else:
            print(f"❌ Lỗi kết nối MQTT: rc={reason_code}")
            if reason_code == 4:
                print("   Lỗi: Username hoặc Password sai!")
            elif reason_code == 5:
                print("   Lỗi: Không được phép!")
    
    def on_disconnect(self, client, userdata, disconnect_flags, reason_code, properties):
        """Callback khi mất kết nối MQTT"""
        if reason_code != 0:
            print(f"❌ Mất kết nối MQTT không mong muốn (rc={reason_code})")
            print("   Đang cố gắng kết nối lại...")
        else:
            print("✅ Đã ngắt kết nối MQTT an toàn")
    
    def on_subscribe(self, client, userdata, mid, reason_codes, properties):
        """Callback khi subscribe topic thành công"""
        pass
    
    def on_message(self, client, userdata, msg):
        """Callback khi nhận message từ MQTT"""
        self.message_count += 1
        topic = msg.topic
        payload = msg.payload.decode('utf-8')
        
        print(f"\n📨 Message #{self.message_count}")
        print(f"   Topic: {topic}")
        
        try:
            # Parse MQTT message
            mqtt_message = self.parser.parse_mqtt_message(payload)
            if not mqtt_message:
                print(f"   ❌ Parse failed")
                return
            
            print(f"   Device: {mqtt_message.device_id}")
            print(f"   Schema: {mqtt_message.schema}")
            
            # Xử lý dữ liệu theo loại schema
            schema_name = mqtt_message.schema
            if "detect.ublox" in schema_name:     # 🚨 SỬA TỪ "detect.epoch" THÀNH "detect.ublox"
                self.handle_detect_epoch(mqtt_message)
            elif "detect.sdr" in schema_name:     # 🚨 THÊM MỚI: Bắt sự kiện AI phát hiện Jamming
                self.handle_detect_sdr(mqtt_message)
            elif "raw.sdr" in schema_name:        # 🚨 THÊM MỚI: Bắt Raw File .bin của SDR
                self.handle_raw_sdr(mqtt_message)
            elif "health" in schema_name:
                self.handle_health_data(mqtt_message)
            elif "position" in schema_name:
                self.handle_position_data(mqtt_message)
            elif "raw.ublox" in schema_name:
                self.handle_raw_ublox(mqtt_message)
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
            
            # Trích xuất dữ liệu telemetry từ parser
            telemetry_data = self.parser.extract_telemetry_data(message)
            if not telemetry_data:
                return
            
            # Tìm Device trong Database
            device = db.query(Device).filter(Device.device_id == message.device_id).first()
            if not device:
                print(f"   ⚠️ CẢNH BÁO: Nhận data từ thiết bị chưa đăng ký '{message.device_id}'. Từ chối lưu!")
                return  # Thoát luôn, vứt bỏ gói tin này
                
            # Cập nhật thông tin Last seen và Tọa độ... (Giữ nguyên đoạn dưới)
            
            # Cập nhật thông tin Last seen và Tọa độ (nếu có trong epoch)
            device.last_seen = datetime.now(timezone.utc)
            if telemetry_data.get("latitude") and telemetry_data.get("longitude"):
                device.latitude = telemetry_data["latitude"]
                device.longitude = telemetry_data["longitude"]
            
            # Tạo Telemetry record VỚI ĐẦY ĐỦ TRƯỜNG THEO SCHEMA MỚI
            telemetry = Telemetry(
                device_id=device.id,
                event_id=message.event_id,          # ID chống trùng lặp từ envelope
                seq=message.seq,                    # Sequence number
                timestamp=telemetry_data["event_time"],
                latitude=telemetry_data.get("latitude"),
                longitude=telemetry_data.get("longitude"),
                height_m=telemetry_data.get("height_m"),
                avg_cno_dbhz=telemetry_data.get("avg_cno_dbhz"), # Tên mới
                sat_count=telemetry_data.get("sat_count", 0),
                pdop=telemetry_data.get("pdop"),
                is_spoofed=telemetry_data.get("spoofing"),       # Cờ giả mạo
                status=telemetry_data.get("status"),             # spoofed, normal, pending...
                signals_data=telemetry_data.get("signals_data", []),
                detectors_data=telemetry_data.get("detectors")
            )
            
            db.add(telemetry)
            db.commit()
            
            print(f"   ✅ Đã lưu telemetry: {telemetry.sat_count} sats, "
                  f"C/N0={telemetry.avg_cno_dbhz} dB-Hz, Spoofed={telemetry.is_spoofed}")
            # ========================================================
            # ========================================================
            # THÊM ĐOẠN NÀY ĐỂ BÁO CHO FASTAPI BIẾT CÓ TỌA ĐỘ MỚI
            try:
                raw_data = message.data if isinstance(message.data, dict) else {}
                
                requests.post(
                    f"http://localhost:8000/api/internal/broadcast/{message.device_id}",
                    json={
                        "event_type": "telemetry_update",
                        "schema": "gnss.detect.epoch.v1",
                        "data": raw_data  # <--- ĐIỂM ĂN TIỀN Ở ĐÂY: Truyền thẳng nguyên cục gốc!
                    },
                    timeout=2
                )
            except Exception as req_err:
                print(f"   ⚠️ Không thể bắn Webhook Telemetry: {req_err}")
            # ========================================================
        except Exception as e:
            print(f"   ❌ Lỗi handle_detect_epoch: {e}")
            db.rollback()
        finally:
            db.close()
    
    def handle_health_data(self, message):
        """Xử lý dữ liệu health (Cảnh báo & trạng thái hệ thống)"""
        try:
            db = SessionLocal()
            health_data = self.parser.extract_health_data(message)
            
            raw_data = message.data if isinstance(message.data, dict) else {}
            event_type = raw_data.get("event_type") or (health_data and health_data.get("event_type"))
            
            device = db.query(Device).filter(Device.device_id == message.device_id).first()
            if not device:
                return

            alarm_saved = False 
            webhook_payload = None # Chứa nội dung để báo lên Web

            # 1. BẮT CẢNH BÁO BẢO MẬT TỪ MẠCH
            if event_type == "spoofing_detected" or event_type == "alarm":
                msg_desc = raw_data.get("message", "Phát hiện giả mạo tín hiệu GPS!")
                severity = raw_data.get("severity", "Critical")
                
                alarm = Alarm(device_id=device.id, severity=severity, event_desc=msg_desc, status="Active")
                db.add(alarm)
                alarm_saved = True
                webhook_payload = {"event_type": "alarm", "schema": "gnss.health.v1", "data": {"severity": severity, "message": msg_desc}}

            # 2. XỬ LÝ LỖI HỆ THỐNG (DROPPED / BACKLOG)
            if health_data:
                # --- DROPPED FRAMES ---
                total_dropped = (health_data.get("ingress_dropped", 0) + 
                                 health_data.get("detect_dropped", 0) + 
                                 health_data.get("raw_dropped", 0))
                                 
                if total_dropped > 0:
                    existing_drop_alarm = db.query(Alarm).filter(
                        Alarm.device_id == device.id, Alarm.event_desc.like("Dropped % frames total"), Alarm.status == "Active"
                    ).first()

                    new_desc = f"Dropped {total_dropped} frames total"
                    if not existing_drop_alarm:
                        alarm = Alarm(device_id=device.id, severity="Warning", event_desc=new_desc, status="Active")
                        db.add(alarm)
                        alarm_saved = True
                        webhook_payload = {"event_type": "alarm", "schema": "gnss.health.v1", "data": {"severity": "Warning", "message": new_desc}}
                    else:
                        if existing_drop_alarm.event_desc != new_desc:
                            existing_drop_alarm.event_desc = new_desc
                            alarm_saved = True
                            # Cố tình KHÔNG tạo webhook_payload ở đây để tránh Spam Frontend liên tục

                # --- BACKLOG ---
                total_backlog = (health_data.get("ingress_backlog", 0) + health_data.get("detect_backlog", 0))
                existing_backlog_alarm = db.query(Alarm).filter(
                    Alarm.device_id == device.id, Alarm.event_desc.like("High processing backlog%"), Alarm.status == "Active"
                ).first()
                                 
                if total_backlog > 100:
                    new_desc = f"High processing backlog: {total_backlog} messages"
                    if not existing_backlog_alarm:
                        alarm = Alarm(device_id=device.id, severity="Warning", event_desc=new_desc, status="Active")
                        db.add(alarm)
                        alarm_saved = True
                        webhook_payload = {"event_type": "alarm", "schema": "gnss.health.v1", "data": {"severity": "Warning", "message": new_desc}}
                    else:
                        if existing_backlog_alarm.event_desc != new_desc:
                            existing_backlog_alarm.event_desc = new_desc
                            alarm_saved = True
                else:
                    if existing_backlog_alarm:
                        existing_backlog_alarm.status = "Resolved"
                        alarm_saved = True
                        webhook_payload = {"event_type": "alarm", "schema": "gnss.health.v1", "data": {"severity": "Info", "message": "Nghẽn mạng dữ liệu đã được giải quyết."}}
            
            # 3. LƯU DATABASE VÀ CHỈ BẮN WEBHOOK KHI THỰC SỰ CẦN THIẾT
            if alarm_saved:
                db.commit()
                if webhook_payload:
                    try:
                        import requests
                        requests.post(
                            f"http://localhost:8000/api/internal/broadcast/{message.device_id}",
                            json=webhook_payload,
                            timeout=2
                        )
                    except Exception as req_err:
                        print(f"   ⚠️ Không thể bắn Webhook Alarm: {req_err}")

        except Exception as e:
            print(f"   ❌ Lỗi handle_health_data: {e}")
            db.rollback()
        finally:
            db.close()
    
    def handle_position_data(self, message):
        """Xử lý dữ liệu position và Bắn Webhook sang FastAPI"""
        try:
            db = SessionLocal()
            device = db.query(Device).filter(Device.device_id == message.device_id).first()
            if not device:
                print(f"   ⚠️ CẢNH BÁO: Bỏ qua tọa độ từ thiết bị lạ '{message.device_id}'.")
                return

            if "lat_deg" in message.data and "lon_deg" in message.data:
                device.latitude = message.data["lat_deg"]
                device.longitude = message.data["lon_deg"]
                device.last_seen = datetime.now(timezone.utc)
                db.commit()
                print(f"   ✅ Position updated: ({device.latitude}, {device.longitude})")

                # === THÊM MỚI: BẮN WEBHOOK SANG FASTAPI ===
                try:
                    requests.post(
                        f"http://localhost:8000/api/internal/broadcast/{message.device_id}",
                        json={
                            "event_type": "position_update",
                            "data": {
                                "lat_deg": device.latitude,
                                "lon_deg": device.longitude
                            }
                        },
                        timeout=2 # Timeout ngắn để Worker không bị treo nếu FastAPI sập
                    )
                except Exception as req_err:
                    print(f"   ⚠️ Không thể bắn Webhook tới FastAPI: {req_err}")
                # ==========================================

        except Exception as e:
            print(f"   ❌ Lỗi handle_position_data: {e}")
            db.rollback()
        finally:
            db.close()
    
    def handle_raw_ublox(self, message):
        """Giải mã Base64, lưu thành file vật lý và ghi metadata vào DB"""
        try:
            db = SessionLocal()
            device = db.query(Device).filter(Device.device_id == message.device_id).first()
            if not device:
                print(f"   ⚠️ Bỏ qua raw data từ thiết bị lạ: {message.device_id}")
                return

            # 1. Tạo thư mục lưu trữ theo ngày (Ví dụ: backend/storage/raw_logs/2026-05-12)
            today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            storage_dir = os.path.join(BACKEND_DIR, "storage", "raw_logs", today_str)
            os.makedirs(storage_dir, exist_ok=True)

            # 2. Decode base64
            raw_b64 = message.data.get("raw_base64", "")
            if not raw_b64:
                return
            raw_bytes = base64.b64decode(raw_b64)
            
            # 3. Tạo tên file duy nhất: deviceId_seq_timestamp.ubx
            timestamp_sec = int(datetime.now(timezone.utc).timestamp())
            filename = f"{message.device_id}_{message.seq}_{timestamp_sec}.ubx"
            file_path = os.path.join(storage_dir, filename)

            # 4. Ghi file ra ổ cứng
            with open(file_path, "wb") as f:
                f.write(raw_bytes)

            # 5. Lưu đường dẫn vào Database (Bảng RawDataLog)
            raw_log = RawDataLog(
                device_id=device.id,
                timestamp=message.event_time,
                seq=message.seq,
                data_type="ublox",
                file_path=file_path,  # Chỉ lưu đường dẫn
                file_size_bytes=len(raw_bytes)
            )
            db.add(raw_log)
            db.commit()

            print(f"   💾 Đã lưu file Raw: {filename} ({len(raw_bytes)} bytes)")

        except Exception as e:
            print(f"   ❌ Lỗi handle_raw_ublox: {e}")
            db.rollback()
        finally:
            db.close()

    def handle_cmd_init(self, message):
        """Xử lý khi mạch vừa bật lên và báo cáo sẵn sàng"""
        print(f"   🟢 Thiết bị {message.device_id} vừa báo cáo ONLINE (Init)")
        # Tương lai: Update trạng thái is_active = True trong DB tại đây

    def handle_cmd_ack(self, message):
        """Xử lý khi mạch xác nhận lệnh và báo cho Web tắt Loading"""
        print(f"   ✅ Thiết bị {message.device_id} đã xác nhận lệnh (ACK)")
        
        # === THÊM MỚI: BẮN WEBHOOK BÁO ACK SANG FASTAPI ===
        try:
            requests.post(
                f"http://localhost:8000/api/internal/broadcast/{message.device_id}",
                json={
                    "event_type": "command_ack",
                    "data": message.data  # Có thể chứa thông tin thành công hay thất bại từ mạch
                },
                timeout=2
            )
        except Exception as req_err:
            print(f"   ⚠️ Không thể bắn Webhook ACK: {req_err}")
    
    def start(self):
        """Kết nối và chạy subscriber"""
        print("\n🚀 MQTT Subscriber đang khởi động...")
        print(f"   Broker: {MQTTConfig.BROKER_HOST}:{MQTTConfig.BROKER_PORT}")
        print()
        
        try:
            self.client.connect(
                MQTTConfig.BROKER_HOST,
                MQTTConfig.BROKER_PORT,
                keepalive=MQTTConfig.KEEP_ALIVE
            )
            
            # Chạy loop để lắng nghe messages
            self.client.loop_forever()
            
        except Exception as e:
            print(f"❌ Lỗi kết nối: {e}")
            return False
        
        return True
    
    def stop(self):
        """Dừng subscriber"""
        print("\n🛑 Dừng MQTT Subscriber...")
        self.client.disconnect()
        self.client.loop_stop()
    def handle_detect_sdr(self, message):
        """Xử lý kết quả AI nhận diện Jamming từ thiết bị SDR"""
        try:
            print(f"  [SDR-AI] 🛑 Báo động: Đã phát hiện {message.data.get('class')} từ {message.device_id}!")
            # Bắn thẳng nguyên cục JSON có chứa ảnh Base64 sang FastAPI để Web hiển thị
            raw_data = message.data if isinstance(message.data, dict) else {}
            requests.post(
                f"http://localhost:8000/api/internal/broadcast/{message.device_id}",
                json={
                    "event_type": "sdr_detect",
                    "schema": "gnss.detect.sdr.v1",
                    "data": raw_data 
                },
                timeout=2
            )
        except Exception as e:
            print(f"  ⚠️ Lỗi xử lý SDR Detect: {e}")

    def handle_raw_sdr(self, message):
        """Hứng các chunk file .bin của SDR, ghép lại và lưu trữ"""
        try:
            db = SessionLocal()
            data = message.data
            
            file_id = data.get("file_id")
            chunk_index = data.get("chunk_index")
            chunk_count = data.get("chunk_count")
            chunk_b64 = data.get("chunk_base64")
            file_sha256 = data.get("file_sha256")

            # Bỏ qua nếu thiếu trường quan trọng
            if not file_id or chunk_index is None or chunk_count is None or not chunk_b64:
                return

            # 1. Khởi tạo "rổ đựng" cho file này nếu chưa có
            if file_id not in self.sdr_buffer:
                self.sdr_buffer[file_id] = {
                    "chunks": {},
                    "count": chunk_count,
                    "device_id": message.device_id,
                    "timestamp": message.event_time,
                    "seq": message.seq,
                    "file_sha256": file_sha256
                }

            # 2. Cất chunk vào rổ theo đúng số thứ tự (index)
            self.sdr_buffer[file_id]["chunks"][chunk_index] = chunk_b64
            current_chunks = len(self.sdr_buffer[file_id]["chunks"])

            print(f"  [SDR-RAW] 📦 Đang tải {file_id}: Chunk {chunk_index + 1}/{chunk_count} ({current_chunks}/{chunk_count})")

            # 3. KIỂM TRA ĐIỀU KIỆN: Đã nhận đủ tất cả các mảnh ghép chưa?
            if current_chunks == chunk_count:
                print(f"  [SDR-RAW] 🔄 Đã nhận đủ {chunk_count} chunk. Đang tiến hành giải mã và ghép file...")

                device = db.query(Device).filter(Device.device_id == message.device_id).first()
                if not device:
                    print(f"  ⚠️ CẢNH BÁO: Thiết bị {message.device_id} lạ. Từ chối lưu file forensic!")
                    del self.sdr_buffer[file_id]
                    return

                # 4. Lấy từng chunk theo thứ tự 0 -> chunk_count, decode base64 và dán lại với nhau
                assembled_bytes = bytearray()
                for i in range(chunk_count):
                    # Nếu vì lý do mạng rớt mất 1 chunk ở giữa, bắt lỗi ngay
                    if i not in self.sdr_buffer[file_id]["chunks"]:
                        print(f"  ❌ LỖI TRẦM TRỌNG: Thiếu chunk số {i}. Hủy file {file_id}!")
                        del self.sdr_buffer[file_id]
                        return
                    
                    assembled_bytes.extend(base64.b64decode(self.sdr_buffer[file_id]["chunks"][i]))

                # 5. Kiểm tra mã băm SHA-256 (Đảm bảo file không sai 1 bit nào so với mạch gửi)
                if file_sha256:
                    calculated_sha = hashlib.sha256(assembled_bytes).hexdigest()
                    if calculated_sha != file_sha256:
                        print(f"  ❌ CẢNH BÁO: File {file_id} bị sai lệch dữ liệu (SHA256 Mismatch). Đã hủy!")
                        del self.sdr_buffer[file_id]
                        return

                # 6. Tạo thư mục và Ghi ra ổ cứng (Cùng thư mục với file UBX)
                today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
                storage_dir = os.path.join(BACKEND_DIR, "storage", "raw_logs", today_str)
                os.makedirs(storage_dir, exist_ok=True)

                filename = f"{file_id}.bin"
                file_path = os.path.join(storage_dir, filename)

                with open(file_path, "wb") as f:
                    f.write(assembled_bytes)

                # 7. Lưu dấu vết vào Database
                raw_log = RawDataLog(
                    device_id=device.id,
                    timestamp=self.sdr_buffer[file_id]["timestamp"],
                    seq=self.sdr_buffer[file_id]["seq"],
                    data_type="sdr_bin",  # Phân loại đây là SDR (Thay vì ublox)
                    file_path=file_path,
                    file_size_bytes=len(assembled_bytes)
                )
                db.add(raw_log)
                db.commit()

                print(f"  ✅ [SDR-RAW] Đã lưu thành công file Forensic: {filename} ({len(assembled_bytes)} bytes)")

                # 8. XÓA BỘ NHỚ ĐỆM (Rất quan trọng để Server không bị sập RAM)
                del self.sdr_buffer[file_id]

        except Exception as e:
            print(f"  ❌ Lỗi trong quá trình ghép chunk SDR: {e}")
            db.rollback()
        finally:
            db.close()


def main():
    """Entry point của worker"""
    subscriber = MQTTSubscriber()
    try:
        subscriber.start()
    except KeyboardInterrupt:
        print("\n\n⏹️ dừng worker...")
        subscriber.stop()


if __name__ == "__main__":
    main()