// src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify'; 
import 'react-toastify/dist/ReactToastify.css';

// Import Contexts (Thứ tự bọc rất quan trọng)
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext'; 

// Import Layout & Components
import Sidebar from './components/Sidebar'; 

// Import Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import DeviceDetail from './pages/DeviceDetail'; 
import Map from './pages/Map';
import Charts from './pages/Charts';
import Alarms from './pages/Alarms';
import Users from './pages/Users';

// ==========================================
// 1. COMPONENT BẢO VỆ ROUTE (TƯỜNG LỬA FRONTEND)
// ==========================================
const ProtectedRoute = ({ allowedRoles }) => {
  const { user } = useAuth(); // Lấy thông tin user từ AuthContext

  // 1. Chưa đăng nhập -> Đá văng ra trang Login
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // 2. Kiểm tra quyền hạn (Nếu Route đó yêu cầu cấp bậc cụ thể)
  if (allowedRoles) {
    // So sánh xem role hệ thống (admin) hoặc role công ty (tenant_admin) có nằm trong danh sách cho phép không
    const hasPermission = allowedRoles.includes(user.role) || allowedRoles.includes(user.role_in_tenant);
    
    if (!hasPermission) {
      // toast.error("Bạn không có quyền truy cập trang này!"); // Bật lên nếu muốn báo lỗi rõ ràng
      return <Navigate to="/dashboard" replace />;
    }
  }

  // Hợp lệ -> Cho đi tiếp vào component con
  return <Outlet />;
};


// ==========================================
// 2. MAIN LAYOUT
// ==========================================
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


// ==========================================
// 3. APP ROOT
// ==========================================
function App() {
  return (
    // Bắt buộc phải có BrowserRouter ở ngoài cùng vì AuthProvider dùng useNavigate
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider> 
          
          <ToastContainer position="top-right" autoClose={3000} theme="dark" />
          
          <Routes>
            {/* 🟢 Nhóm 1: Public Route (Trang đăng nhập) */}
            <Route path="/" element={<Login />} />
            
            {/* 🔵 Nhóm 2: Các trang Private cơ bản (Ai đăng nhập cũng xem được) */}
            <Route element={<ProtectedRoute />}>
              <Route element={<MainLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/devices" element={<Devices />} />
                <Route path="/devices/:deviceId" element={<DeviceDetail />} />
                <Route path="/map" element={<Map />} />
                <Route path="/charts" element={<Charts />} />
                <Route path="/alarms" element={<Alarms />} />
                
                {/* 🟠 Nhóm 3: Protected Route Chuyên Sâu (CHỈ Admin / Giám đốc mới được vào) */}
                <Route element={<ProtectedRoute allowedRoles={['admin', 'tenant_admin']} />}>
                  <Route path="/users" element={<Users />} />
                </Route>
              </Route>
            </Route>
            
            {/* Chuyển hướng nếu gõ sai đường dẫn 404 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;