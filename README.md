# 🌍 Navis Cloud - IoT Data Management Platform

Nền tảng quản lý dữ liệu IoT toàn diện được thiết kế để thu thập, xử lý, lưu trữ và trực quan hóa dữ liệu từ các thiết bị IoT phân tán. Hệ thống hỗ trợ GNSS tracking, sensor telemetry, real-time monitoring, và advanced analytics.

## 📖 Giới Thiệu

**Navis Cloud** là một stack công nghệ đầy đủ cho IoT applications bao gồm:
- 🚀 **Backend**: FastAPI server với PostgreSQL TimescaleDB
- 🎨 **Frontend**: React dashboard với real-time visualization
- 🔄 **Real-time Messaging**: MQTT integration + Kafka/Zookeeper
- 📊 **Data Processing**: Worker services với GNSS parsing engines
- 🐳 **Containerization**: Docker & Docker Compose

### Công Dụng Chính
- 🏢 **Multi-Tenant Support**: Hỗ trợ nhiều tổ chức độc lập trên một nền tảng
- 🔐 **Role-Based Access Control**: Phân quyền chi tiết theo vai trò (SuperAdmin, Tenant Admin, Operator, Viewer)
- 📱 Theo dõi thiết bị GPS/GNSS theo thời gian thực
- 🚗 Quản lý nhiều thiết bị IoT từ một nền tảng
- 📊 Hiển thị dữ liệu telemetry trên dashboard interactive
- 💾 Lưu trữ lịch sử dữ liệu dài hạn (30 ngày tự động cleanup)
- 🚨 Phát hiện cảnh báo tự động
- 👥 Quản lý người dùng và quyền truy cập từng tenant (JWT-based)

## 🏗️ Kiến Trúc Hệ Thống (Technical Architecture)

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React 19)                     │
│    Dashboard | Charts | Maps | Devices | Alarms | Users     │
└─────────────────────────────────────────────────────────────┘
                         (WebSocket + REST API)
                              │
┌─────────────────────────────────────────────────────────────┐
│                  Backend (FastAPI + FastAPI)                │
│  Auth | Device Management | Telemetry API | WebSocket       │
└─────────────────────────────────────────────────────────────┘
       ┌──────────────────┬─────────────────┐
       │                  │                 │
   ┌───▼─────┐    ┌───────▼────────┐  ┌────▼──────────┐
   │PostgreSQL │   │  MQTT Broker   │  │ Kafka+Zookeeper
   │TimescaleDB    │  (Mosquitto)   │  │  (Streaming)  │
   └───┬─────┘    └────────┬───────┘  └────┬──────────┘
       │                   │               │
   ┌───▼───────────────────▼───────────────▼────┐
   │     Worker Services (Python)               │
   │  GNSS Parser | DB Writer | Data Processors│
   └───────────┬────────────────────────────────┘
               │
    (Hardware Simulator / Real GNSS Devices)
```

## 🏢 Multi-Tenant Architecture

**Navis Cloud** sử dụng mô hình **Multi-Tenant** để hỗ trợ nhiều tổ chức độc lập cùng sử dụng một hệ thống:

### Cấu Trúc Dữ Liệu
```
System (Navis Cloud)
├── SuperAdmin (System-wide admin)
│   └── Quản lý các Tenant (enable/disable, device limits)
│
├── Tenant 1 (Công ty A)
│   ├── Tenant Admin (Quản trị viên công ty)
│   │   ├── Tạo/xóa user trong công ty
│   │   ├── Quản lý device của công ty
│   │   └── Gán device cho nhân viên
│   │
│   ├── Operator (Nhân viên vận hành)
│   │   └── Điều khiển device được giao
│   │
│   └── Viewer (Nhân viên xem)
│       └── Theo dõi trạng thái device
│
└── Tenant 2 (Công ty B)
    ├── Tenant Admin
    ├── Operator
    └── Viewer
```

### Phân Quyền Chi Tiết

| Chức Năng | SuperAdmin | Tenant Admin | Operator | Viewer |
|-----------|-----------|-------------|----------|--------|
| 👥 Quản lý Tenant | ✅ | ❌ | ❌ | ❌ |
| 🏢 Kích hoạt/Vô hiệu Tenant | ✅ | ❌ | ❌ | ❌ |
| 📱 Thêm Device | ❌ | ✅ | ❌ | ❌ |
| 🎮 Điều khiển Device | ❌ | ✅ (all) | ✅ (assigned) | ❌ |
| 👁️ Xem Device | ❌ | ✅ | ✅ | ✅ |
| 📊 Xem Telemetry | ❌ | ✅ | ✅ | ✅ |
| 👤 Quản lý User | ❌ | ✅ | ❌ | ❌ |
| ⚙️ System Config | ✅ | ❌ | ❌ | ❌ |

### Cơ Chế Bảo Mật (Security) - 4 Lớp Bảo Vệ

1. **Token Verification** - JWT decode & user validation
   - Decode JWT token từ Authorization header
   - Verify signature với SECRET_KEY
   - Load User từ database

2. **Authorization Check** - Role-based permission
   - Kiểm tra role (admin / user)
   - Kiểm tra role_in_tenant (tenant_admin / operator / viewer)
   - Raise 403 Forbidden nếu không đủ quyền

3. **Data Filtering** - Query-level tenant isolation
   - Query chỉ return data của tenant tương ứng: `WHERE device.tenant_id = user.tenant_id`
   - Operator chỉ thấy device được giao: `WHERE assigned_user_id = user.id`

4. **WebSocket Security** - Real-time connection protection
   - Verify token từ URL query string
   - Check tenant_id & assignment trước khi accept

**Kết quả:** Mỗi user chỉ thấy data của tenant/device được phép. SuperAdmin không xem device, chỉ quản lý Tenant.

**Xem chi tiết:** [MULTITENANT_SECURITY.md](backend/MULTITENANT_SECURITY.md) - Giải thích flow đăng nhập, JWT token, middleware, API protection, WebSocket security, và test cases.

## 📦 Cấu Trúc Thư Mục

```
navis-cloud/
├── backend/                    # API Server (FastAPI)
│   ├── app/
│   │   ├── main.py            # Entry point
│   │   ├── schemas.py         # Pydantic models
│   │   ├── api/               # API routes
│   │   │   ├── auth.py        # Authentication
│   │   │   ├── devices.py     # Device management
│   │   │   └── telemetry.py   # Telemetry endpoints
│   │   ├── models/
│   │   │   └── schema.py      # SQLAlchemy models
│   │   ├── core/
│   │   │   ├── database.py    # DB connection
│   │   │   ├── mqtt_config.py # MQTT setup
│   │   │   └── security.py    # JWT & hashing
│   │   └── services/          # Business logic
│   ├── requirements.txt
│   └── README.md
│
├── frontend/                   # React Dashboard
│   ├── src/
│   │   ├── components/        # Reusable components
│   │   ├── pages/             # Page components
│   │   ├── assets/            # Images & fonts
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.js
│   └── README.md
│
├── worker/                     # Data Processing
│   ├── worker_main.py         # Main entry
│   ├── db_writer.py           # Database writer
│   └── parsers/
│       ├── gnss_parser.py     # GNSS data parser
│       └── __init__.py
│
├── docker-compose.yml         # Container orchestration
├── hardware_simulator.py       # Device simulator
├── MQTT_SETUP.md             # MQTT configuration guide
├── MQTT_data_schema.md       # Data schema documentation
└── README.md                 # This file
```

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)

#### 1. Cài đặt Prerequisites
- Docker Desktop hoặc Docker Engine
- Git

#### 2. Clone Repository
```bash
git clone <repository-url>
cd navis-cloud
```

#### 3. Khởi động tất cả Services
```bash
docker-compose up -d
```

#### 4. Kiểm tra Status
```bash
docker-compose ps
```

Các services sẽ khả dụng tại:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000/docs
- **Swagger UI**: http://localhost:8000/docs
- **PostgreSQL**: localhost:5432
- **MQTT**: localhost:1883
- **Kafka**: localhost:9092

### Option 2: Local Development Setup

#### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL 14+
- MQTT Broker (Mosquitto)

#### Backend Setup
```bash
# 1. Virtual environment
cd backend
python -m venv venv
.\venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure .env
cp .env.example .env
# Edit .env với database credentials

# 4. Run server
python app/main.py
```

#### Frontend Setup
```bash
# 1. Install dependencies
cd frontend
npm install

# 2. Configure environment (optional)
# Tạo .env.local nếu cần

# 3. Start dev server
npm run dev
```

#### Worker Setup
```bash
# 1. Virtual environment (shared with backend)
cd ..
source backend/venv/bin/activate  # Already in venv

# 2. Run worker
python worker/worker_main.py
```

#### Hardware Simulator (Optional)
```bash
# Simulate IoT devices sending MQTT data
python hardware_simulator.py
```

## 🔐 Default Credentials

### Admin User (tự động tạo)
- **Email**: admin1@navis.com
- **Password**: 123456

### Database
- **User**: navis_admin
- **Password**: navis_password_123
- **Database**: navis_cloud

### MQTT
- **Host**: localhost
- **Port**: 1883
- **Username**: (nếu cần cấu hình)
- **Password**: (nếu cần cấu hình)

⚠️ **IMPORTANT**: Đổi mật khẩu ngay trong production!

## 📚 Documentation

| File | Mô Tả |
|------|-------|
| [Backend README](backend/README.md) | Hướng dẫn backend, API, database |
| [Frontend README](frontend/README.md) | Hướng dẫn frontend, components, build |
| [MQTT_SETUP.md](MQTT_SETUP.md) | Cấu hình MQTT broker |
| [MQTT_data_schema.md](MQTT_data_schema.md) | Schema dữ liệu MQTT |

## 🔄 Workflow Dữ Liệu

### 1. Data Ingestion (Thu thập dữ liệu)
```
IoT Devices / Hardware Simulator
        ↓ (MQTT)
   MQTT Broker
        ↓
   Worker Service (Consumer)
```

### 2. Data Processing (Xử lý dữ liệu)
```
Worker Service
    ├─→ GNSS Parser
    ├─→ Validation
    └─→ Database Writer
```

### 3. Data Storage (Lưu trữ)
```
TimescaleDB PostgreSQL
    ├─→ Users Table
    ├─→ Devices Table
    └─→ Telemetry Table (Time-series)
```

### 4. Data Visualization (Hiển thị)
```
Backend API (FastAPI)
    ↓ (REST)
Frontend Dashboard (React)
    ├─→ Real-time Charts
    ├─→ Device Map
    ├─→ Alarms Page
    └─→ User Management
```

## 🔌 API Endpoints

### Authentication
```
POST   /api/auth/login           - Đăng nhập
POST   /api/auth/register        - Đăng ký
POST   /api/auth/refresh         - Refresh token
POST   /api/auth/forgot-password - Reset mật khẩu
```

### Devices
```
GET    /api/devices              - Danh sách thiết bị
GET    /api/devices/{id}         - Chi tiết thiết bị
POST   /api/devices              - Tạo thiết bị
PUT    /api/devices/{id}         - Cập nhật thiết bị
DELETE /api/devices/{id}         - Xóa thiết bị
PATCH  /api/devices/{id}/status  - Cập nhật trạng thái
```

### Telemetry
```
GET    /api/telemetry            - Danh sách dữ liệu
GET    /api/telemetry/{device}   - Dữ liệu theo device
GET    /api/telemetry/latest     - Dữ liệu mới nhất
POST   /api/telemetry            - Ghi dữ liệu mới
```

Xem API documentation đầy đủ: http://localhost:8000/docs

## 📊 MQTT Topics

```
navis/device/{device_id}/telemetry    # Dữ liệu sensor
navis/device/{device_id}/status       # Trạng thái device
navis/device/{device_id}/alarms       # Cảnh báo
navis/system/health                   # System health
```

Xem chi tiết: [MQTT_SETUP.md](MQTT_SETUP.md)

## 🧪 Testing

### Backend Tests
```bash
cd backend
pytest tests/ -v
pytest tests/ -v --cov=app
```

### Frontend Tests
```bash
cd frontend
npm test
npm run test:coverage
```

### Manual API Testing
```bash
# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \

# Get devices
curl -X GET http://localhost:8000/api/devices \
  -H "Authorization: Bearer <TOKEN>"

# View Swagger UI
# Mở: http://localhost:8000/docs
```

### MQTT Testing
```bash
# Subscribe to topic
mosquitto_sub -h localhost -t "navis/device/+/telemetry"

# Publish test message
mosquitto_pub -h localhost \
  -t "navis/device/sim_001/telemetry" \
  -m '{"signal": 25, "latitude": 21.0285, "longitude": 105.8542}'
```

## 🛠️ Development

### Adding a New Backend Endpoint

1. **Define schema** in `backend/app/schemas.py`:
```python
class MyDataModel(BaseModel):
    name: str
    value: float
```

2. **Create API route** in `backend/app/api/my_feature.py`:
```python
from fastapi import APIRouter
router = APIRouter(prefix="/api/my-feature", tags=["my-feature"])

@router.get("/")
async def get_my_data():
    return {"data": []}
```

3. **Register route** in `backend/app/main.py`:
```python
from app.api import my_feature
app.include_router(my_feature.router)
```

### Adding a New Frontend Page

1. **Create component** in `frontend/src/pages/MyPage.jsx`
2. **Add route** in `frontend/src/App.jsx`
3. **Add navigation** in `frontend/src/components/Sidebar.jsx`

### Adding a New Data Parser

1. **Create parser** in `worker/parsers/my_parser.py`
2. **Implement** parse function
3. **Register** in `worker/worker_main.py`

## 📈 Performance Tips

- Use TimescaleDB for efficient time-series queries
- Enable MQTT message compression
- Implement caching in frontend
- Use database indexes on frequently queried columns
- Monitor worker CPU/memory usage

## 🚨 Troubleshooting

### Docker Issues
```bash
# View logs
docker-compose logs -f backend

# Rebuild images
docker-compose down
docker-compose up --build

# Remove all containers
docker-compose down -v
```

### Database Connection Error
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Verify DATABASE_URL in .env
# Format: postgresql://user:password@host:port/dbname
```

### MQTT Connection Failed
```bash
# Check MQTT broker running
docker-compose logs mosquitto

# Test connection
mosquitto_sub -h localhost -t "test"
```

### Frontend Not Loading Backend Data
```
1. Check backend is running: http://localhost:8000/docs
2. Check CORS is enabled in backend
3. Verify VITE_API_URL in frontend/.env.local
4. Check browser console for errors
```

### Worker Not Processing Messages
```
1. Check MQTT broker has messages
2. View worker logs: docker-compose logs worker
3. Verify database connection string
4. Check parsers are registered
```

## 🔐 Security Best Practices

- ✅ Use strong passwords (min 12 characters)
- ✅ Change default credentials immediately
- ✅ Enable HTTPS in production
- ✅ Use environment variables for secrets
- ✅ Rotate JWT secret keys regularly
- ✅ Implement rate limiting on public endpoints
- ✅ Use MQTT authentication
- ✅ Enable database encryption
- ✅ Regular security audits
- ✅ Keep dependencies updated

## 📊 Database Maintenance

### Backup Database
```bash
docker-compose exec postgres pg_dump -U navis_admin navis_cloud > backup.sql
```

### Restore Database
```bash
docker-compose exec -T postgres psql -U navis_admin navis_cloud < backup.sql
```

### Clean Old Telemetry
```bash
# Backend automatically cleans data older than 1 hour
# Customize in backend/app/main.py: cleanup_old_telemetry_task()
```

## 📈 Scaling

### For Production:
- Deploy backend with multiple workers (nginx load balancer)
- Use managed PostgreSQL service
- Implement Redis caching
- Deploy Kafka cluster for high-throughput
- Containerize and orchestrate with Kubernetes
- Set up monitoring & alerting (Prometheus, Grafana)

## 🤝 Contributing

1. Fork repository
2. Create feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -am 'Add my-feature'`
4. Push to branch: `git push origin feature/my-feature`
5. Submit Pull Request

## 📝 Coding Standards

- Follow PEP 8 (Python)
- Follow Prettier formatting (JavaScript/React)
- Write meaningful commit messages
- Add comments for complex logic
- Include tests for new features
- Update documentation

## 📞 Support & Contact

- 📧 Email: support@navis.cloud
- 🐛 Issues: Create GitHub issue
- 💬 Discussions: GitHub Discussions
- 📚 Wiki: Project Wiki

## 📄 License

Navis Cloud Project - All Rights Reserved

---

## 🎯 Roadmap

### v1.0 (Current)
- ✅ Basic device management
- ✅ Real-time telemetry
- ✅ User authentication
- ✅ Dashboard & visualization

### v1.1 (Upcoming)
- ⏳ Advanced filtering & search
- ⏳ Custom alerts & notifications
- ⏳ Report generation
- ⏳ API rate limiting

### v2.0 (Future)
- ⏳ Machine learning predictions
- ⏳ Mobile app
- ⏳ Advanced analytics
- ⏳ Multi-tenancy support
- ⏳ Custom plugins/extensions

---

**Last Updated**: May 2026  
**Version**: 1.0.0  
**Status**: Production Ready ✅

Happy IoT monitoring! 🚀
