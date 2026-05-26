"""
MQTT Subscriber Worker
Lắng nghe dữ liệu từ MQTT broker và lưu vào database
"""
import requests
import sys
import os
import paho.mqtt.client as mqtt
from datetime import datetime, timezone
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
            # Xử lý dữ liệu theo loại schema
            schema_name = mqtt_message.schema
            if "detect.epoch" in schema_name:
                self.handle_detect_epoch(mqtt_message)
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
            
            # Lấy data gốc từ gói tin MQTT (vì parser có thể lọt lưới các trường tùy chỉnh)
            raw_data = message.data if isinstance(message.data, dict) else {}
            event_type = raw_data.get("event_type") or (health_data and health_data.get("event_type"))
            
            device = db.query(Device).filter(Device.device_id == message.device_id).first()
            if not device:
                return

            alarm_saved = False # Cờ đánh dấu có lưu DB hay không

            # 1. BẮT CẢNH BÁO BẢO MẬT (TỪ SIMULATOR HOẶC MẠCH GNSS)
            if event_type == "spoofing_detected" or event_type == "alarm":
                alarm = Alarm(
                    device_id=device.id,
                    severity=raw_data.get("severity", "Critical"),
                    event_desc=raw_data.get("message", "Phát hiện giả mạo tín hiệu GPS!"),
                    status="Active"
                )
                db.add(alarm)
                alarm_saved = True

            # 2. BẮT CẢNH BÁO LỖI HỆ THỐNG (DROP / BACKLOG)
            if health_data:
                total_dropped = (health_data.get("ingress_dropped", 0) + 
                                 health_data.get("detect_dropped", 0) + 
                                 health_data.get("raw_dropped", 0))
                                 
                if total_dropped > 0:
                    alarm = Alarm(
                        device_id=device.id,
                        severity="Warning",
                        event_desc=f"Dropped {total_dropped} frames total",
                        status="Active"
                    )
                    db.add(alarm)
                    alarm_saved = True
                
                total_backlog = (health_data.get("ingress_backlog", 0) + 
                                 health_data.get("detect_backlog", 0))
                                 
                if total_backlog > 100:
                    alarm = Alarm(
                        device_id=device.id,
                        severity="Warning",
                        event_desc=f"High processing backlog: {total_backlog} messages",
                        status="Active"
                    )
                    db.add(alarm)
                    alarm_saved = True
            
            # Khóa dữ liệu vào DB nếu có bất kỳ còi báo nào kêu
            if alarm_saved:
                db.commit()
                print(f"   🚨 Đã lưu cảnh báo vào Database!")
                
                # 3. BẮN WEBHOOK KÍCH HOẠT RADAR FRONTEND (Đã thụt lề vào trong if)
                # Ta dùng raw_data để đảm bảo không bị lỗi object thời gian (datetime)
                try:
                    requests.post(
                        f"http://localhost:8000/api/internal/broadcast/{message.device_id}",
                        json={
                            "event_type": "alarm",
                            "schema": "gnss.health.v1",
                            "data": {
                                "event_type": str(event_type),
                                "severity": str(raw_data.get("severity", "Critical")),
                                "message": str(raw_data.get("message", "Phát hiện sự cố bất thường!"))
                            }
                        },
                        timeout=2
                    )
                except Exception as req_err:
                    print(f"   ⚠️ Không thể bắn Webhook Alarm: {req_err}")

            else:
                print(f"   ✅ Health data checked (Hệ thống ổn định)")

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