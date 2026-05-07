// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import Map from './pages/Map';
import Charts from './pages/Charts';
import Alarms from './pages/Alarms';
import Users from './pages/Users';
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Trang chủ mặc định sẽ là Login */}
        <Route path="/" element={<Login />} />
        
        {/* Các trang sau này sẽ bọc trong Layout (có Sidebar) */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/devices" element={<Devices />} />
        <Route path="/map" element={<Map />} />
        <Route path="/charts" element={<Charts />} />
        <Route path="/alarms" element={<Alarms />} />
        <Route path="/users" element={<Users />} />
        {/* Nếu gõ sai URL, back về Dashboard */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;