// src/components/Sidebar.jsx
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
    LayoutDashboard, Map as MapIcon, BarChart2, 
    Cpu, Bell, Users, LogOut 
} from 'lucide-react';

const Sidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();

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

    const getNavItemClass = (path) => {
        return location.pathname === path ? "nav-item active" : "nav-item";
    };

    return (
        <div className="sidebar">
            {/* LOGO ĐÃ ĐƯỢC LÀM NỔI BẬT */}
            <div className="sidebar-header">
                <div className="logo-brand">
                    NAVIS<span className="logo-highlight">-CLOUD</span>
                </div>
            </div>
            
            <ul className="nav-menu">
                <li className={getNavItemClass('/dashboard')} onClick={() => navigate('/dashboard')}>
                    <LayoutDashboard size={22} className="nav-icon" />
                    <span>Overview</span>
                </li>
                <li className={getNavItemClass('/map')} onClick={() => navigate('/map')}>
                    <MapIcon size={22} className="nav-icon" />
                    <span>Map</span>
                </li>
                <li className={getNavItemClass('/charts')} onClick={() => navigate('/charts')}>
                    <BarChart2 size={22} className="nav-icon" />
                    <span>Charts</span>
                </li>
                
                {/* Một đường kẻ mờ nhỏ để phân cách nhẹ nhàng thay vì dùng chữ */}
                <div className="menu-divider"></div>

                <li className={getNavItemClass('/devices')} onClick={() => navigate('/devices')}>
                    <Cpu size={22} className="nav-icon" />
                    <span>Devices</span>
                </li>
                <li className={getNavItemClass('/alarms')} onClick={() => navigate('/alarms')}>
                    <Bell size={22} className="nav-icon" />
                    <span>Alarms</span>
                </li>
                
                {isAdmin && (
                    <li className={getNavItemClass('/users')} onClick={() => navigate('/users')}>
                        <Users size={22} className="nav-icon" />
                        <span>Users Manage</span>
                    </li>
                )}
            </ul>

            <div className="sidebar-footer">
                <div className="nav-item logout-btn" onClick={handleLogout}>
                    <LogOut size={22} className="nav-icon" />
                    <span>Log Out</span>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;