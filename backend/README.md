# 📚 Navis Cloud - Backend API

API server hiệu suất cao được xây dựng với **FastAPI**, cung cấp các endpoint quản lý thiết bị IoT, xác thực người dùng, và xử lý dữ liệu telemetry GNSS/MQTT theo thời gian thực.

## 📋 Tổng Quan

Backend của Navis Cloud cung cấp:
- **🔐 Xác thực & Bảo mật**: JWT-based authentication, role-based access control (RBAC)
- **📱 Quản lý Thiết bị**: CRUD operations, device status tracking, device provisioning
- **📊 Telemetry Data API**: Lưu trữ và truy vấn dữ liệu sensor GNSS/MQTT dạng time-series
- **🔄 MQTT Integration**: Real-time message processing, topic subscription management
- **🗄️ Database**: PostgreSQL + TimescaleDB với SQLAlchemy ORM
- **🚀 Performance**: Async processing, background tasks, automatic data cleanup
- **📝 Auto Documentation**: Swagger UI & OpenAPI specs tự động

## ✨ Tính Năng Chính

| Tính năng | Mô tả |
|----------|--------|
| ⚡ **FastAPI** | Framework hiện đại, tự động Swagger/OpenAPI docs |
| 🔐 **JWT Auth** | JSON Web Token authentication với refresh tokens |
| 🏷️ **Role-Based Access** | Admin, User, Viewer roles |
| 📊 **Time-Series Data** | Optimized cho dữ liệu GNSS/sensor |
| 🔄 **MQTT Broker** | Kết nối IoT devices thông qua MQTT |
| 🧹 **Auto Cleanup** | Tự động xóa dữ liệu cũ (default: 30 ngày) |
| ⏰ **Background Tasks** | Async tasks, scheduled jobs |
| 🔀 **CORS Support** | Cho phép frontend kết nối an toàn |
| 📡 **WebSocket Ready** | Hỗ trợ real-time updates |

## 🛠️ Tech Stack

```
FastAPI          - Web framework
Uvicorn          - ASGI server
SQLAlchemy 2.0   - ORM
PostgreSQL       - Main database
TimescaleDB      - Time-series extension
Pydantic         - Data validation
python-jose      - JWT tokens
passlib           - Password hashing
paho-mqtt        - MQTT client
python-dotenv    - Environment configuration
```

## 📦 Yêu Cầu & Cài Đặt

### Prerequisites
- **Python**: 3.10 trở lên
- **PostgreSQL**: 14 trở lên (hoặc TimescaleDB 2.8+)
- **MQTT Broker**: Mosquitto hoặc tương đương (tùy chọn cho dev)

### 1. Clone Repository
```bash
git clone <repository-url>
cd navis-cloud/backend
```

### 2. Tạo Virtual Environment
```bash
# Windows
python -m venv venv
.\venv\Scripts\activate

# Linux / Mac
python3 -m venv venv
source venv/bin/activate
```

### 3. Cài Đặt Dependencies
```bash
pip install -r requirements.txt
```

### 4. Cấu Hình Environment

Tạo file `.env` trong thư mục `backend/`:

```env


# ===== SECURITY =====
SECRET_KEY=your-super-secret-key-here-CHANGE-IN-PRODUCTION
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# ===== MQTT CONFIGURATION =====
MQTT_BROKER=localhost
MQTT_PORT=1883
MQTT_USERNAME=
MQTT_PASSWORD=
MQTT_TOPIC_PREFIX=navis/

# ===== API SETTINGS =====
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=True
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://127.0.0.1:3000

# ===== EMAIL (Optional) =====
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SENDER_EMAIL=your-email@gmail.com
SENDER_PASSWORD=your-app-password

# ===== LOGGING =====
LOG_LEVEL=INFO
```

### 5. Khởi Tạo Database

```bash
# Tạo database nếu chưa có
createdb navis_cloud -U navis_admin

# Hoặc với Docker PostgreSQL:
docker-compose up -d postgres

# Chạy migrations (nếu có):
# alembic upgrade head
```

## 🚀 Chạy Ứng Dụng

### Development Mode (với auto-reload)
```bash
python app/main.py
```

Hoặc với Uvicorn trực tiếp:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Production Mode (gunicorn + uvicorn)
```bash
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Xem API Documentation
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

## 📁 Cấu Trúc Dự Án

```
backend/
├── app/
│   ├── main.py                 # Entry point, app initialization
│   ├── schemas.py              # Pydantic request/response models
│   │
│   ├── api/                    # API routes (routers)
│   │   ├── __init__.py
│   │   ├── auth.py             # Login, register, token refresh
│   │   ├── devices.py          # Device CRUD endpoints
│   │   └── telemetry.py        # Telemetry data endpoints
│   │
│   ├── models/                 # SQLAlchemy ORM models
│   │   ├── __init__.py
│   │   └── schema.py           # User, Device, Telemetry models
│   │
│   ├── core/                   # Core utilities & configuration
│   │   ├── database.py         # DB engine, SessionLocal
│   │   ├── mqtt_config.py      # MQTT client setup
│   │   ├── security.py         # JWT, password hashing utilities
│   │   └── ws_manager.py       # WebSocket connection manager
│   │
│   └── services/               # Business logic layer (future)
│
├── requirements.txt            # Python dependencies
├── README.md                   # This file
└── .env                        # Environment variables (git ignored)

worker/                         # Data processing (separate)
├── worker_main.py
├── db_writer.py
└── parsers/
    ├── gnss_parser.py
    └── __init__.py
```

## 🔌 API Endpoints

### Authentication (`/api/auth`)

```http
POST   /api/auth/login           # Đăng nhập, nhận access token
POST   /api/auth/register        # Đăng ký tài khoản mới
POST   /api/auth/refresh         # Refresh access token
POST   /api/auth/logout          # Đăng xuất
POST   /api/auth/me              # Lấy thông tin user hiện tại
```

**Login Example:**
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin1@navis.com",
    "password": "123456"
  }'
```

Response:
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer",
  "expires_in": 1800,
  "user": {
    "id": 1,
    "email": "admin1@navis.com",
    "full_name": "Admin User",
    "role": "admin",
    "is_active": true
  }
}
```

### Devices (`/api/devices`)

```http
GET    /api/devices              # Danh sách tất cả thiết bị
GET    /api/devices/{device_id}  # Chi tiết thiết bị cụ thể
POST   /api/devices              # Tạo thiết bị mới
PUT    /api/devices/{device_id}  # Cập nhật thông tin thiết bị
DELETE /api/devices/{device_id}  # Xóa thiết bị
PATCH  /api/devices/{device_id}/status  # Cập nhật trạng thái
```

**Create Device:**
```bash
curl -X POST http://localhost:8000/api/devices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "GNSS_001",
    "device_type": "ublox",
    "location": "Hanoi Lab",
    "latitude": 21.0285,
    "longitude": 105.8542,
    "description": "Main GNSS receiver"
  }'
```

### Telemetry (`/api/telemetry`)

```http
GET    /api/telemetry                    # Danh sách dữ liệu (phân trang)
GET    /api/telemetry/device/{device_id} # Dữ liệu của thiết bị cụ thể
GET    /api/telemetry/latest             # Dữ liệu mới nhất từ tất cả devices
GET    /api/telemetry/{id}               # Chi tiết một record
POST   /api/telemetry                    # Tạo record mới (thường từ MQTT)
DELETE /api/telemetry/{id}               # Xóa record
```

**Get Latest Telemetry:**
```bash
curl -X GET "http://localhost:8000/api/telemetry/latest" \
  -H "Authorization: Bearer $TOKEN"
```

**Create Telemetry (thường tự động từ MQTT):**
```bash
curl -X POST http://localhost:8000/api/telemetry \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": 1,
    "signal": 25.5,
    "latitude": 21.0285,
    "longitude": 105.8542,
    "altitude": 15.3,
    "accuracy": 2.1,
    "satellites": 12
  }'
```

**Chi tiết API**: Xem http://localhost:8000/docs

## 🔐 Authentication & Authorization

### JWT Token Flow
```
1. User POST /api/auth/login với username + password
2. Server trả về access_token (JWT)
3. Client gửi token trong header: Authorization: Bearer <token>
4. Server verify token và xử lý request
5. Token hết hạn → request /api/auth/refresh để lấy token mới
```

### Token Structure
```json
{
  "sub": "admin1@navis.com",     // Subject (user email)
  "user_id": 1,                   // User ID
  "exp": 1650000000,              // Expiration time
  "iat": 1649999000,              // Issued at
  "role": "admin"                 // User role
}
```

### User Roles
| Role | Permissions |
|------|-------------|
| **admin** | Tất cả quyền (create/read/update/delete) |
| **user** | Read/update thiết bị và telemetry riêng |
| **viewer** | Read-only tất cả dữ liệu |

## 🔄 MQTT Integration

### Configuration
MQTT được cấu hình trong `app/core/mqtt_config.py`

**Topics:**
```
navis/device/{device_id}/telemetry    # Dữ liệu sensor
navis/device/{device_id}/status       # Trạng thái device
navis/device/{device_id}/alarm        # Cảnh báo
navis/system/health                   # System health metrics
```

### Subscription & Processing
1. Khi có message trên topic, MQTT client tự động xử lý
2. Worker service (`worker/worker_main.py`) subscribe các topics
3. Data được parse và lưu vào database
4. Frontend có thể query hoặc nhận real-time updates

### Manual Test MQTT
```bash
# Subscribe (terminal 1)
mosquitto_sub -h localhost -t "navis/device/+/telemetry"

# Publish (terminal 2)
mosquitto_pub -h localhost \
  -t "navis/device/001/telemetry" \
  -m '{"signal": 25, "satellites": 12}'
```

## 🗄️ Database Schema

### Tables

**Users**
```sql
id           INT PRIMARY KEY
email        VARCHAR UNIQUE NOT NULL
password_hash VARCHAR NOT NULL
full_name    VARCHAR
role         ENUM (admin, user, viewer)
is_active    BOOLEAN DEFAULT true
created_at   TIMESTAMP
updated_at   TIMESTAMP
```

**Devices**
```sql
id           INT PRIMARY KEY
user_id      INT FOREIGN KEY
name         VARCHAR NOT NULL
device_type  VARCHAR (e.g., 'ublox')
location     VARCHAR
latitude     FLOAT
longitude    FLOAT
is_active    BOOLEAN DEFAULT true
created_at   TIMESTAMP
updated_at   TIMESTAMP
```

**Telemetry** (Time-series, hypertable)
```sql
id           BIGSERIAL PRIMARY KEY
device_id    INT FOREIGN KEY
timestamp    TIMESTAMP (auto)
signal       FLOAT
latitude     FLOAT
longitude    FLOAT
altitude     FLOAT
accuracy     FLOAT
satellites   INT
raw_data     JSONB (optional)
created_at   TIMESTAMP
```

Hypertable tự động được tạo với TimescaleDB:
```sql
SELECT create_hypertable('telemetry', 'timestamp', if_not_exists => TRUE);
```

## ⚙️ Configuration

### Environment Variables (`.env`)

| Variable | Default | Mô Tả |
|----------|---------|--------|
| `DATABASE_URL` | - | PostgreSQL connection string |
| `SECRET_KEY` | - | JWT secret key |
| `ALGORITHM` | HS256 | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 30 | Token expiration |
| `MQTT_BROKER` | localhost | MQTT host |
| `MQTT_PORT` | 1883 | MQTT port |
| `API_HOST` | 0.0.0.0 | API bind address |
| `API_PORT` | 8000 | API port |
| `DEBUG` | False | Debug mode |
| `CORS_ORIGINS` | - | Comma-separated CORS origins |

### CORS Configuration
```python
# app/main.py
allow_origins = os.getenv("CORS_ORIGINS", "").split(",")
app.add_middleware(CORSMiddleware, allow_origins=allow_origins, ...)
```

## 📊 Performance Optimization

### Database
- ✅ TimescaleDB hypertables cho time-series
- ✅ Automatic compression policy
- ✅ Indexes trên frequently queried columns
- ✅ Vacuum & analyze tự động

### API
- ✅ Async/await cho non-blocking I/O
- ✅ Connection pooling
- ✅ Pagination cho large datasets
- ✅ Caching headers

### Monitoring
```bash
# View slow queries
docker-compose exec postgres psql -U navis_admin -d navis_cloud -c \
  "SELECT query, calls, mean_time FROM pg_stat_statements ORDER BY mean_time DESC;"

# Monitor connections
docker-compose exec postgres psql -U navis_admin -d navis_cloud -c \
  "SELECT count(*) FROM pg_stat_activity;"
```

## 🧪 Testing

### Run Tests
```bash
# Install pytest
pip install pytest pytest-cov pytest-asyncio

# Run all tests
pytest tests/ -v

# Run with coverage
pytest tests/ -v --cov=app --cov-report=html

# Run specific test
pytest tests/test_auth.py::test_login -v
```

### Manual Testing with Swagger
1. Mở http://localhost:8000/docs
2. Click "Try it out" trên endpoint
3. Fill parameters
4. Click "Execute"

### CURL Examples

**Login:**
```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin1@navis.com", "password": "123456"}' | jq -r '.access_token')

echo "Token: $TOKEN"
```

**Get Devices:**
```bash
curl -X GET http://localhost:8000/api/devices \
  -H "Authorization: Bearer $TOKEN" | jq
```

## 🚨 Troubleshooting

### Connection Error: `could not connect to server`
```bash
# Verify PostgreSQL is running
docker-compose ps postgres

# Check connection string
echo $DATABASE_URL

# Test connection directly
psql $DATABASE_URL
```

### JWT Token Invalid
```
Error: "Could not validate credentials"
- Kiểm tra SECRET_KEY có trùng khớp
- Kiểm tra token chưa hết hạn
- Kiểm tra format: "Authorization: Bearer <token>"
```

### MQTT Connection Failed
```bash
# Check broker running
docker-compose logs mqtt

# Test connect
mosquitto_pub -h localhost -t "test" -m "hello"

# View credentials in .env
cat .env | grep MQTT
```

### Module Not Found
```bash
# Reinstall dependencies
pip install -r requirements.txt --force-reinstall

# Check venv is activated
which python  # Should show venv path
```

### Database Lock
```bash
# View locks
psql -c "SELECT * FROM pg_locks;"

# Kill session
psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = 'navis_admin';"
```

## 📚 Additional Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [SQLAlchemy ORM](https://docs.sqlalchemy.org/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [TimescaleDB Guide](https://docs.timescale.com/)
- [MQTT Spec](https://mqtt.org/)
- [JWT.io](https://jwt.io/)

## 🔐 Security Notes

⚠️ **IMPORTANT** - Production Deployment:

- [ ] Change `SECRET_KEY` to a strong random value
- [ ] Change database passwords
- [ ] Enable HTTPS/TLS
- [ ] Use environment variables for all secrets
- [ ] Implement rate limiting
- [ ] Enable MQTT authentication
- [ ] Use strong CORS policies
- [ ] Regular security audits
- [ ] Keep dependencies updated

```bash
# Generate strong SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

**For detailed project info**: See [main README](../README.md)
**For MQTT setup**: See [MQTT_SETUP.md](../MQTT_SETUP.md)
**For data schema**: See [MQTT_data_schema.md](../MQTT_data_schema.md)
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
