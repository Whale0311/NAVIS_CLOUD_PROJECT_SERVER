// src/components/Sidebar.jsx
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
    LayoutDashboard, Map as MapIcon, BarChart2, 
    Cpu, Bell, Users, LogOut, Menu, ChevronsLeft, Building2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext'; 

const Sidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isCollapsed, setIsCollapsed] = useState(false);
    
    const { user, logout } = useAuth(); 

    // BỨC TƯỜNG LỬA HIỂN THỊ TRÊN UI
    const isSuperAdmin = user?.role === "admin";
    const isTenantAdmin = user?.role_in_tenant === "tenant_admin";
    
    // Chỉ Super Admin và Giám đốc Công ty mới được quản lý
    const canManageUsers = isSuperAdmin || isTenantAdmin;

    const handleLogout = () => {
        logout(); 
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
                    {/* OVERVIEW: Ai cũng thấy (Nhưng dữ liệu hiển thị bên trong sẽ khác nhau) */}
                    <li className={getNavItemClass('/dashboard')} onClick={() => navigate('/dashboard')} title="Overview">
                        <LayoutDashboard size={20} className="nav-icon" />
                        {!isCollapsed && <span>Overview</span>}
                    </li>

                    {/* CÁC TAB NGHIỆP VỤ: SUPER ADMIN SẼ KHÔNG ĐƯỢC THẤY */}
                    {!isSuperAdmin && (
                        <>
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
                        </>
                    )}
                    
                    {/* TAB QUẢN LÝ NHÂN SỰ / TỔ CHỨC */}
                    {canManageUsers && (
                        <li className={getNavItemClass('/users')} onClick={() => navigate('/users')} title={isSuperAdmin ? "Tenants Manager" : "Users Manage"}>
                            {/* Đổi Icon cho ngầu hơn nếu là Super Admin */}
                            {isSuperAdmin ? <Building2 size={20} className="nav-icon" /> : <Users size={20} className="nav-icon" />}
                            
                            {!isCollapsed && <span>{isSuperAdmin ? 'Tenants Manager' : 'Users Manage'}</span>}
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