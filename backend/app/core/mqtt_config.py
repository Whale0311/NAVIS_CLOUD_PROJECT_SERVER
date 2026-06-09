import os
from dotenv import load_dotenv

load_dotenv()

class MQTTConfig:
    """Cấu hình MQTT Broker"""
    BROKER_HOST = os.getenv("MQTT_BROKER_HOST", "localhost")
    BROKER_PORT = int(os.getenv("MQTT_BROKER_PORT", "1883"))
    BROKER_USERNAME = os.getenv("MQTT_BROKER_USERNAME", "ro_user")
    BROKER_PASSWORD = os.getenv("MQTT_BROKER_PASSWORD", "ro")
    
    # MQTT Topics
    SUBSCRIBE_TOPICS = [
        ("gnss/+/+/raw/ublox/v1", 1),          # Raw u-blox frames
        ("gnss/+/+/detect/ublox/v1", 1),       # 🚨 SỬA TÊN: Detection results của Ublox
        ("gnss/+/+/state/position/v1", 1),     # Position state
        ("gnss/+/+/health/v1", 1),             # Health metrics
        ("gnss/+/+/cmd/init/v1", 1),           # Mạch báo cáo online
        ("gnss/+/+/cmd/ack/v1", 1),            # Mạch xác nhận lệnh
        
        ("gnss/+/+/raw/sdr/v1", 1),            # Raw SDR snapshot chunks (bladeRF)
        ("gnss/+/+/detect/sdr/v1", 1),         # AI Detect kết quả từ SDR (kèm ảnh phổ)
    ]
    
    CLIENT_ID = os.getenv("MQTT_CLIENT_ID", "navis-backend-subscriber")
    KEEP_ALIVE = 60  # seconds
