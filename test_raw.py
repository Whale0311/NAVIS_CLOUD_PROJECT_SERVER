import paho.mqtt.client as mqtt
import json
import base64

BROKER = "gnss.soict.io"
PORT = 1883
AUTH = {'username': "rw_user", 'password': "rw"}
TOPIC = "gnss/default_site/device_test1/raw/ublox/v1"

# Tạo data giả (Chữ "Hello Navis Raw Data!" mã hóa base64)
fake_base64_data = base64.b64encode(b"Hello Navis Raw Data!").decode('utf-8')
payload = {
    "schema": "gnss.raw.ublox.v1",
    "event_id": "test-raw-001",
    "seq": 1,
    "device_id": "device_test1", 
    "site_id": "default_site",
    "frontend": "ublox",
    "source": "rx1",
    "event_time": "2026-05-12T10:00:00Z",
    "ingest_time": "2026-05-12T10:00:00Z",
    "data": {
        "receiver": "rx1",
        "identity": "RXM-RAWX",
        "tow_s": 123456.0,
        "raw_len": 21,
        "raw_encoding": "base64",
        "raw_base64": fake_base64_data
    }
}

def on_connect(client, userdata, flags, reason_code, properties):
    if reason_code == 0:
        print("🔌 Đã kết nối tới Broker thành công!")
        print("🚀 Đang đưa gói tin vào đường ống mạng...")
        # Lệnh này chỉ xếp hàng gửi, chưa gửi ngay
        client.publish(TOPIC, json.dumps(payload), qos=1)
    else:
        print(f"❌ Lỗi kết nối: {reason_code}")

def on_publish(client, userdata, mid, reason_code, properties):
    # Hàm này chỉ chạy KHI VÀ CHỈ KHI máy chủ EMQX báo về là "Đã nhận!"
    print(f"✅ Máy chủ EMQX đã nhận gói tin thành công (mid={mid})!")
    print("👋 Đang ngắt kết nối an toàn...")
    client.disconnect()

# Khởi tạo client
client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
client.username_pw_set(AUTH['username'], AUTH['password'])

# Gắn 2 bộ cảm biến
client.on_connect = on_connect
client.on_publish = on_publish 

print("Đang quay số tới máy chủ...")
client.connect(BROKER, PORT, 60)

# Vòng lặp này sẽ giữ cho mạng luôn mở để gói tin bay đi
client.loop_forever()