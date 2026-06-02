// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext'; 
import { ToastContainer } from 'react-toastify'; 
import 'react-toastify/dist/ReactToastify.css';

// Import Layout Components
import Sidebar from './components/Sidebar'; // Đảm bảo đường dẫn này đúng với project của bạn

// Import Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import DeviceDetail from './pages/DeviceDetail'; 
import Map from './pages/Map';
import Charts from './pages/Charts';
import Alarms from './pages/Alarms';
import Users from './pages/Users';

/**
 * 🎨 MAIN LAYOUT: Bố cục chuẩn dành cho các trang đã đăng nhập
 * Mọi trang con sẽ tự động được chèn vào vị trí của <Outlet />
 */
const MainLayout = () => {
  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Outlet /> 
      </div>
    </div>
  );
};

function App() {
  return (
    <SocketProvider> 
      {/* Cấu hình Toast chung toàn App */}
      <ToastContainer position="top-right" autoClose={3000} theme="dark" />
      
      <BrowserRouter>
        <Routes>
          {/* Nhóm 1: Các trang Public (Không có Sidebar) */}
          <Route path="/" element={<Login />} />
          
          {/* Nhóm 2: Các trang Private (Được bọc bên trong MainLayout có Sidebar) */}
          <Route element={<MainLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/devices" element={<Devices />} />
            <Route path="/devices/:deviceId" element={<DeviceDetail />} />
            <Route path="/map" element={<Map />} />
            <Route path="/charts" element={<Charts />} />
            <Route path="/alarms" element={<Alarms />} />
            <Route path="/users" element={<Users />} />
          </Route>
          
          {/* Chuyển hướng nếu gõ sai đường dẫn */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SocketProvider>
  );
}

export default App;