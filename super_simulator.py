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
SITE_ID = "lab_hanoi" # Đổi lại theo đúng ví dụ trong MD
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

current_lat = 21.0055
current_lon = 105.8445
seq_counter = 123456 

while True:
    print("=========================================")
    print("🤖 BẢNG ĐIỀU KHIỂN THIẾT BỊ GIẢ LẬP (CHUẨN SCHEMA V1)")
    print("1. Bắn tọa độ Epoch (Test Map & Chart)")
    print("2. Bắn tín hiệu Health/Spoofing (Test Alarms)")
    print("3. Bắn phản hồi lệnh ACK (Test Device Control)")
    print("0. Thoát")
    print("=========================================")
    
    choice = input("👉 Chọn hành động (0-3): ")
    curr_time = time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime())

    if choice == '0':
        client.loop_stop()
        client.disconnect()
        print("👋 Đã tắt giả lập!")
        break

    elif choice == '1':
        current_lat += random.uniform(-0.0005, 0.0005)
        current_lon += random.uniform(-0.0005, 0.0005)
        
        # Bơm danh sách vệ tinh chuẩn Schema 4.4
        fake_signals = []
        for i in range(random.randint(8, 14)):
            fake_signals.append({
                "gnss": "GPS",
                "svid": i + 1,
                "signal": "L1C",
                "prn": f"G{i+1:02d}",
                "cno_dbhz": random.randint(35, 50),
                "used_in_fix": True,
                "receiver_ids": ["rx1", "rx2"]
            })
        
        # Payload chuẩn Schema 4.0 (gnss.detect.epoch.v1)
        payload = {
            "schema": "gnss.detect.epoch.v1",
            "event_id": f"{DEVICE_ID}-{seq_counter}",
            "seq": seq_counter,
            "device_id": DEVICE_ID,
            "site_id": SITE_ID,
            "frontend": "ublox",
            "source": "rx_pair",
            "event_time": curr_time,
            "ingest_time": curr_time,
            "data": {
                "time": { "tow_s": 123456.0, "gps_week": 2415 },
                "position": {
                    "lat_deg": current_lat,
                    "lon_deg": current_lon,
                    "height_m": 12.3,
                    "fix_type": "3d",
                    "pdop": random.uniform(1.0, 2.5)
                },
                "summary": {
                    "sat_count": len(fake_signals),
                    "avg_cno_dbhz": random.uniform(40.0, 48.0),
                    "spoofing": False,
                    "status": "normal"
                },
                "signals": fake_signals,
                "detectors": {}
            }
        }
        topic = f"gnss/{SITE_ID}/{DEVICE_ID}/detect/epoch/v1"
        client.publish(topic, json.dumps(payload), qos=1)
        print("🚀 Đã bắn tọa độ Epoch lồng nhau chuẩn xác!\n")

    elif choice == '2':
        # Gửi Health Data kích hoạt cả lỗi hệ thống lẫn giả mạo
        payload = {
            "schema": "gnss.health.v1",
            "event_id": f"{DEVICE_ID}-health-{seq_counter}",
            "seq": seq_counter,
            "device_id": DEVICE_ID,
            "site_id": SITE_ID,
            "frontend": "mixed",
            "source": "pipeline",
            "event_time": curr_time,
            "ingest_time": curr_time,
            "data": {
                "status": "degraded",
                "ingress_backlog": 0,
                "detect_backlog": 105, # > 100 để kích hoạt Alarm cảnh báo Backlog
                "raw_backlog": 5,
                "ingress_dropped": 0,
                "detect_dropped": 0,
                "raw_dropped": 0,
                "raw_emitted": 123450,
                "unknown_events": 0,
                "last_seq": seq_counter,
                "mqtt_raw_published": 100,
                "mqtt_raw_failed": 0,
                "mqtt_detect_published": 50,
                "mqtt_detect_failed": 0,
                "mqtt_position_published": 50,
                "mqtt_position_failed": 0,
                "mqtt_health_published": 10,
                "mqtt_health_failed": 0,
                "cpu_percent": 85.4,
                # Trường tùy chỉnh để chọc thủng hàm handle_health_data của Worker báo Spoofing
                "event_type": "spoofing_detected",
                "severity": "Critical",
                "message": "Phát hiện giả mạo tín hiệu GPS!"
            }
        }
        topic = f"gnss/{SITE_ID}/{DEVICE_ID}/health/v1" 
        client.publish(topic, json.dumps(payload), qos=1)
        print("🚨 Đã gửi Health Data kèm còi báo động Spoofing!\n")

    elif choice == '3':
        payload = {
            "schema": "gnss.cmd.ack.v1",
            "event_id": f"{DEVICE_ID}-cmd_ack-{seq_counter}",
            "seq": seq_counter,
            "device_id": DEVICE_ID,
            "site_id": SITE_ID,
            "frontend": "ublox",
            "source": "pipeline",
            "event_time": curr_time,
            "ingest_time": curr_time,
            "data": {
                "acknowledged": ["cmd_e1"]
            }
        }
        topic = f"gnss/{SITE_ID}/{DEVICE_ID}/cmd/ack/v1"
        client.publish(topic, json.dumps(payload), qos=1)
        print("✅ Đã bắn lệnh ACK!\n")

    seq_counter += 1