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

| Tính năng | Mô Tả |
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
Vite 8.0          - Build tool
React Router 7    - Client routing
Chart.js 4.5      - Data visualization
Plotly.js 3.5     - Advanced charts
Leaflet 1.9       - Map library
Lucide React 1.8  - Icon library
React Toastify    - Notifications
ESLint 9.0        - Code quality
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
│   │   ├── Tenants.jsx        # Quản lý Tenants (SuperAdmin)
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

## 🎯 Key Pages & Routes

### 🔐 Login (`/login`)
- User authentication (email + password)
- JWT token management
- Remember me option
- Error handling & validation

### 📊 Dashboard (`/`)
- Overview metrics (device count, active alarms, etc.)
- Latest telemetry from all devices
- System health status
- Quick access widgets
- Real-time status updates

### 🏢 Tenants (`/tenants`) - SuperAdmin Only
- List of all Tenants (Companies)
- Tenant status (active/inactive)
- Tenant device limits management
- Tenant subscription info
- Enable/disable tenant actions
- Create/edit/delete tenant

### 🚀 Devices (`/devices`)
- List of devices (filtered by tenant/user)
- Device status indicators (online/offline)
- Device filtering & search
- Device actions (edit, delete, assign, detail)
- Assign device to user
- Real-time device status

### 📋 Device Detail (`/devices/:id`)
- Complete device information
- Telemetry data & history
- Device settings
- Assignment management
- Device actions

### 📈 Charts (`/charts`)
- Real-time data visualization
- Multiple chart types (line, bar, area)
- Time range selector
- Device filtering
- Export data functionality
- Custom date range

### 🗺️ Map (`/map`)
- Interactive map with device markers
- Device location pins
- Click marker for device details
- Real-time location updates
- Zoom & pan controls
- Marker clustering

### 🚨 Alarms (`/alarms`)
- List of all alerts/alarms
- Alarm status (active, resolved, acknowledged)
- Alarm severity levels (info, warning, critical)
- Alarm filtering & sorting
- Alarm detail modal
- Mark as resolved action

### 👥 Users (`/users`)
- User management (admin only)
- Add/edit/delete users
- Role assignment (tenant_admin, operator, viewer)
- User status management
- Password management
- User assignment to devices

## 🔐 Role-Based UI Rendering (Multi-Tenant)

Frontend tự động render giao diện khác nhau dựa trên role của user:

### User Object Structure (từ Backend)
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

### Menu Navigation (Sidebar.jsx) - Example
```javascript
// Kiểm tra role
const isSuperAdmin = user?.role === "admin";
const isTenantAdmin = user?.role_in_tenant === "tenant_admin";
const isOperator = user?.role_in_tenant === "operator";
const isViewer = user?.role_in_tenant === "viewer";

// Render menu dựa trên role
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

### Protected Routes (App.jsx) - Example
```javascript
// Route protection dựa trên role
const ProtectedRoute = ({ allowedRoles }) => {
  const { user } = useContext(AuthContext);

  if (allowedRoles && user) {
    // Kiểm tra role hệ thống hoặc role công ty
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

### Permission Check Utility
```javascript
// Hàm kiểm tra quyền (có thể dùng trong components)
const hasPermission = (action, user) => {
  const permissions = {
    // [action]: [system-level roles, tenant-level roles]
    'view_dashboard': [['admin', 'user'], ['tenant_admin', 'operator', 'viewer']],
    'manage_tenants': [['admin'], []],
    'manage_users': [['admin'], ['tenant_admin']],
    'manage_devices': [['admin'], ['tenant_admin']],
    'control_device': [['admin'], ['tenant_admin', 'operator']],
    'view_device': [['admin'], ['tenant_admin', 'operator', 'viewer']],
  };

  const [sysRoles, tenantRoles] = permissions[action] || [[], []];
  return sysRoles.includes(user.role) || tenantRoles.includes(user.role_in_tenant);
};

// Usage
{hasPermission('manage_users', user) && (
  <button onClick={() => setShowUserModal(true)}>
    Thêm User
  </button>
)}
```

### Data Isolation by Tenant
```javascript
// API calls tự động filter theo tenant (từ JWT token)
// Backend verify tenant_id từ token, không lấy từ frontend

// Ví dụ:
const getDevices = async () => {
  // Backend chỉ trả về device của tenant hiện tại
  const response = await api.get('/api/devices');
  return response.data;
};

// SuperAdmin sẽ nhận API khác
const getTenants = async () => {
  const response = await api.get('/api/tenants');
  return response.data;
};
```

## 🎬 Component Architecture

### Layout Structure
```
App
├── Login (if not authenticated)
└── Layout (if authenticated)
    ├── Header
    ├── Sidebar
    └── Main Content Area
        ├── Dashboard
        ├── Devices
        ├── DeviceDetail
        ├── Charts
        ├── Map
        ├── Alarms
        ├── Users
        └── Tenants (SuperAdmin)
```

### State Management

**Authentication Context** (`contexts/AuthContext.jsx`):
```javascript
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Check token on mount
    const savedToken = localStorage.getItem('access_token');
    if (savedToken) {
      verifyToken(savedToken);
    }
    setLoading(false);
  }, []);
  
  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
```

**WebSocket Context** (`contexts/SocketContext.jsx`):
```javascript
const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const [data, setData] = useState([]);
  const socketRef = useRef(null);
  
  useEffect(() => {
    // Connect WebSocket
    socketRef.current = new WebSocket('ws://localhost:8000/ws');
    
    socketRef.current.onmessage = (event) => {
      setData(prev => [...prev, JSON.parse(event.data)]);
    };
    
    return () => socketRef.current?.close();
  }, []);
  
  return (
    <SocketContext.Provider value={{ data }}>
      {children}
    </SocketContext.Provider>
  );
};
```

## 🔌 API Integration

### API Service Setup (`services/api.js`)
```javascript
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

// Interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired, redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

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

export const updateDevice = async (id, deviceData) => {
  const response = await api.put(`/api/devices/${id}`, deviceData);
  return response.data;
};

export const deleteDevice = async (id) => {
  await api.delete(`/api/devices/${id}`);
};
```

### Using in Components
```javascript
// pages/Devices.jsx
import { useEffect, useState } from 'react';
import { getDevices } from '../services/deviceService';
import { toast } from 'react-toastify';

export default function Devices() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        setLoading(true);
        const data = await getDevices();
        setDevices(data);
      } catch (err) {
        setError(err.message);
        toast.error('Failed to fetch devices');
      } finally {
        setLoading(false);
      }
    };

    fetchDevices();
  }, []);

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="devices-container">
      {devices.map(device => (
        <div key={device.id} className="device-card">
          <h3>{device.name}</h3>
          <p>{device.location}</p>
          <span className={`status ${device.is_active ? 'active' : 'inactive'}`}>
            {device.is_active ? 'Online' : 'Offline'}
          </span>
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
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function TelemetryChart({ data }) {
  const chartData = {
    labels: data.map(d => new Date(d.timestamp).toLocaleTimeString()),
    datasets: [
      {
        label: 'Signal Strength (dB-Hz)',
        data: data.map(d => d.avg_cno_dbhz),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Satellite Count',
        data: data.map(d => d.sat_count),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
      }
    ]
  };

  const options = {
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: 'GNSS Telemetry Data',
      },
    },
  };

  return <Line data={chartData} options={options} />;
}
```

### Map Example
```javascript
// components/DeviceMap.jsx
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export default function DeviceMap({ devices }) {
  const defaultCenter = [21.0285, 105.8542]; // Hanoi

  return (
    <MapContainer center={defaultCenter} zoom={13} style={{ height: '500px', width: '100%' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />
      {devices.map(device => (
        device.latitude && device.longitude && (
          <Marker key={device.id} position={[device.latitude, device.longitude]}>
            <Popup>
              <div>
                <h4>{device.name}</h4>
                <p>Type: {device.device_type}</p>
                <p>Status: {device.is_active ? 'Active' : 'Inactive'}</p>
              </div>
            </Popup>
          </Marker>
        )
      ))}
    </MapContainer>
  );
}
```

## 🧪 Development & Testing

### Hot Module Replacement (HMR)
Vite tự động reload component khi thay đổi code - không cần manual refresh!

```javascript
// App.jsx - No special setup needed with Vite!
// Just write components and save - automatic reload
```

### Browser DevTools
```bash
# React DevTools
# Install: https://react-devtools-tutorial.vercel.app/

# Redux DevTools (if using Redux)
# Install: https://github.com/reduxjs/redux-devtools
```

### Testing with Swagger UI
1. Mở http://localhost:8000/docs (Backend API docs)
2. Test API endpoints
3. Copy cURL examples
4. Verify response in browser DevTools Network tab

### Manual Testing Checklist
- [ ] Login works with valid credentials
- [ ] Invalid credentials show error
- [ ] Can view devices list
- [ ] Device detail loads
- [ ] Charts display data
- [ ] Map shows markers
- [ ] Alarms appear correctly
- [ ] User management works (admin only)
- [ ] Responsive on mobile
- [ ] No console errors
- [ ] Token refresh works

## 🎨 Styling

### CSS Organization
```css
/* index.css - Global styles */
:root {
  --primary: #3b82f6;
  --secondary: #10b981;
  --danger: #ef4444;
  --warning: #f59e0b;
  --dark: #1f2937;
  --light: #f3f4f6;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto;
  color: var(--dark);
  background: var(--light);
}

/* Component-scoped CSS */
.device-card {
  padding: 1rem;
  border-radius: 8px;
  background: white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  transition: transform 0.2s;
}

.device-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
```

### Responsive Design
```css
/* Mobile first approach */
.container {
  padding: 1rem;
  grid-template-columns: 1fr;
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
- Verify network tab for actual errors
```

### 2. Port 5173 Already in Use
```bash
# Find process using port
netstat -ano | findstr :5173

# Kill process or use different port
npm run dev -- --port 3000
```

### 3. HMR Not Working
- Check webpack dev server is running
- Clear browser cache
- Restart npm run dev

### 4. ESLint Errors
```bash
npm run lint -- --fix
```

### 5. Components Not Updating
```javascript
// Ensure you're using hooks correctly
const [value, setValue] = useState(initial);

useEffect(() => {
  // Always include dependency array!
}, [dependencies]);
```

### 6. Chart Not Displaying
```javascript
// Make sure ChartJS is registered
import Chart from 'chart.js/auto';  // Or manual registration

// Check data format matches chart type
```

### 7. Map Not Loading
```javascript
// Must import Leaflet CSS
import 'leaflet/dist/leaflet.css';

// Fix default icon paths (see example above)
```

## 📚 Best Practices

### Component Organization
```javascript
// ✅ Good - Single responsibility
const DeviceCard = ({ device, onSelect }) => {
  return (
    <div onClick={() => onSelect(device)}>
      <h3>{device.name}</h3>
      <p>{device.location}</p>
    </div>
  );
};

// ❌ Avoid - Too many responsibilities
const DeviceList = (props) => {
  // Complex logic + API calls + UI rendering all mixed
};
```

### Performance
```javascript
// Use useMemo for expensive calculations
const expensiveValue = useMemo(() => {
  return devices.filter(d => d.is_active).sort(...);
}, [devices]);

// Use useCallback for stable function references
const handleSelect = useCallback((device) => {
  fetchDeviceDetails(device.id);
}, []);

// Lazy load routes
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
<Suspense fallback={<Loading />}>
  <Dashboard />
</Suspense>
```

### Error Handling
```javascript
try {
  const data = await fetchData();
  setData(data);
} catch (error) {
  toast.error('Failed to fetch data');
  console.error('Fetch error:', error);
} finally {
  setLoading(false);
}
```

## 🔐 Security

- ✅ Store tokens in localStorage (consider httpOnly cookies for production)
- ✅ Validate all user inputs
- ✅ Use HTTPS in production
- ✅ Sanitize HTML content (XSS prevention)
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
