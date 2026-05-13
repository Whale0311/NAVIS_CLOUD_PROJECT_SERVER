import paho.mqtt.client as mqtt

BROKER = "gnss.soict.io"
PORT = 1883
AUTH = {'username': "ro_user", 'password': "server@navis"}
TOPIC = "navis/test_acl"

def on_connect(client, userdata, flags, reason_code, properties):
    print("🔌 Đã kết nối!")
    # Vừa bật lên là đăng ký nghe luôn
    client.subscribe(TOPIC)
    print(f"📡 Đã subscribe vào: {TOPIC}")
    
    # 1 giây sau, tự bắn 1 tin nhắn vào chính topic đó
    print("🚀 Bắn thử tin nhắn kiểm tra quyền...")
    client.publish(TOPIC, "Hello, tôi có quyền Publish không?", qos=1)

def on_message(client, userdata, msg):
    # Nếu có quyền, nó sẽ phải in ra dòng này
    print(f"🎯 THÀNH CÔNG! ĐÃ NHẬN ĐƯỢC TIN NHẮN: {msg.payload.decode()}")

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
client.username_pw_set(AUTH['username'], AUTH['password'])
client.on_connect = on_connect
client.on_message = on_message

client.connect(BROKER, PORT, 60)
client.loop_forever()