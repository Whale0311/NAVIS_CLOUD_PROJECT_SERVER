# 🎨 Navis Cloud - Frontend Dashboard

Ứng dụng web dashboard hiệu suất cao được xây dựng với **React 19** và **Vite**, cung cấp giao diện quản lý thiết bị IoT, theo dõi dữ liệu telemetry real-time, quản lý hệ thống, và trực quan hóa dữ liệu nâng cao.

## 📋 Tổng Quan

Frontend của Navis Cloud cung cấp:
- **🏢 Multi-Tenant Dashboard**: Giao diện riêng biệt cho mỗi Tenant (Công ty)
- **🔐 Role-Based UI**: Hiển thị menu và tính năng theo vai trò (SuperAdmin, Tenant Admin, Operator, Viewer)
- **📊 Dashboard**: Bảng điều khiển tổng quan hệ thống, metrics chính
- **🚀 Device Management**: Theo dõi, quản lý, control các thiết bị IoT kết nối
- **📈 Real-time Charts**: Trực quan hóa dữ liệu telemetry với Chart.js & Plotly
- **🗺️ Interactive Maps**: Hiển thị vị trí địa lý các thiết bị trên bản đồ (Leaflet)
- **🚨 Alarm Management**: Quản lý, theo dõi, phân loại các cảnh báo/sự cố
- **👥 User Management**: Kiểm soát truy cập, quản lý tài khoản người dùng (Tenant Admin)
- **🔐 Authentication**: Hệ thống đăng nhập bảo mật với JWT tokens

## ✨ Tính Năng Chính

| Tính năng | Mô tả |
|----------|--------|
| ⚡ **Vite** | Công cụ build siêu nhanh, HMR (Hot Module Replacement) |
| 🏢 **Multi-Tenant Support** | Giao diện riêng cho mỗi Tenant, tenant isolation |
| ⚛️ **React 19** | Thư viện UI hiện đại với hooks & components |
| 🔐 **Role-Based UI** | Render menu/tính năng dựa trên role (SuperAdmin, Tenant Admin, Operator, Viewer) |
| 📊 **Chart.js** | Biểu đồ động, real-time data visualization |
| 🗺️ **Leaflet** | Bản đồ tương tác, marker, popup |
| 📈 **Plotly** | Biểu đồ nâng cao (3D, heatmap, v.v) |
| 🎨 **Modern CSS** | CSS3, Flexbox, Grid, animations |
| 🎯 **ESLint** | Kiểm tra chất lượng code tự động |
| 🔗 **React Router** | Client-side routing với ProtectedRoute |
| 🔔 **Toast Notifications** | React-toastify alerts |
| 📡 **REST API Integration** | Kết nối backend qua Axios/Fetch |

## 🛠️ Tech Stack

```
React 19          - UI library
Vite              - Build tool
React Router 7    - Client routing
Chart.js 4.5      - Data visualization
Plotly.js 3.5     - Advanced charts
Leaflet 1.9       - Map library
Lucide React 1.8  - Icon library
React Toastify    - Notifications
ESLint            - Code quality
Node.js 18+       - Runtime
npm 9+            - Package manager
```

## 📦 Yêu Cầu & Cài Đặt

### Prerequisites
- **Node.js**: 18.0.0 trở lên
- **npm**: 9.0.0 trở lên (hoặc yarn/pnpm)

### 1. Clone Repository
```bash
git clone <repository-url>
cd navis-cloud/frontend
```

### 2. Cài Đặt Dependencies
```bash
npm install
```

Hoặc với yarn/pnpm:
```bash
yarn install
# hoặc
pnpm install
```

### 3. Cấu Hình Environment (Tùy Chọn)

Tạo file `.env.local` trong thư mục `frontend/` (nếu cần custom):

```env
VITE_API_URL=http://localhost:8000
VITE_API_TIMEOUT=30000
VITE_APP_NAME=Navis Cloud
VITE_LOG_LEVEL=debug
```

Nếu không có `.env.local`, sẽ dùng mặc định:
- `VITE_API_URL`: http://localhost:8000
- `VITE_API_TIMEOUT`: 30000 (ms)

## 🚀 Chạy Ứng Dụng

### Development Mode (Phát triển)
```bash
npm run dev
```

Output:
```
  VITE v8.0.4  ready in 300 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

Ứng dụng chạy tại: **http://localhost:5173**

HMR (Hot Module Replacement) được bật tự động → thay đổi code tự động cập nhật.

### Production Build (Xây dựng Production)
```bash
npm run build
```

Output: Tệp được compile và minify trong thư mục `dist/`
```
dist/
├── index.html
├── assets/
│   ├── index-XXX.js
│   └── index-XXX.css
└── ...
```

### Preview Production Build (Xem trước)
```bash
npm run preview
```

Xem bản build production cục bộ: **http://localhost:4173**

### Linting & Code Quality
```bash
# Check code quality
npm run lint

# Fix linting errors automatically
npm run lint -- --fix
```

## 📁 Cấu Trúc Dự Án

```
frontend/
├── public/                     # Tài nguyên tĩnh công khai
│   └── favicon.ico
│
├── src/
│   ├── assets/                # Hình ảnh, icon, font
│   │   └── ...
│   │
│   ├── components/            # Các component React tái sử dụng
│   │   ├── Layout.jsx         # Layout chính (header, sidebar)
│   │   ├── Sidebar.jsx        # Navigation menu
│   │   ├── Header.jsx         # Top header bar
│   │   └── ...
│   │
│   ├── context/               # React Context API
│   │   ├── SocketContext.jsx  # WebSocket context
│   │   ├── AuthContext.jsx    # Authentication context
│   │   └── ...
│   │
│   ├── pages/                 # Page components (routes)
│   │   ├── Dashboard.jsx      # Trang chủ Dashboard
│   │   ├── Devices.jsx        # Quản lý Devices
│   │   ├── DeviceDetail.jsx   # Chi tiết Device
│   │   ├── Charts.jsx         # Biểu đồ dữ liệu
│   │   ├── Map.jsx            # Bản đồ vị trí
│   │   ├── Alarms.jsx         # Quản lý Cảnh báo
│   │   ├── Users.jsx          # Quản lý Người dùng
│   │   └── Login.jsx          # Trang Đăng nhập
│   │
│   ├── services/              # API services (Axios calls)
│   │   ├── api.js             # API client config
│   │   ├── authService.js     # Auth API calls
│   │   ├── deviceService.js   # Device API calls
│   │   └── telemetryService.js # Telemetry API calls
│   │
│   ├── App.jsx                # Component App chính, routing
│   ├── index.css              # CSS toàn cục
│   ├── main.jsx               # Entry point
│   └── ...
│
├── .eslintrc.cjs              # ESLint configuration
├── vite.config.js             # Vite configuration
├── package.json               # Dependencies & scripts
├── package-lock.json          # Lock file
├── index.html                 # HTML template
├── README.md                  # This file
└── .env.local                 # Environment variables (git ignored)
```

## 🎯 Key Pages

### 📊 Dashboard (`/dashboard`)
- Overview metrics (device count, alerts, etc.)
- Latest telemetry from all devices
- System health status
- Quick access widgets

### 🏢 Tenants (`/tenants`) - SuperAdmin Only
- List of all Tenants (Companies)
- Tenant status (active/inactive)
- Tenant device limits management
- Tenant subscription info
- Enable/disable tenant actions

### 🚀 Devices (`/devices`) - Tenant Admin & above
- List of devices (filtered by tenant)
- Device status indicators
- Device filtering & search
- Device actions (edit, delete, detail)
- Assign device to user/operator

### 📈 Charts (`/charts`)
- Real-time data visualization
- Multiple chart types (line, bar, area)
- Time range selector
- Export data functionality

### 🗺️ Map (`/map`)
- Interactive map with device markers
- Device location pins
- Click marker for device details
- Real-time location updates

### 🚨 Alarms (`/alarms`)
- List of all alerts/alarms
- Alarm status (active, resolved)
- Alarm filtering & sorting
- Alarm detail modal

### 👥 Users (`/users`)
- User management (admin only)
- Add/edit/delete users
- Role assignment
- User status management

### 🔐 Login (`/login`)
- User authentication
- Email/password login
- JWT token management
- Remember me option

## � Role-Based UI Rendering (Multi-Tenant)

Frontend tự động render giao diện khác nhau dựa trên role của user:

### User Object Structure
```javascript
{
  id: 1,
  email: "user@company.com",
  role: "user",                        // System-level: admin hoặc user
  tenant_id: 1,                        // Tenant ID
  role_in_tenant: "tenant_admin",      // Tenant-level: tenant_admin, operator, viewer
  tenant_name: "Company A"
}
```

### Menu Navigation (Sidebar.jsx)
```javascript
// Ví dụ từ Sidebar.jsx
const isSuperAdmin = user?.role === "admin";
const isTenantAdmin = user?.role_in_tenant === "tenant_admin";
const isOperator = user?.role_in_tenant === "operator";
const isViewer = user?.role_in_tenant === "viewer";

// Điều chỉnh menu theo role
{isSuperAdmin && (
  <NavLink to="/tenants">
    👥 Quản lý Tenant
  </NavLink>
)}

{(isSuperAdmin || isTenantAdmin) && (
  <NavLink to="/users">
    👤 Quản lý User
  </NavLink>
)}

{(isSuperAdmin || isTenantAdmin || isOperator) && (
  <NavLink to="/devices">
    📱 Device Management
  </NavLink>
)}

{(isSuperAdmin || isTenantAdmin || isOperator || isViewer) && (
  <NavLink to="/charts">
    📊 Dashboard
  </NavLink>
)}
```

### Protected Routes (App.jsx)
```javascript
// Route protection dựa trên role
const ProtectedRoute = ({ allowedRoles }) => {
  const { user } = useContext(AuthContext);

  if (allowedRoles) {
    // Kiểm tra role hệ thống (admin) hoặc role công ty (tenant_admin, operator, viewer)
    const hasPermission = 
      allowedRoles.includes(user.role) || 
      allowedRoles.includes(user.role_in_tenant);
    
    if (!hasPermission) {
      return <Navigate to="/dashboard" />;
    }
  }

  return <Outlet />;
};

// Usage
<Routes>
  <Route element={<ProtectedRoute allowedRoles={['admin', 'tenant_admin']} />}>
    <Route path="/users" element={<Users />} />
  </Route>
  <Route element={<ProtectedRoute allowedRoles={['admin', 'tenant_admin', 'operator']} />}>
    <Route path="/devices" element={<Devices />} />
  </Route>
</Routes>
```

### Permission Matrix (UI)
```javascript
// Hàm kiểm tra quyền
const hasPermission = (action, userRole, userTenantRole) => {
  const permissions = {
    // Action: [system-level roles, tenant-level roles]
    'view_dashboard': [['admin', 'user'], ['tenant_admin', 'operator', 'viewer']],
    'manage_tenants': [['admin'], []],
    'manage_users': [['admin'], ['tenant_admin']],
    'manage_devices': [['admin'], ['tenant_admin']],
    'control_device': [['admin'], ['tenant_admin', 'operator']],
    'view_device': [['admin'], ['tenant_admin', 'operator', 'viewer']],
  };

  const [sysRoles, tenantRoles] = permissions[action] || [[], []];
  return sysRoles.includes(userRole) || tenantRoles.includes(userTenantRole);
};

// Usage trong component
{hasPermission('manage_users', user.role, user.role_in_tenant) && (
  <button onClick={() => setShowUserModal(true)}>
    Thêm User
  </button>
)}
```

### Data Isolation by Tenant
```javascript
// API calls tự động filter theo tenant (từ JWT token)
// Backend server confirm tenant_id từ token, không lấy từ frontend

// Frontend không cần lo về security ở layer này
// Vì backend verify JWT token và filter data

// Ví dụ:
const getDevices = async () => {
  // Backend sẽ chỉ trả về device của tenant hiện tại
  const response = await api.get('/api/devices');
  return response.data;
};

// Superadmin sẽ nhận API khác để quản lý Tenant
const getTenants = async () => {
  const response = await api.get('/api/tenants');
  return response.data;
};
```

## �🔄 Component Architecture

### Layout Structure
```
App
├── Login (if not authenticated)
└── Layout
    ├── Header
    ├── Sidebar
    └── Main Content Area
        ├── Dashboard
        ├── Devices
        ├── Charts
        ├── Map
        ├── Alarms
        └── Users
```

### State Management

**Authentication** (Context API):
```javascript
// contexts/AuthContext.jsx
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  
  return (
    <AuthContext.Provider value={{ user, token }}>
      {children}
    </AuthContext.Provider>
  );
};
```

**WebSocket** (Context API):
```javascript
// contexts/SocketContext.jsx
const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const [data, setData] = useState([]);
  const socketRef = useRef(null);
  
  // WebSocket connection logic
  
  return (
    <SocketContext.Provider value={{ data }}>
      {children}
    </SocketContext.Provider>
  );
};
```

## 🔌 API Integration

### API Service Setup
```javascript
// services/api.js
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: import.meta.env.VITE_API_TIMEOUT || 30000,
});

// Interceptor for JWT token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;
```

### Using API Services
```javascript
// services/deviceService.js
import api from './api';

export const getDevices = async () => {
  const response = await api.get('/api/devices');
  return response.data;
};

export const createDevice = async (deviceData) => {
  const response = await api.post('/api/devices', deviceData);
  return response.data;
};
```

### Using in Components
```javascript
// pages/Devices.jsx
import { useEffect, useState } from 'react';
import { getDevices } from '../services/deviceService';

export default function Devices() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const data = await getDevices();
        setDevices(data);
      } catch (error) {
        console.error('Error fetching devices:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDevices();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="devices-container">
      {devices.map(device => (
        <div key={device.id} className="device-card">
          <h3>{device.name}</h3>
          <p>{device.location}</p>
        </div>
      ))}
    </div>
  );
}
```

## 📊 Data Visualization

### Chart.js Example
```javascript
// components/TelemetryChart.jsx
import { Line } from 'react-chartjs-2';

export default function TelemetryChart({ data }) {
  const chartData = {
    labels: data.map(d => d.timestamp),
    datasets: [
      {
        label: 'Signal Strength',
        data: data.map(d => d.signal),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
      }
    ]
  };

  return <Line data={chartData} />;
}
```

### Map Example
```javascript
// components/DeviceMap.jsx
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';

export default function DeviceMap({ devices }) {
  return (
    <MapContainer center={[21.0285, 105.8542]} zoom={13}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {devices.map(device => (
        <Marker key={device.id} position={[device.latitude, device.longitude]}>
          <Popup>{device.name}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
```

## 🧪 Development & Testing

### Hot Module Replacement (HMR)
Vite tự động reload component khi thay đổi code:
```javascript
// App.jsx - No manual refresh needed!
if (import.meta.hot) {
  import.meta.hot.accept();
}
```

### Browser DevTools
```bash
# React DevTools
# Install: https://react-devtools-tutorial.vercel.app/

# Redux DevTools (if using Redux)
# Install: https://github.com/reduxjs/redux-devtools
```

### Testing with Swagger UI
1. Mở http://localhost:8000/docs
2. Test API endpoints
3. Copy cURL examples
4. Verify response in DevTools Network tab

### Manual Testing Checklist
- [ ] Login works
- [ ] Can view devices list
- [ ] Device detail loads
- [ ] Charts display data
- [ ] Map shows markers
- [ ] Alarms appear correctly
- [ ] User management works
- [ ] Responsive on mobile
- [ ] No console errors

## 🎨 Styling

### CSS Organization
```css
/* index.css - Global styles */
:root {
  --primary: #3b82f6;
  --secondary: #10b981;
  --danger: #ef4444;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto;
  color: var(--primary);
}

/* Component-scoped CSS */
.device-card {
  padding: 1rem;
  border-radius: 8px;
  background: white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
```

### Responsive Design
```css
/* Mobile first approach */
.container {
  padding: 1rem;
}

@media (min-width: 768px) {
  .container {
    padding: 2rem;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .container {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

## 🚨 Common Issues

### 1. Cannot Connect to Backend
```
Error: Failed to fetch http://localhost:8000/...
Solution:
- Check backend is running: http://localhost:8000/docs
- Check VITE_API_URL in .env.local
- Check CORS is enabled in backend
```

### 2. VITE Not Found
```bash
npm install -g vite
# or
npx vite
```

### 3. Components Not Updating
```javascript
// Check you're using hooks correctly
const [value, setValue] = useState(initial);

useEffect(() => {
  // Dependency array is important!
}, [dependencies]);
```

### 4. Chart Not Displaying
```javascript
// Make sure you're using react-chartjs-2 correctly
import { Line } from 'react-chartjs-2';
import Chart from 'chart.js/auto';  // Important!
```

### 5. Map Not Loading
```javascript
// Check Leaflet CSS is imported
import 'leaflet/dist/leaflet.css';

// Check L.Icon.Default paths
delete L.Icon.Default.prototype._getIconUrl;
```

## 📚 Best Practices

### Component Organization
```javascript
// ✅ Good
const Dashboard = () => {
  const [devices, setDevices] = useState([]);
  
  useEffect(() => {
    fetchDevices();
  }, []);

  return (
    <div className="dashboard">
      {/* content */}
    </div>
  );
};

// ❌ Avoid
const Dashboard = (props) => {
  // Too many responsibilities
  // Complex logic mixed with UI
};
```

### Performance
```javascript
// Use useMemo for expensive calculations
const expensiveValue = useMemo(() => {
  return complexCalculation(data);
}, [data]);

// Use useCallback for stable function references
const handleClick = useCallback(() => {
  doSomething();
}, []);

// Lazy load routes
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
```

### Error Handling
```javascript
try {
  const data = await fetchData();
  setData(data);
} catch (error) {
  toast.error('Failed to fetch data');
  console.error('Fetch error:', error);
}
```

## 🔐 Security

- ✅ Store tokens in localStorage (consider httpOnly cookies)
- ✅ Validate all user inputs
- ✅ Use HTTPS in production
- ✅ Sanitize HTML content
- ✅ Implement CSRF protection
- ✅ Regular security updates

## 📞 Troubleshooting

### Port 5173 Already in Use
```bash
# Windows
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :5173
kill -9 <PID>

# Or use different port
npm run dev -- --port 3000
```

### Clear Cache
```bash
# Remove node_modules
rm -rf node_modules package-lock.json
npm install

# Clear browser cache
# Dev Tools → Application → Clear Storage
```

### npm Install Issues
```bash
npm cache clean --force
npm install
```

## 📚 Additional Resources

- [React Documentation](https://react.dev/)
- [Vite Guide](https://vitejs.dev/)
- [Chart.js Docs](https://www.chartjs.org/)
- [Leaflet Guide](https://leafletjs.com/)
- [React Router](https://reactrouter.com/)
- [Lucide Icons](https://lucide.dev/)
- [React Toastify](https://fkhadra.github.io/react-toastify/introduction)

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/my-feature`
2. Commit changes: `git commit -am 'Add feature'`
3. Push to branch: `git push origin feature/my-feature`
4. Submit Pull Request

## 📝 Code Style

- Follow ESLint rules
- Use functional components with hooks
- Write meaningful variable names
- Add JSDoc comments for complex functions
- Keep components focused and reusable

---

**For backend details**: See [Backend README](../backend/README.md)
**For system architecture**: See [main README](../README.md)
**For MQTT setup**: See [MQTT_SETUP.md](../MQTT_SETUP.md)
├── .eslintrc.cjs          # Cấu hình ESLint
├── vite.config.js         # Cấu hình Vite
├── package.json           # Dependencies và scripts
└── README.md              # File này
```

## 🔧 Cấu Hình

### Vite Configuration

File `vite.config.js` chứa các cấu hình chính:
- Plugin React với SWC
- Port mặc định: `5173`
- Source map cho development

### ESLint Configuration

File `.eslintrc.cjs` cung cấp:
- Kiểm tra syntax React
- Quy tắc JSX
- Cảnh báo khi sử dụng dependencies

## 🔗 Kết Nối Backend

Frontend kết nối với backend thông qua:
- **Base URL**: ``
- **Endpoints**:
  - `POST /api/auth/login` - Đăng nhập
  - `GET /api/devices` - Lấy danh sách thiết bị
  - `GET /api/telemetry` - Lấy dữ liệu telemetry
  - Xem [MQTT_SETUP.md](../MQTT_SETUP.md) để biết chi tiết

## 📚 Công Nghệ Sử Dụng

- **React 18** - UI Library
- **Vite** - Build tool & dev server
- **ES6+** - Modern JavaScript
- **CSS3** - Styling
- **ESLint** - Code quality

## 🚧 Phát Triển

### Thêm Component Mới

1. Tạo file trong `src/components/`
2. Export component như một default export
3. Import và sử dụng trong Layout hoặc Pages

### Thêm Trang Mới

1. Tạo file JSX trong `src/pages/`
2. Định nghĩa route trong `App.jsx`
3. Thêm menu item trong `Sidebar.jsx`

### Code Style

- Sử dụng functional components với hooks
- Tuân thủ ESLint rules
- Viết comments cho logic phức tạp
- Sử dụng camelCase cho variables/functions
- Sử dụng PascalCase cho component names

## 🐛 Troubleshooting

### Port 5173 đã được sử dụng

```bash
npm run dev -- --port 3000
```

### Hot Module Replacement không hoạt động

- Xóa cache: `rm -rf node_modules/.vite`
- Restart dev server

### ESLint errors

```bash
npm run lint -- --fix
```

## 📞 Liên Hệ & Hỗ Trợ

Để báo cáo lỗi hoặc yêu cầu tính năng, vui lòng tạo issue trong repository.

## 📄 Giấy Phép

Dự án này là một phần của Navis Cloud Project.
