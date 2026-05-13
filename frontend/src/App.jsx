// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext'; // ==== 1. IMPORT CÁI NÀY ====

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import DeviceDetail from './pages/DeviceDetail'; 
import Map from './pages/Map';
import Charts from './pages/Charts';
import Alarms from './pages/Alarms';
import Users from './pages/Users';

function App() {
  return (
    // ==== 2. BỌC SOCKET PROVIDER Ở NGOÀI CÙNG ====
    <SocketProvider> 
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/devices/:deviceId" element={<DeviceDetail />} />
          <Route path="/map" element={<Map />} />
          <Route path="/charts" element={<Charts />} />
          <Route path="/alarms" element={<Alarms />} />
          <Route path="/users" element={<Users />} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SocketProvider>
  );
}

export default App;