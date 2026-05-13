import paho.mqtt.client as mqtt
import json
import time
import base64
import random

# ================= CẤU HÌNH =================
BROKER = "gnss.soict.io"  
PORT = 1883
AUTH = {'username': "rw_user", 'password': "rw"} 
DEVICE_ID = "device_test1" 
SITE_ID = "default_site"
# ============================================

def on_connect(client, userdata, flags, reason_code, properties):
    if reason_code == 0:
        print("✅ Đã kết nối với máy chủ EMQX thành công!\n")
    else:
        print(f"❌ Lỗi kết nối: {reason_code}")

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
if AUTH['username']:
    client.username_pw_set(AUTH['username'], AUTH['password'])
client.on_connect = on_connect
client.connect(BROKER, PORT, 60)
client.loop_start() 

time.sleep(1)

# Tọa độ giả lập khu vực Bách Khoa
current_lat = 21.005
current_lon = 105.844

while True:
    print("=========================================")
    print("🤖 BẢNG ĐIỀU KHIỂN THIẾT BỊ GIẢ LẬP")
    print("1. Bắn tọa độ di chuyển (Test Map & Chart)")
    print("2. Bắn tín hiệu Spoofing (Test Alarms)")
    print("3. Bắn phản hồi lệnh ACK (Test Device Control)")
    print("4. Bắn file Raw .ubx (Test File Upload)")
    print("0. Thoát")
    print("=========================================")
    
    choice = input("👉 Chọn hành động (0-4): ")

    if choice == '0':
        client.loop_stop()
        client.disconnect()
        print("👋 Đã tắt giả lập!")
        break

    elif choice == '1':
        current_lat += random.uniform(-0.0005, 0.0005)
        current_lon += random.uniform(-0.0005, 0.0005)
        
        payload = {
            "schema": "gnss.detect.epoch.v1",
            "device_id": DEVICE_ID,
            "site_id": SITE_ID,
            "event_time": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            "data": {
                "lat": current_lat,
                "lon": current_lon,
                "avg_cno": random.randint(35, 48), 
                "sat_count": random.randint(8, 15) 
            }
        }
        # Đã chuẩn Topic: epoch
        topic = f"gnss/{SITE_ID}/{DEVICE_ID}/detect/epoch/v1"
        client.publish(topic, json.dumps(payload), qos=1)
        print("🚀 Đã bắn tọa độ & CNO! Hãy check trang Map và Charts.\n")

    elif choice == '2':
        payload = {
            "schema": "gnss.health.v1", 
            "device_id": DEVICE_ID,
            "event_time": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            "data": {
                "event_type": "spoofing_detected",
                "severity": "Critical",
                "message": "Phát hiện giả mạo GPS khu vực Bách Khoa!"
            }
        }
        # Đã SỬA Topic: health (khớp với SUBSCRIBE_TOPICS của Backend)
        topic = f"gnss/{SITE_ID}/{DEVICE_ID}/health/v1" 
        client.publish(topic, json.dumps(payload), qos=1)
        print("🚨 Đã hú còi Spoofing! Hãy check trang Alarms.\n")

    elif choice == '3':
        payload = {
            "schema": "gnss.cmd.ack.v1",
            "device_id": DEVICE_ID,
            "data": {
                "status": "success",
                "command_executed": "reboot"
            }
        }
        # Đã chuẩn Topic: ack
        topic = f"gnss/{SITE_ID}/{DEVICE_ID}/cmd/ack/v1"
        client.publish(topic, json.dumps(payload), qos=1)
        print("✅ Đã bắn lệnh ACK! Hãy bấm nút Reboot trên web và xem nó tắt loading.\n")

    elif choice == '4':
        fake_file = base64.b64encode(b"Dummy UBX Data from Simulator").decode('utf-8')
        payload = {
            "schema": "gnss.raw.ublox.v1",
            "device_id": DEVICE_ID,
            "site_id": SITE_ID,
            "event_time": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            "data": {
                "raw_len": 29,
                "raw_encoding": "base64",
                "raw_base64": fake_file
            }
        }
        # Đã chuẩn Topic: raw
        topic = f"gnss/{SITE_ID}/{DEVICE_ID}/raw/ublox/v1"
        client.publish(topic, json.dumps(payload), qos=1)
        print("💾 Đã tải lên file Raw! Hãy check trang Quản lý File.\n")
        
    else:
        print("⚠️ Lựa chọn không hợp lệ, vui lòng chọn lại.\n")