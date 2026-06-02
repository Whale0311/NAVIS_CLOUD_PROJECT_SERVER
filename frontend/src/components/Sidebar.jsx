// src/components/Sidebar.jsx
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
    LayoutDashboard, Map as MapIcon, BarChart2, 
    Cpu, Bell, Users, LogOut, Menu, ChevronsLeft 
} from 'lucide-react';

const Sidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isCollapsed, setIsCollapsed] = useState(false);

    const getUserRole = () => {
        try {
            const token = localStorage.getItem("navis_token");
            if (!token) return "user";
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
            return payload.role || "user";
        } catch (e) { return "user"; }
    };

    const isAdmin = getUserRole() === "admin";
    const handleLogout = () => {
        localStorage.removeItem("navis_token");
        navigate('/');
    };
    const getNavItemClass = (path) => location.pathname === path ? "nav-item active" : "nav-item";

    return (
        <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
            
            <div className="sidebar-header">
                {/* Khối Logo: Không dùng {!isCollapsed} nữa, dùng class CSS */}
                <div className={`logo-container ${isCollapsed ? 'hidden-logo' : ''}`}>
                    <span style={{ fontWeight: '900', color: '#fff', fontSize: '1.25rem', letterSpacing: '1px' }}>NAVIS</span>
                    <span style={{ fontWeight: '700', color: '#10b981', fontSize: '1.25rem' }}>-CLOUD</span>
                </div>
                
                {/* Nút Toggle */}
                <button 
                    className="toggle-btn" 
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    title={isCollapsed ? "Mở rộng" : "Thu gọn"}
                >
                    {isCollapsed ? <Menu size={20} /> : <ChevronsLeft size={20} />}
                </button>
            </div>
            
            <div className="nav-menu-container">
                <ul className="nav-menu">
                    <li className={getNavItemClass('/dashboard')} onClick={() => navigate('/dashboard')} title="Overview">
                        <LayoutDashboard size={20} className="nav-icon" />
                        {!isCollapsed && <span>Overview</span>}
                    </li>
                    <li className={getNavItemClass('/map')} onClick={() => navigate('/map')} title="Map">
                        <MapIcon size={20} className="nav-icon" />
                        {!isCollapsed && <span>Map</span>}
                    </li>
                    <li className={getNavItemClass('/charts')} onClick={() => navigate('/charts')} title="Charts">
                        <BarChart2 size={20} className="nav-icon" />
                        {!isCollapsed && <span>Charts</span>}
                    </li>
                    
                    {/* Đã xóa Menu Divider theo yêu cầu */}

                    <li className={getNavItemClass('/devices')} onClick={() => navigate('/devices')} title="Devices">
                        <Cpu size={20} className="nav-icon" />
                        {!isCollapsed && <span>Devices</span>}
                    </li>
                    <li className={getNavItemClass('/alarms')} onClick={() => navigate('/alarms')} title="Alarms">
                        <Bell size={20} className="nav-icon" />
                        {!isCollapsed && <span>Alarms</span>}
                    </li>
                    
                    {isAdmin && (
                        <li className={getNavItemClass('/users')} onClick={() => navigate('/users')} title="Users Manage">
                            <Users size={20} className="nav-icon" />
                            {!isCollapsed && <span>Users Manage</span>}
                        </li>
                    )}
                </ul>
            </div>

            <div className="sidebar-footer">
                <div className="nav-item logout-btn" onClick={handleLogout} title="Log Out">
                    <LogOut size={20} className="nav-icon" />
                    {!isCollapsed && <span>Log Out</span>}
                </div>
            </div>
        </div>
    );
};

export default Sidebar;