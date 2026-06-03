// src/components/Sidebar.jsx
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
    LayoutDashboard, Map as MapIcon, BarChart2, 
    Cpu, Bell, Users, LogOut, Menu, ChevronsLeft 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext'; // Import Context Phân quyền

const Sidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isCollapsed, setIsCollapsed] = useState(false);
    
    // Lấy thẳng thông tin user và hàm logout từ AuthContext
    const { user, logout } = useAuth(); 

    // BỨC TƯỜNG LỬA HIỂN THỊ TRÊN UI
    const isSuperAdmin = user?.role === "admin";
    const isTenantAdmin = user?.role_in_tenant === "tenant_admin";
    
    // Chỉ Super Admin và Giám đốc Công ty mới được quản lý nhân sự
    const canManageUsers = isSuperAdmin || isTenantAdmin;

    const handleLogout = () => {
        logout(); // Gọi hàm logout chuẩn từ Context thay vì tự xóa localStorage
    };
    
    const getNavItemClass = (path) => location.pathname === path ? "nav-item active" : "nav-item";

    return (
        <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
            
            <div className="sidebar-header">
                <div className={`logo-container ${isCollapsed ? 'hidden-logo' : ''}`}>
                    <span style={{ fontWeight: '900', color: '#fff', fontSize: '1.25rem', letterSpacing: '1px' }}>NAVIS</span>
                    <span style={{ fontWeight: '700', color: '#10b981', fontSize: '1.25rem' }}>-CLOUD</span>
                </div>
                
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
                    <li className={getNavItemClass('/devices')} onClick={() => navigate('/devices')} title="Devices">
                        <Cpu size={20} className="nav-icon" />
                        {!isCollapsed && <span>Devices</span>}
                    </li>
                    <li className={getNavItemClass('/alarms')} onClick={() => navigate('/alarms')} title="Alarms">
                        <Bell size={20} className="nav-icon" />
                        {!isCollapsed && <span>Alarms</span>}
                    </li>
                    
                    {/* KHÓA PHÂN QUYỀN HIỂN THỊ */}
                    {canManageUsers && (
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