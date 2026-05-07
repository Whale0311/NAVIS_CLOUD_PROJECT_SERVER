# Navis Cloud - Backend

API server được xây dựng với FastAPI, cung cấp các endpoint quản lý thiết bị IoT, xác thực người dùng, và xử lý dữ liệu telemetry GNSS/MQTT theo thời gian thực.

## 📋 Mục Đích

Backend của Navis Cloud cung cấp:
- **Quản lý Thiết bị**: CRUD operations cho các thiết bị IoT
- **Xác thực & Bảo mật**: JWT-based authentication, role-based access control
- **Telemetry Data**: Lưu trữ và truy vấn dữ liệu từ các cảm biến (GNSS, signal, v.v)
- **MQTT Integration**: Nhận dữ liệu từ devices thông qua MQTT broker
- **Database Management**: PostgreSQL với SQLAlchemy ORM
- **Real-time Processing**: Xử lý dữ liệu từ hardware simulator hoặc thiết bị thực

## ✨ Tính Năng

- ⚡ **FastAPI**: Framework hiện đại, tự động documentation (Swagger/OpenAPI)
- 🔐 **JWT Authentication**: Bảo mật endpoint bằng JSON Web Tokens
- 🗄️ **SQLAlchemy ORM**: Quản lý database một cách pythonic
- 📊 **Real-time Data**: Xử lý telemetry từ MQTT
- 📝 **Pydantic Schemas**: Validation dữ liệu tự động
- 🔄 **CORS Support**: Cho phép frontend kết nối an toàn
- ⏰ **Background Tasks**: Dọn dẹp dữ liệu cũ tự động

## 🛠️ Yêu Cầu

- **Python**: Phiên bản 3.10 trở lên
- **PostgreSQL**: Phiên bản 14 trở lên
- **MQTT Broker** (Optional): Mosquitto hoặc tương đương (cho development có thể dùng docker)

## 📦 Cài Đặt

### 1. Tạo Virtual Environment

```bash
# Windows
python -m venv venv
.\venv\Scripts\activate

# Linux/Mac
python3 -m venv venv
source venv/bin/activate
```

### 2. Cài đặt Dependencies

```bash
pip install -r requirements.txt
```

### 3. Cấu hình Environment Variables

Tạo file `.env` trong thư mục backend:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/navis_db
DATABASE_ECHO=False

# JWT Security
SECRET_KEY=your-super-secret-key-here-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# MQTT
MQTT_BROKER=localhost
MQTT_PORT=1883
MQTT_USERNAME=your_mqtt_user
MQTT_PASSWORD=your_mqtt_password
MQTT_TOPIC_PREFIX=navis/

# API
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=True
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Email (Optional)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SENDER_EMAIL=your-email@gmail.com
SENDER_PASSWORD=your-app-password
```

### 4. Khởi tạo Database

```bash
# Tạo database (nếu chưa có)
createdb navis_db

# Chạy migrations (nếu có)
# alembic upgrade head
```

## 🚀 Chạy Ứng Dụng

### Development Mode

```bash
python app/main.py
```

Hoặc sử dụng Uvicorn trực tiếp:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Ứng dụng sẽ chạy tại `http://localhost:8000`

**Swagger UI**: http://localhost:8000/docs
**ReDoc UI**: http://localhost:8000/redoc

### Production Mode

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

## 📁 Cấu Trúc Dự Án

```
backend/
├── app/
│   ├── main.py              # Entry point, cấu hình FastAPI
│   ├── schemas.py           # Pydantic models cho request/response
│   ├── api/                 # API routes
│   │   ├── __init__.py
│   │   ├── auth.py          # Endpoint đăng nhập, đăng ký, token refresh
│   │   ├── devices.py       # Endpoint CRUD thiết bị
│   │   └── telemetry.py     # Endpoint lấy dữ liệu telemetry
│   ├── core/                # Core configurations
│   │   ├── database.py      # SQLAlchemy engine & session setup
│   │   ├── mqtt_config.py   # MQTT broker configuration
│   │   └── security.py      # JWT, password hashing utilities
│   ├── models/
│   │   └── schema.py        # SQLAlchemy ORM models (User, Device, Telemetry)
│   └── services/            # Business logic layer (nếu cần)
├── requirements.txt         # Python dependencies
├── .env                     # Environment variables (NÊN .gitignore)
├── .env.example             # Template cho .env
└── README.md                # File này
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login` - Đăng nhập (email + password)
- `POST /api/auth/register` - Đăng ký tài khoản mới
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/forgot-password` - Yêu cầu reset mật khẩu

### Devices
- `GET /api/devices` - Lấy danh sách thiết bị (phân trang)
- `GET /api/devices/{device_id}` - Lấy thông tin chi tiết thiết bị
- `POST /api/devices` - Tạo thiết bị mới
- `PUT /api/devices/{device_id}` - Cập nhật thông tin thiết bị
- `DELETE /api/devices/{device_id}` - Xóa thiết bị
- `PATCH /api/devices/{device_id}/status` - Cập nhật trạng thái thiết bị

### Telemetry
- `GET /api/telemetry` - Lấy dữ liệu telemetry (có filter theo device, time range)
- `GET /api/telemetry/{device_id}` - Lấy telemetry của một thiết bị cụ thể
- `GET /api/telemetry/latest/{device_id}` - Lấy dữ liệu telemetry mới nhất
- `POST /api/telemetry` - Ghi dữ liệu telemetry (thường từ MQTT worker)

Xem chi tiết tại: [API Documentation](http://localhost:8000/docs)

## 🔒 Authentication & Security

### JWT Token Flow

1. User gửi `email` + `password` đến endpoint login
2. Server xác thực, tạo access token (30 phút) và refresh token (7 ngày)
3. Client lưu tokens và gửi access token trong header: `Authorization: Bearer <token>`
4. Khi access token hết hạn, dùng refresh token để lấy token mới

### Password Security

- Sử dụng bcrypt để hash mật khẩu
- Không lưu plaintext password
- Hỗ trợ password reset thông qua email

### Role-Based Access Control (RBAC)

- **admin**: Toàn quyền
- **user**: Chỉ quản lý thiết bị của mình
- **viewer**: Chỉ xem dữ liệu

## 🗄️ Database Schema

### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  hashed_password VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'user',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Devices Table
```sql
CREATE TABLE devices (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  device_type VARCHAR(50),
  latitude FLOAT,
  longitude FLOAT,
  is_active BOOLEAN DEFAULT TRUE,
  owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  last_seen TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Telemetry Table
```sql
CREATE TABLE telemetry (
  id SERIAL PRIMARY KEY,
  device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
  data JSONB,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_device_timestamp (device_id, timestamp)
);
```

## 🔄 MQTT Integration

### Workflow

1. **Hardware Simulator** hoặc **Real Devices** gửi dữ liệu đến MQTT Broker
2. **Worker Process** (`worker/worker_main.py`) subscribe đến topics MQTT
3. **Parser** (ví dụ: `gnss_parser.py`) xử lý dữ liệu
4. **Writer** lưu vào database
5. **Frontend** query API để lấy dữ liệu

### MQTT Topics
```
navis/device/{device_id}/telemetry
navis/device/{device_id}/status
navis/device/{device_id}/alarms
```

### Configuration

File `app/core/mqtt_config.py`:
```python
MQTT_BROKER = os.getenv("MQTT_BROKER", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_TOPIC = os.getenv("MQTT_TOPIC_PREFIX", "navis/")
```

## 🧪 Testing

### Chạy Tests (nếu có)

```bash
pytest tests/
pytest tests/ -v --cov=app
```

### Manual Testing với Swagger

1. Mở http://localhost:8000/docs
2. Click "Try it out" trên bất kỳ endpoint nào
3. Nhập parameters và click "Execute"

### Testing MQTT (nếu cần)

```bash
# Terminal 1: Start MQTT broker
docker run -it -p 1883:1883 eclipse-mosquitto

# Terminal 2: Publish test message
mosquitto_pub -h localhost -t "navis/device/test_device/telemetry" -m '{"signal": 25, "latitude": 21.0285, "longitude": 105.8542}'

# Terminal 3: Check if backend received it
# Xem logs hoặc query /api/telemetry
```

## 🚧 Phát Triển

### Thêm Endpoint Mới

1. Tạo function trong file phù hợp (`api/` folder)
2. Sử dụng decorators: `@router.get()`, `@router.post()`, v.v
3. Define Pydantic schemas cho request/response
4. Import router trong `main.py` và thêm: `app.include_router(router)`

Ví dụ:
```python
# api/example.py
from fastapi import APIRouter

router = APIRouter(prefix="/api/example", tags=["example"])

@router.get("/")
async def get_examples():
    return {"data": []}

# main.py
from app.api import example
app.include_router(example.router)
```

### Thêm Database Model Mới

1. Define model trong `models/schema.py`
2. Model phải inherit từ `Base`
3. SQLAlchemy tự động create table (hoặc dùng migrations)

```python
from sqlalchemy import Column, Integer, String
from app.core.database import Base

class NewModel(Base):
    __tablename__ = "new_models"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
```

### Code Style

- Sử dụng type hints cho tất cả functions
- Follow PEP 8
- Sử dụng snake_case cho variables/functions
- Comments cho logic phức tạp
- Docstrings cho công khai APIs

## 🐛 Troubleshooting

### Lỗi: "refused connection" PostgreSQL
```
Kiểm tra:
1. PostgreSQL service đang chạy?
2. DATABASE_URL đúng trong .env?
3. Database user có permission?
```

### Lỗi: MQTT Connection Failed
```
Kiểm tra:
1. MQTT Broker đang chạy?
2. MQTT_BROKER, MQTT_PORT đúng?
3. Firewall không block port?
```

### Lỗi: Token Invalid/Expired
```
Giải pháp:
1. Đăng nhập lại để lấy token mới
2. Dùng refresh token endpoint
3. Kiểm tra SECRET_KEY trong .env
```

### Port 8000 đã được sử dụng
```bash
lsof -i :8000  # Tìm process
kill -9 <PID>  # Kill process hoặc dùng port khác

# Hoặc
uvicorn app.main:app --port 8001
```

## 📊 Monitoring & Logging

### Logs
- FastAPI logs được in ra console
- Để persistent logging, cấu hình trong `main.py`:

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)
```

### Health Check Endpoint

```bash
curl http://localhost:8000/health
# Response: {"status": "ok"}
```

## 📦 Deployment

### Docker (Recommended)

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Docker Compose

Xem [docker-compose.yml](../docker-compose.yml) ở thư mục root.

```bash
docker-compose up -d backend
```

## 📚 Công Nghệ Sử Dụng

| Công Nghệ | Version | Mục Đích |
|-----------|---------|---------|
| **FastAPI** | 0.104.1 | Web framework |
| **Uvicorn** | 0.24.0 | ASGI server |
| **SQLAlchemy** | 2.0.23 | ORM |
| **PostgreSQL** | 14+ | Database |
| **Pydantic** | 2.5.0 | Data validation |
| **python-jose** | 3.3.0 | JWT tokens |
| **passlib** | 1.7.4 | Password hashing |
| **paho-mqtt** | 1.6.1 | MQTT client |
| **python-dotenv** | 1.0.0 | Environment config |

## 🔗 Liên Kết Tài Liệu

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [Pydantic Documentation](https://docs.pydantic.dev/)
- [MQTT_SETUP.md](../MQTT_SETUP.md) - Hướng dẫn MQTT
- [MQTT_data_schema.md](../MQTT_data_schema.md) - Schema dữ liệu MQTT

## 📞 Liên Hệ & Hỗ Trợ

Để báo cáo lỗi hoặc yêu cầu tính năng, vui lòng tạo issue trong repository.

## 📄 Giấy Phép

Dự án này là một phần của Navis Cloud Project.
