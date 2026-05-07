# MQTT Integration Setup Guide - Hướng dẫn Thiết lập MQTT

## 📋 Tổng Quan (Overview)

Backend Navis-Cloud hiện được cấu hình để nhận dữ liệu từ MQTT broker của GNSS Hub. Hệ thống bao gồm:

1. **Backend API (FastAPI)** - Nhận và lưu trữ dữ liệu
2. **MQTT Subscriber Worker** - Kết nối MQTT broker, parse dữ liệu
3. **Database** - Lưu trữ telemetry từ GNSS devices

---

## 🔧 Cấu Hình (Configuration)

### 1. Thêm Biến Môi Trường

Tạo file `.env` tại thư mục gốc project từ template:

```bash
cp .env.example .env
```

**MQTT Broker Credentials** (Từ người làm GNSS Hub):
```
MQTT_BROKER_HOST=your-mqtt-broker-ip
MQTT_BROKER_PORT=1883
MQTT_BROKER_USERNAME=ro_user
MQTT_BROKER_PASSWORD=ro
```

### 2. Cài Đặt Dependencies

```bash
cd backend
pip install -r requirements.txt
```

**Các package quan trọng:**
- `paho-mqtt==1.6.1` - MQTT client library
- `python-dotenv==1.0.0` - Quản lý environment variables
- `fastapi==0.104.1` - Web framework
- `sqlalchemy==2.0.23` - ORM for database

---

## 🚀 Chạy Server (Running the Server)

### Backend API Server

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Output mong đợi:**
```
✅ Đã tạo tài khoản Admin (admin1@navis.com / 123456)
🚀 Background Task: Auto-cleanup Telemetry đã khởi động!
Uvicorn running on http://0.0.0.0:8000
```

### MQTT Subscriber Worker

**Chạy trong terminal riêng:**

```bash
cd worker
python worker_main.py
```

**Output mong đợi:**
```
🚀 MQTT Subscriber đang khởi động...
   Broker: your-mqtt-broker-ip:1883

✅ Đã kết nối MQTT broker thành công!
   Host: your-mqtt-broker-ip:1883
   User: ro_user
   📡 Subscribed: gnss/+/+/raw/ublox/v1 (QoS 1)
   📡 Subscribed: gnss/+/+/detect/epoch/v1 (QoS 1)
   📡 Subscribed: gnss/+/+/state/position/v1 (QoS 1)
   📡 Subscribed: gnss/+/+/health/v1 (QoS 1)

📨 Message #1
   Topic: gnss/lab_hanoi/ducanh_user/detect/epoch/v1
   Device: ducanh_user
   Schema: gnss.detect.epoch.v1
   ✅ Đã lưu telemetry: 12 satellites, C/N0=45.3 dB-Hz
```

---

## 📡 MQTT Topics được Subscribe

Subscriber tự động lắng nghe các topics sau:

| Topic | Mục đích | QoS |
|-------|---------|-----|
| `gnss/+/+/raw/ublox/v1` | Raw u-blox frames | 1 |
| `gnss/+/+/detect/epoch/v1` | **Dữ liệu chính** - Detection results | 1 |
| `gnss/+/+/state/position/v1` | Vị trí hiện tại | 1 |
| `gnss/+/+/health/v1` | Health metrics & alarms | 1 |

**Format Topic:**
```
gnss/{site_id}/{device_id}/{type}/{version}
```

**Ví dụ:**
```
gnss/lab_hanoi/device_001/detect/epoch/v1
gnss/field_test_01/receiver_02/health/v1
```

---

## 📊 API Endpoints

### 1. Nhận Dữ Liệu Telemetry (Ingest)

```
POST /telemetry/ingest
Content-Type: application/json

{
  "device_id_str": "device_001",
  "avg_cno": 45.5,
  "sat_count": 12,
  "pdop": 2.5,
  "signals_data": [
    {"prn": "G01", "cno": 44.2, "ele": 75, "azi": 45},
    {"prn": "G02", "cno": 46.8, "ele": 60, "azi": 90}
  ]
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Đã lưu dữ liệu GNSS",
  "telemetry_id": 123,
  "device_id": "device_001"
}
```

### 2. Lấy Dữ Liệu Telemetry Gần Nhất

```
GET /telemetry/devices/{device_id_str}?limit=60
```

**Response:**
```json
[
  {
    "id": 123,
    "timestamp": "2026-04-22T03:29:36Z",
    "avg_cno": 45.5,
    "sat_count": 12,
    "pdop": 2.5,
    "signals_data": [...]
  }
]
```

### 3. Lấy Bản Ghi Mới Nhất

```
GET /telemetry/devices/{device_id_str}/latest
```

---

## ✅ Pre-deployment Checklist

Trước khi deploy lên production server:

- [ ] Cấu hình `.env` file với MQTT broker credentials thực tế
- [ ] Cấu hình DATABASE_URL trỏ đúng đến database server
- [ ] Tạo database và chạy migration (nếu có)
- [ ] Kiểm tra kết nối đến MQTT broker
  ```bash
  # Test MQTT connection
  python -c "
  import paho.mqtt.client as mqtt
  client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1)
  client.username_pw_set('ro_user', 'ro')
  client.connect('your-broker-ip', 1883, 60)
  print('✅ Kết nối MQTT thành công!')
  "
  ```
- [ ] Đăng ký ít nhất 1 device trước qua API
- [ ] Kiểm tra logs từ cả Backend API và Worker
- [ ] Kiểm tra dữ liệu được lưu vào database

---

## 🐳 Docker Deployment (Optional)

Nếu muốn deploy bằng Docker:

```bash
# Xây dựng images
docker-compose build

# Chạy containers
docker-compose up -d

# Kiểm tra logs
docker-compose logs -f backend
docker-compose logs -f worker
```

---

## 🛠️ Troubleshooting

### ❌ MQTT Connection Failed

**Error:** "Connection refused" hoặc "Connection refused port 1883"

**Giải pháp:**
1. Kiểm tra MQTT broker IP/port có đúng không
2. Kiểm tra username/password
3. Kiểm tra firewall cho phép port 1883
   ```bash
   # Test port accessibility
   telnet your-broker-ip 1883
   ```

### ❌ Device Not Found

**Error:** "Thiết bị 'device_001' không tồn tại"

**Giải pháp:**
- Trước tiên phải đăng ký device qua API hoặc admin panel
- Device phải được gán cho một user (owner)

### ❌ Database Connection Error

**Error:** "could not connect to server"

**Giải pháp:**
1. Kiểm tra `DATABASE_URL` trong `.env`
2. Kiểm tra database server chạy hay không
3. Kiểm tra username/password database

### ❌ Worker không nhận message

**Error:** "No messages received"

**Giải pháp:**
1. Kiểm tra MQTT Hub publish dữ liệu hay không
   ```bash
   # Subscribe từ MQTT client khác để test
   mosquitto_sub -h your-broker-ip -u ro_user -P ro -t "gnss/#"
   ```
2. Kiểm tra topics đúng format không
3. Kiểm tra logs worker chi tiết

---

## 📝 Example MQTT Payload

**Message được publish từ GNSS Hub:**

```json
{
  "schema": "gnss.detect.epoch.v1",
  "event_id": "device_001-000000123456",
  "seq": 123456,
  "device_id": "device_001",
  "site_id": "lab_hanoi",
  "frontend": "ublox",
  "source": "rx_pair",
  "event_time": "2026-04-22T03:29:36.000Z",
  "ingest_time": "2026-04-22T03:29:36.125Z",
  "data": {
    "avg_cno": 45.5,
    "sat_count": 12,
    "pdop": 2.5,
    "signals": [
      {"prn": "G01", "cno": 44.2, "ele": 75, "azi": 45},
      {"prn": "G02", "cno": 46.8, "ele": 60, "azi": 90},
      {"prn": "G03", "cno": 43.1, "ele": 45, "azi": 135}
    ]
  }
}
```

---

## 📚 Tài Liệu Thêm

- [MQTT Schema Details](backend/MQTT_data_schema.md) - Chi tiết về MQTT message format
- [Backend API Docs](http://localhost:8000/docs) - Swagger UI (sau khi chạy server)
- [Database Models](backend/app/models/schema.py) - ORM models

