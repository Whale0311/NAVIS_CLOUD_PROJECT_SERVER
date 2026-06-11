# 📚 Navis Cloud - Backend API

API server hiệu suất cao được xây dựng với **FastAPI**, cung cấp các endpoint quản lý thiết bị IoT, xác thực người dùng, và xử lý dữ liệu telemetry GNSS/MQTT theo thời gian thực.

## 📋 Tổng Quan

Backend của Navis Cloud cung cấp:
- **🏢 Multi-Tenant Architecture**: Hỗ trợ nhiều tổ chức độc lập
- **🔐 Xác thực & Bảo mật**: JWT-based authentication, role-based access control (RBAC) - 2 levels
- **📱 Quản lý Thiết bị**: CRUD operations, device status tracking, tenant-specific devices
- **📊 Telemetry Data API**: Lưu trữ và truy vấn dữ liệu sensor GNSS/MQTT dạng time-series
- **🔄 MQTT Integration**: Real-time message processing, topic subscription management
- **🗄️ Database**: PostgreSQL + TimescaleDB với SQLAlchemy ORM
- **🚀 Performance**: Async processing, background tasks, automatic data cleanup
- **📝 Auto Documentation**: Swagger UI & OpenAPI specs tự động

## ✨ Tính Năng Chính

| Tính năng | Mô Tả |
|----------|--------|
| ⚡ **FastAPI** | Framework hiện đại, tự động Swagger/OpenAPI docs |
| 🏢 **Multi-Tenant** | Hỗ trợ nhiều tổ chức, tenant isolation, tenant-specific data |
| 🔐 **JWT Auth** | JSON Web Token authentication với refresh tokens |
| 🏷️ **2-Level RBAC** | System-level (admin/user) + Tenant-level (tenant_admin/operator/viewer) |
| 📊 **Time-Series Data** | Optimized cho dữ liệu GNSS/sensor, TimescaleDB hypertables |
| 🔄 **MQTT Broker** | Kết nối IoT devices thông qua MQTT |
| 🧹 **Auto Cleanup** | Tự động xóa dữ liệu cũ (default: 30 ngày) |
| ⏰ **Background Tasks** | Async tasks, scheduled jobs |
| 🔀 **CORS Support** | Cho phép frontend kết nối an toàn |
| 📡 **WebSocket Ready** | Hỗ trợ real-time updates với tenant protection |

## 🛠️ Tech Stack

```
FastAPI          - Web framework
Uvicorn          - ASGI server
SQLAlchemy 2.0   - ORM
PostgreSQL       - Main database
TimescaleDB      - Time-series extension
Pydantic         - Data validation
python-jose      - JWT tokens
passlib          - Password hashing
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
# ===== DATABASE =====
DATABASE_URL=postgresql://navis_admin:navis_password_123@localhost:5432/navis_cloud

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

# ===== DEFAULT ADMIN =====
DEFAULT_ADMIN_EMAIL=admin1@navis.com
DEFAULT_ADMIN_PASSWORD=123456
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
│   │   ├── auth.py             # Login, register, token refresh, user management
│   │   ├── devices.py          # Device CRUD endpoints
│   │   └── telemetry.py        # Telemetry data endpoints
│   │
│   ├── models/                 # SQLAlchemy ORM models
│   │   ├── __init__.py
│   │   └── schema.py           # Tenant, User, Device, Telemetry models
│   │
│   ├── core/                   # Core utilities & configuration
│   │   ├── database.py         # DB engine, SessionLocal
│   │   ├── mqtt_config.py      # MQTT client setup
│   │   ├── security.py         # JWT, password hashing utilities
│   │   └── ws_manager.py       # WebSocket connection manager
│   │
│   └── services/               # Business logic layer
│
├── requirements.txt            # Python dependencies
├── README.md                   # This file
└── .env                        # Environment variables (git ignored)
```

## 🔌 API Endpoints

### Authentication (`/api/auth`)

```http
POST   /api/auth/login              # Đăng nhập, nhận access token
POST   /api/auth/register           # Đăng ký tài khoản mới  
POST   /api/auth/refresh            # Refresh access token
POST   /api/auth/logout             # Đăng xuất
GET    /api/auth/me                 # Lấy thông tin user hiện tại
POST   /api/auth/forgot-password    # Reset mật khẩu
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
    "role": "admin",
    "tenant_id": null,
    "role_in_tenant": null
  }
}
```

### Devices (`/api/devices`)

```http
GET    /api/devices                   # Danh sách tất cả thiết bị (phân trang)
GET    /api/devices/{device_id}       # Chi tiết thiết bị cụ thể
POST   /api/devices                   # Tạo thiết bị mới
PUT    /api/devices/{device_id}       # Cập nhật thông tin thiết bị
DELETE /api/devices/{device_id}       # Xóa thiết bị
PATCH  /api/devices/{device_id}/status  # Cập nhật trạng thái
```

**Create Device:**
```bash
curl -X POST http://localhost:8000/api/devices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "gnss_001",
    "name": "GNSS Receiver 1",
    "device_type": "ublox",
    "location": "Hanoi Lab",
    "latitude": 21.0285,
    "longitude": 105.8542
  }'
```

### Telemetry (`/api/telemetry`)

```http
GET    /api/telemetry                       # Danh sách dữ liệu (phân trang)
GET    /api/telemetry/device/{device_id}   # Dữ liệu của thiết bị cụ thể
GET    /api/telemetry/latest                # Dữ liệu mới nhất từ tất cả devices
GET    /api/telemetry/{id}                  # Chi tiết một record
POST   /api/telemetry                       # Tạo record mới (thường từ MQTT)
DELETE /api/telemetry/{id}                  # Xóa record
```

**Get Latest Telemetry:**
```bash
curl -X GET "http://localhost:8000/api/telemetry/latest" \
  -H "Authorization: Bearer $TOKEN"
```

### Tenants (`/api/tenants`) - SuperAdmin Only

```http
GET    /api/tenants                  # Danh sách tất cả tenants
GET    /api/tenants/{tenant_id}      # Chi tiết tenant
POST   /api/tenants                  # Tạo tenant mới
PUT    /api/tenants/{tenant_id}      # Cập nhật tenant
DELETE /api/tenants/{tenant_id}      # Xóa tenant
```

### Users (`/api/users`)

```http
GET    /api/users                    # Danh sách users (role-based)
GET    /api/users/{user_id}          # Chi tiết user
POST   /api/users                    # Tạo user mới (admin only)
PUT    /api/users/{user_id}          # Cập nhật user info
DELETE /api/users/{user_id}          # Xóa user
POST   /api/users/{user_id}/password # Đổi mật khẩu
```

**Chi tiết API**: Xem http://localhost:8000/docs

## 🔐 Authentication & Authorization

### JWT Token Flow
```
1. User POST /api/auth/login với email + password
2. Server xác thực, tạo JWT token (30 phút)
3. Client lưu token và gửi trong header: Authorization: Bearer <token>
4. Server verify token và check quyền
5. Token hết hạn → client gọi /api/auth/refresh
```

### Token Structure
```json
{
  "sub": "admin1@navis.com",      // Email
  "user_id": 1,                   // ID
  "role": "admin",                // System-level: admin / user
  "tenant_id": 1,                 // ID công ty (null nếu SuperAdmin)
  "role_in_tenant": "tenant_admin", // Tenant-level: tenant_admin / operator / viewer
  "exp": 1650000000,              // Expiration time
  "iat": 1649999000               // Issued at
}
```

### User Roles & Multi-Tenant RBAC

Backend hỗ trợ **Multi-Tenant** architecture với hai cấp độ quyền:

**1. System-Level Role (`role` field):**
- `admin` - SuperAdmin: Quản lý các Tenant
- `user` - Normal User: Thuộc một Tenant cụ thể

**2. Tenant-Level Role (`role_in_tenant` field):**
- `tenant_admin` - Quản trị viên: Quản lý users, devices
- `operator` - Vận hành: Điều khiển device được giao
- `viewer` - Xem: Chỉ xem dữ liệu

**Permission Matrix:**

| Chức Năng | SuperAdmin | Tenant Admin | Operator | Viewer |
|-----------|-----------|-------------|----------|--------|
| 👥 Quản lý Tenant | ✅ | ❌ | ❌ | ❌ |
| 👤 Tạo User | ❌ | ✅ | ❌ | ❌ |
| 📱 Thêm Device | ❌ | ✅ | ❌ | ❌ |
| 🎮 Điều khiển Device | ❌ | ✅ (all) | ✅ (assigned) | ❌ |
| 👁️ Xem Device | ❌ | ✅ | ✅ | ✅ |
| 📊 Xem Telemetry | ❌ | ✅ | ✅ | ✅ |

### Security Layers

1. **Token Verification**: Decode & verify JWT signature
2. **Role Check**: Kiểm tra system-level + tenant-level roles
3. **Data Filtering**: Query-level tenant isolation
4. **WebSocket Protection**: Token validation & assignment check

## 🔄 MQTT Integration

### Configuration
MQTT được cấu hình trong `app/core/mqtt_config.py`

**Topics:**
```
navis/device/{device_id}/telemetry    # Dữ liệu sensor
navis/device/{device_id}/status       # Trạng thái device
navis/device/{device_id}/alarm        # Cảnh báo
navis/system/health                   # System health
```

### Subscription & Processing
1. Worker service subscribe các topics
2. Data được parse (GNSS parser)
3. Lưu vào database
4. Frontend query API hoặc WebSocket

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

### Tenants Table
```sql
CREATE TABLE tenants (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  subscription_plan VARCHAR(50) DEFAULT 'free',
  max_devices INT DEFAULT 5,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  hashed_password VARCHAR(255) NOT NULL,
  
  -- System-level
  role VARCHAR(20) DEFAULT 'user',
  
  -- Tenant-level
  tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE,
  role_in_tenant VARCHAR(20) DEFAULT 'viewer',
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
```

### Devices Table
```sql
CREATE TABLE devices (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255),
  device_type VARCHAR(50),
  
  latitude FLOAT,
  longitude FLOAT,
  site_id VARCHAR(100) DEFAULT 'default_site',
  
  tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE,
  assigned_user_id INT REFERENCES users(id) ON DELETE SET NULL,
  
  is_active BOOLEAN DEFAULT TRUE,
  last_seen TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_devices_tenant_id ON devices(tenant_id);
CREATE INDEX idx_devices_device_id ON devices(device_id);
CREATE INDEX idx_devices_assigned_user_id ON devices(assigned_user_id);
```

### Telemetry Table
```sql
CREATE TABLE telemetries (
  id BIGSERIAL PRIMARY KEY,
  device_id INT REFERENCES devices(id) ON DELETE CASCADE,
  
  event_id VARCHAR(100) UNIQUE,
  seq INT,
  timestamp TIMESTAMP DEFAULT NOW(),
  
  latitude FLOAT,
  longitude FLOAT,
  height_m FLOAT,
  
  avg_cno_dbhz FLOAT,
  sat_count INT,
  pdop FLOAT,
  is_spoofed BOOLEAN,
  status VARCHAR(50),
  
  signals_data JSONB,
  detectors_data JSONB
);

SELECT create_hypertable('telemetries', 'timestamp', if_not_exists => TRUE);
```

## ⚙️ Configuration

### Environment Variables (`.env`)

| Variable | Default | Mô Tả |
|----------|---------|--------|
| `DATABASE_URL` | - | PostgreSQL connection string |
| `SECRET_KEY` | - | JWT secret key |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 30 | Token expiration |
| `MQTT_BROKER` | localhost | MQTT host |
| `MQTT_PORT` | 1883 | MQTT port |
| `API_PORT` | 8000 | API port |
| `DEBUG` | False | Debug mode |
| `CORS_ORIGINS` | - | CORS origins (comma-separated) |

## 📊 Performance Optimization

### Database
- ✅ TimescaleDB hypertables cho time-series
- ✅ Automatic compression
- ✅ Indexes trên frequently queried columns
- ✅ Connection pooling

### API
- ✅ Async/await for non-blocking I/O
- ✅ Pagination
- ✅ Caching headers

## 🧪 Testing

### Run Tests
```bash
pip install pytest pytest-cov pytest-asyncio
pytest tests/ -v
pytest tests/ -v --cov=app --cov-report=html
```

### Manual Testing with Swagger
1. Mở http://localhost:8000/docs
2. Click "Try it out"
3. Fill parameters
4. Click "Execute"

### CURL Examples

**Login:**
```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin1@navis.com", "password": "123456"}' | jq -r '.access_token')
```

**Get Devices:**
```bash
curl -X GET http://localhost:8000/api/devices \
  -H "Authorization: Bearer $TOKEN"
```

## 🚨 Troubleshooting

### Connection Error: `could not connect to server`
```bash
# Verify PostgreSQL is running
docker-compose ps postgres

# Check connection string
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL
```

### JWT Token Invalid
```
Error: "Could not validate credentials"
- Kiểm tra SECRET_KEY trùng khớp
- Kiểm tra token chưa hết hạn
- Format: "Authorization: Bearer <token>"
```

### MQTT Connection Failed
```bash
# Check broker running
docker-compose logs mqtt

# Test connect
mosquitto_pub -h localhost -t "test" -m "hello"
```

### Module Not Found
```bash
pip install -r requirements.txt --force-reinstall
which python  # Check venv
```

## 📚 Additional Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [SQLAlchemy ORM](https://docs.sqlalchemy.org/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [TimescaleDB Guide](https://docs.timescale.com/)
- [JWT.io](https://jwt.io/)

## 🔐 Security Notes

⚠️ **IMPORTANT** - Production Deployment:

- [ ] Change `SECRET_KEY` to strong random value
- [ ] Change database passwords
- [ ] Enable HTTPS/TLS
- [ ] Use environment variables for secrets
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
