// src/components/Sidebar.jsx
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const Sidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Hàm lấy Role từ JWT Token
    const getUserRole = () => {
        try {
            const token = localStorage.getItem("navis_token");
            if (!token) return "user";
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
            return payload.role || "user";
        } catch (e) {
            return "user";
        }
    };

    const isAdmin = getUserRole() === "admin";

    const handleLogout = () => {
        localStorage.removeItem("navis_token");
        navigate('/');
    };

    // Hàm kiểm tra menu nào đang được chọn
    const getNavItemClass = (path) => {
        return location.pathname === path ? "nav-item active" : "nav-item";
    };

    return (
        <div className="sidebar">
            <div className="logo">Navis-cloud</div>
            
            {/* Các menu chính */}
            <ul className="nav-menu">
                <li className={getNavItemClass('/dashboard')} onClick={() => navigate('/dashboard')}>⊞ DASHBOARD</li>
                <li className={getNavItemClass('/map')} onClick={() => navigate('/map')}>🗺 MAP</li>
                <li className={getNavItemClass('/charts')} onClick={() => navigate('/charts')}>📈 CHARTS</li>
                <li className={getNavItemClass('/devices')} onClick={() => navigate('/devices')}>🎛 DEVICES</li>
                <li className={getNavItemClass('/alarms')} onClick={() => navigate('/alarms')}>🔔 ALARMS</li>
                
                {/* Menu Admin nằm ngay dưới Alarms và giữ nguyên style như các tab khác */}
                {isAdmin && (
                    <li className={getNavItemClass('/users')} onClick={() => navigate('/users')}>
                        👥 USERS
                    </li>
                )}
            </ul>

            {/* Chỉ có nút Logout bị ép xuống dưới cùng */}
            <div style={{ marginTop: 'auto' }}>
                <div className="logout-btn" onClick={handleLogout}>🚪 LOG OUT</div>
            </div>
        </div>
    );
};

export default Sidebar;