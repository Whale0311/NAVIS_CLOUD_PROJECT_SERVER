"""
MQTT Subscriber Worker
Lắng nghe dữ liệu từ MQTT broker và lưu vào database
"""
import sys
import os
import paho.mqtt.client as mqtt
from datetime import datetime, timezone
import json

# 1. Lấy đường dẫn của thư mục gốc (Navis-Cloud-Project)
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, ROOT_DIR)

# 2. Lấy đường dẫn của thư mục backend và nhét vào path
BACKEND_DIR = os.path.join(ROOT_DIR, 'backend')
sys.path.insert(0, BACKEND_DIR)

# Bây giờ thay vì 'from backend.app...', ta chỉ cần 'from app...'
from app.core.mqtt_config import MQTTConfig
from app.core.database import SessionLocal
from app.models.schema import Telemetry, Device, Alarm

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
            if "detect.epoch" in mqtt_message.schema:
                self.handle_detect_epoch(mqtt_message)
            elif "health" in mqtt_message.schema:
                self.handle_health_data(mqtt_message)
            elif "position" in mqtt_message.schema:
                self.handle_position_data(mqtt_message)
            elif "ublox" in mqtt_message.schema:
                self.handle_raw_ublox(mqtt_message)
                
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
            if not health_data:
                return
            
            device = db.query(Device).filter(Device.device_id == message.device_id).first()
            if not device:
                return
            
            # Tính tổng số frame bị rớt
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
            
            # Tính tổng backlog
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
            
            db.commit()
            print(f"   ✅ Health data checked")
            
        except Exception as e:
            print(f"   ❌ Lỗi handle_health_data: {e}")
            db.rollback()
        finally:
            db.close()
    
    def handle_position_data(self, message):
        """Xử lý dữ liệu position (Dùng để update vị trí tức thời cho Web)"""
        try:
            db = SessionLocal()
            device = db.query(Device).filter(Device.device_id == message.device_id).first()
            if not device:
                print(f"   ⚠️ CẢNH BÁO: Bỏ qua tọa độ từ thiết bị lạ '{message.device_id}'.")
                return
            # Map đúng tên key: lat_deg và lon_deg
            if device and "lat_deg" in message.data and "lon_deg" in message.data:
                device.latitude = message.data["lat_deg"]
                device.longitude = message.data["lon_deg"]
                device.last_seen = datetime.now(timezone.utc)
                
                db.commit()
                print(f"   ✅ Position updated: ({device.latitude}, {device.longitude})")
            
        except Exception as e:
            print(f"   ❌ Lỗi handle_position_data: {e}")
            db.rollback()
        finally:
            db.close()
    
    def handle_raw_ublox(self, message):
        """Xử lý raw u-blox frame - có thể mở rộng để lưu raw data"""
        # Hiện tại chỉ log, có thể extend để lưu raw frames vào database nếu cần
        print(f"   📝 Raw u-blox frame received (seq={message.seq})")
    
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