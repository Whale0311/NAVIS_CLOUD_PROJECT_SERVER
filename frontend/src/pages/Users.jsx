// src/pages/Users.jsx
import React, { useState, useEffect } from 'react';
import { Users as UsersIcon, UserPlus, KeyRound, Trash2, X, ShieldCheck, User, Briefcase, Settings, Search } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

const API_URL = "/api/users";

const Users = () => {
    const { user } = useAuth(); 
    const isSuperAdmin = user?.role === 'admin';
    const isTenantAdmin = user?.role_in_tenant === 'tenant_admin';
    const currentEmail = user?.email;

    const [usersList, setUsersList] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    
    // STATE MỚI: Quản lý User đang được click để mở Menu Tùy chọn (Action Modal)
    const [actionModalUser, setActionModalUser] = useState(null);

    // Quản lý các Modal chức năng
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newUser, setNewUser] = useState({ 
        email: '', password: '', role: isSuperAdmin ? 'admin' : 'user',
        role_in_tenant: isSuperAdmin ? 'tenant_admin' : 'viewer', tenant_name: '', max_devices: 5  
    });

    const [isPassModalOpen, setIsPassModalOpen] = useState(false);
    const [targetUserId, setTargetUserId] = useState(null);
    const [passwords, setPasswords] = useState({ old: '', new: '', confirm: '' });

    const [isTenantModalOpen, setIsTenantModalOpen] = useState(false);
    const [editTenantData, setEditTenantData] = useState({ tenant_id: null, max_devices: 5, is_active: true });

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        const token = localStorage.getItem("navis_token") || localStorage.getItem("access_token");
        try {
            const res = await fetch(API_URL, { headers: { "Authorization": `Bearer ${token}` } });
            if (!res.ok) throw new Error("Lỗi tải dữ liệu");
            const data = await res.json();
            setUsersList(data);
        } catch (err) {
            toast.error("Lỗi khi tải danh sách người dùng");
        }
    };

    // ==========================================
    // HANDLERS
    // ==========================================
    const handleAddUser = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem("navis_token") || localStorage.getItem("access_token");
        
        let finalRoleInTenant = newUser.role_in_tenant;
        if (isSuperAdmin && finalRoleInTenant === 'viewer') finalRoleInTenant = 'tenant_admin';
        if (isTenantAdmin) finalRoleInTenant = 'viewer'; 

        const payload = {
            email: newUser.email,
            password: newUser.password,
            role: finalRoleInTenant === 'admin' ? 'admin' : 'user',
            role_in_tenant: finalRoleInTenant,
            ...(isSuperAdmin && finalRoleInTenant === 'tenant_admin' && {
                tenant_name: newUser.tenant_name,
                max_devices: newUser.max_devices
            })
        };

        try {
            const res = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                setIsAddModalOpen(false);
                setNewUser({ 
                    email: '', password: '', role: 'user', role_in_tenant: isSuperAdmin ? 'tenant_admin' : 'viewer',
                    tenant_name: '', max_devices: 5
                });
                fetchUsers();
                toast.success("Tạo tài khoản thành công!");
            } else {
                const err = await res.json();
                toast.error("Lỗi: " + (err.detail || "Không thể tạo tài khoản"));
            }
        } catch (error) { toast.error("Lỗi kết nối Server"); }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        
        if (targetUserId === user?.id) {
            if (!passwords.old) { toast.error("Vui lòng nhập mật khẩu cũ!"); return; }
            if (passwords.new !== passwords.confirm) { toast.error("Mật khẩu xác nhận không khớp!"); return; }
        }

        const token = localStorage.getItem("navis_token") || localStorage.getItem("access_token");
        try {
            const res = await fetch(`${API_URL}/${targetUserId}/password`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ new_password: passwords.new, old_password: passwords.old })
            });
            if (res.ok) {
                setIsPassModalOpen(false);
                setPasswords({ old: '', new: '', confirm: '' });
                toast.success("Đã đổi mật khẩu thành công!");
            } else {
                toast.error("Có lỗi xảy ra khi đổi mật khẩu");
            }
        } catch (error) { toast.error("Lỗi kết nối Server"); }
    };

    const handleDeleteUser = async (id, email) => {
        if (!window.confirm(`CẢNH BÁO: Bạn có chắc chắn muốn XÓA vĩnh viễn tài khoản [${email}] không?`)) return;
        
        const token = localStorage.getItem("navis_token") || localStorage.getItem("access_token");
        try {
            const res = await fetch(`${API_URL}/${id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                toast.success(`Đã xóa tài khoản ${email}`);
                fetchUsers();
            } else {
                const err = await res.json();
                toast.error("Lỗi: " + (err.detail || "Không thể xóa"));
            }
        } catch (error) { toast.error("Lỗi kết nối Server"); }
    };

    const handleUpdateTenant = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem("navis_token") || localStorage.getItem("access_token");
        try {
            const res = await fetch(`/api/tenants/${editTenantData.tenant_id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ max_devices: editTenantData.max_devices, is_active: editTenantData.is_active })
            });
            if (res.ok) {
                setIsTenantModalOpen(false);
                toast.success("Đã cập nhật thông số Tổ chức thành công!");
                fetchUsers(); 
            } else {
                const err = await res.json();
                toast.error("Lỗi: " + (err.detail || "Không thể cập nhật"));
            }
        } catch (error) { toast.error("Lỗi kết nối Server"); }
    };

    const filteredUsers = usersList.filter(u => 
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (u.tenant_name && u.tenant_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // ==========================================
    // STYLES TÁI SỬ DỤNG
    // ==========================================
    const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center' };
    const modalBoxStyle = { background: '#1c1e22', padding: '32px', borderRadius: '16px', width: '420px', border: '1px solid rgba(16, 185, 129, 0.3)', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)' };
    const inputStyle = { width: '100%', padding: '14px', background: '#131517', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', color: 'white', outline: 'none', transition: 'border-color 0.3s' };

    const actionBtnStyle = () => ({
        width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px', 
        background: 'rgba(255,255,255,0.03)', border: `1px solid rgba(255,255,255,0.05)`, 
        borderRadius: '12px', color: '#e2e8f0', fontSize: '1.05rem', fontWeight: '500', 
        cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left'
    });

    return (
        <>
            <div className="dashboard-container">
                <div className="header-section">
                    <h1 className="header-title">{isSuperAdmin ? 'Tenants Manager' : 'Quản Lý Nhân Sự'}</h1>
                </div>

                <div style={{ backgroundColor: '#1c1e22', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.03)', padding: '30px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem', fontWeight: '600', color: '#ffffff' }}>
                            <UsersIcon size={24} color="#10b981" />
                            {isSuperAdmin ? 'Danh sách Tổ chức' : 'Danh sách tài khoản'}
                            <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '2px 10px', borderRadius: '12px', fontSize: '0.9rem' }}>
                                {filteredUsers.length}
                            </span>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                            <div style={{ position: 'relative' }}>
                                <Search size={18} color="#8b8d93" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                <input 
                                    type="text" placeholder="Tìm Email hoặc Tổ chức..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{ ...inputStyle, width: '250px', paddingLeft: '40px', padding: '10px 14px 10px 40px' }}
                                />
                            </div>

                            <button onClick={() => {
                                setNewUser({ email: '', password: '', role: isSuperAdmin ? 'admin' : 'user', role_in_tenant: isSuperAdmin ? 'tenant_admin' : 'viewer', tenant_name: '', max_devices: 5 });
                                setIsAddModalOpen(true);
                            }} className="btn-primary">
                                <UserPlus size={20} /> Thêm Mới
                            </button>
                        </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr>
                                    <th className="table-header">Email</th>
                                    {isSuperAdmin && <th className="table-header">Tổ chức</th>}
                                    {isSuperAdmin && <th className="table-header">Trạng thái</th>}
                                    <th className="table-header">Cấp bậc</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map(u => {
                                    const isSelf = u.email === currentEmail;
                                    const isRootAdmin = u.role === 'admin';

                                    return (
                                        <tr key={u.id} className="user-row" onClick={() => setActionModalUser(u)}>
                                            <td style={{ padding: '18px 10px', fontWeight: '600', color: '#ffffff' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    {u.email}
                                                    {isSelf && (
                                                        <span style={{ color: '#10b981', fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '2px 8px', borderRadius: '6px', fontWeight: '700', textTransform: 'uppercase' }}>
                                                            Bạn
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            
                                            {isSuperAdmin && (
                                                <td style={{ padding: '18px 10px', color: '#e2e8f0' }}>
                                                    {isRootAdmin ? 'Hệ thống (System)' : (u.tenant_name || (u.tenant_id ? `Tenant #${u.tenant_id}` : 'Chưa gắn công ty'))}
                                                </td>
                                            )}

                                            {isSuperAdmin && (
                                                <td style={{ padding: '18px 10px', color: '#e2e8f0' }}>
                                                    {isRootAdmin ? '' : (
                                                        u.tenant_status === false 
                                                        ? <span style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: '600' }}>🔴 Bị khóa</span>
                                                        : <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: '600' }}>🟢 Hoạt động</span>
                                                    )}
                                                </td>
                                            )}

                                            <td style={{ padding: '18px 10px' }}>
                                                {isRootAdmin ? (
                                                    <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                        <ShieldCheck size={16} /> Super Admin
                                                    </span>
                                                ) : u.role_in_tenant === 'tenant_admin' ? (
                                                    <span style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.2)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                        <Briefcase size={16} /> Giám Đốc
                                                    </span>
                                                ) : (
                                                    <span style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                        <User size={16} /> User
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* MODAL MENU THAO TÁC (Hiện khi click vào dòng) */}
            {actionModalUser && (
                <div style={modalOverlayStyle} onClick={() => setActionModalUser(null)}>
                    <div style={{ ...modalBoxStyle, width: '380px', padding: '25px' }} onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setActionModalUser(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: '#8b8d93', cursor: 'pointer' }}>
                            <X size={24} />
                        </button>

                        <h3 style={{ color: '#fff', marginTop: 0, marginBottom: '20px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            Tùy chọn: <span style={{ color: '#10b981' }}>{actionModalUser.email}</span>
                        </h3>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            
                            {/* Nút Đổi MK: Ai cũng có thể thao tác (tự đổi hoặc admin reset) */}
                            <button className="action-btn pass-btn" onClick={() => {
                                setTargetUserId(actionModalUser.id);
                                setPasswords({ old: '', new: '', confirm: '' });
                                setActionModalUser(null);
                                setIsPassModalOpen(true);
                            }} style={actionBtnStyle()}>
                                <KeyRound size={20} /> Đổi mật khẩu
                            </button>

                            {/* Nút Cấu hình: Chỉ hiện nếu Super Admin đang chọn một Giám đốc */}
                            {isSuperAdmin && actionModalUser.role_in_tenant === 'tenant_admin' && (
                                <button className="action-btn config-btn" onClick={() => {
                                    setEditTenantData({ tenant_id: actionModalUser.tenant_id, max_devices: actionModalUser.max_devices || 5, is_active: actionModalUser.tenant_status ?? true });
                                    setActionModalUser(null);
                                    setIsTenantModalOpen(true);
                                }} style={actionBtnStyle()}>
                                    <Settings size={20} /> Cấu hình Tổ chức
                                </button>
                            )}

                            {/* Nút Xóa: Chỉ hiện nếu không phải bản thân và có quyền xóa */}
                            {actionModalUser.email !== currentEmail && (isSuperAdmin || actionModalUser.role !== 'admin') && (
                                <button className="action-btn delete-btn" onClick={() => {
                                    const { id, email } = actionModalUser;
                                    setActionModalUser(null);
                                    handleDeleteUser(id, email);
                                }} style={actionBtnStyle()}>
                                    <Trash2 size={20} /> Xóa tài khoản
                                </button>
                            )}

                        </div>
                    </div>
                </div>
            )}

            {/* CÁC MODAL CHỨC NĂNG (Giao diện giữ nguyên) */}
            
            {/* Modal Thêm Người Dùng */}
            {isAddModalOpen && (
                <div style={modalOverlayStyle}>
                    <div style={{...modalBoxStyle, width: '420px'}}>
                        <button onClick={() => setIsAddModalOpen(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: '#8b8d93', cursor: 'pointer' }}><X size={24} /></button>
                        <h2 style={{ color: '#ffffff', marginBottom: '25px', fontSize: '1.4rem' }}>Thêm <span style={{ color: '#10b981' }}>Tài Khoản</span></h2>
                        <form onSubmit={handleAddUser}>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', color: '#8b8d93', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '500' }}>Email</label>
                                <input type="email" required value={newUser.email} onChange={(e) => setNewUser({...newUser, email: e.target.value})} style={inputStyle} />
                            </div>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', color: '#8b8d93', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '500' }}>Mật khẩu</label>
                                <input type="password" required value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} style={inputStyle} />
                            </div>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', color: '#8b8d93', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '500' }}>Cấp bậc (Role)</label>
                                {isSuperAdmin ? (
                                    <select value={newUser.role_in_tenant} onChange={(e) => setNewUser({...newUser, role_in_tenant: e.target.value})} style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' }}>
                                        <option value="tenant_admin">Giám đốc (Tạo Công ty mới)</option>
                                        <option value="admin">Quản trị viên Hệ thống (Super Admin)</option>
                                    </select>
                                ) : (
                                    <input type="text" disabled value="User (Chỉ xem)" style={{ ...inputStyle, background: 'rgba(255,255,255,0.02)', color: '#a3a3a3', cursor: 'not-allowed' }} />
                                )}
                            </div>
                            {isSuperAdmin && newUser.role_in_tenant === 'tenant_admin' && (
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '15px', marginBottom: '25px', background: 'rgba(16, 185, 129, 0.05)', padding: '15px', borderRadius: '10px', border: '1px dashed rgba(16, 185, 129, 0.2)' }}>
                                    <div>
                                        <label style={{ display: 'block', color: '#10b981', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600' }}>Tên Tổ chức</label>
                                        <input type="text" required placeholder="VD: Vận tải SOICT" value={newUser.tenant_name || ''} onChange={(e) => setNewUser({...newUser, tenant_name: e.target.value})} style={{...inputStyle, padding: '10px'}} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', color: '#10b981', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600' }}>Số thiết bị</label>
                                        <input type="number" required min="1" value={newUser.max_devices || 5} onChange={(e) => setNewUser({...newUser, max_devices: parseInt(e.target.value)})} style={{...inputStyle, padding: '10px'}} />
                                    </div>
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button type="button" onClick={() => setIsAddModalOpen(false)} style={{ background: 'transparent', color: '#8b8d93', border: '1px solid rgba(255,255,255,0.1)', padding: '12px 24px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600' }}>Hủy</button>
                                <button type="submit" style={{ background: '#10b981', color: '#131517', border: 'none', padding: '12px 24px', borderRadius: '10px', cursor: 'pointer', fontWeight: '700' }}>Xác nhận</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Cấu Hình Tenant */}
            {isTenantModalOpen && (
                <div style={modalOverlayStyle}>
                    <div style={{...modalBoxStyle, width: '420px'}}>
                        <button onClick={() => setIsTenantModalOpen(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: '#8b8d93', cursor: 'pointer' }}><X size={24} /></button>
                        <h2 style={{ color: '#ffffff', marginBottom: '25px', fontSize: '1.4rem' }}>Cấu hình <span style={{ color: '#a855f7' }}>Tổ Chức</span></h2>
                        <form onSubmit={handleUpdateTenant}>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', color: '#8b8d93', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '500' }}>Giới hạn số lượng Thiết bị</label>
                                <input type="number" required min="1" value={editTenantData.max_devices} onChange={(e) => setEditTenantData({...editTenantData, max_devices: parseInt(e.target.value)})} style={inputStyle} />
                            </div>
                            <div style={{ marginBottom: '30px' }}>
                                <label style={{ display: 'block', color: '#8b8d93', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '500' }}>Trạng thái hoạt động</label>
                                <select 
                                    value={editTenantData.is_active ? "true" : "false"} 
                                    onChange={(e) => setEditTenantData({...editTenantData, is_active: e.target.value === "true"})} 
                                    style={{ ...inputStyle, cursor: 'pointer', appearance: 'none', color: editTenantData.is_active ? '#10b981' : '#ef4444' }}
                                >
                                    <option value="true">🟢 Đang hoạt động</option>
                                    <option value="false">🔴 Khóa tài khoản (Đình chỉ)</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button type="button" onClick={() => setIsTenantModalOpen(false)} style={{ background: 'transparent', color: '#8b8d93', border: '1px solid rgba(255,255,255,0.1)', padding: '12px 24px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600' }}>Hủy</button>
                                <button type="submit" style={{ background: '#a855f7', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '10px', cursor: 'pointer', fontWeight: '700' }}>Lưu cấu hình</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Đổi Mật Khẩu */}
            {isPassModalOpen && (
                <div style={modalOverlayStyle}>
                    <div style={{...modalBoxStyle, width: '420px'}}>
                        <button onClick={() => setIsPassModalOpen(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: '#8b8d93', cursor: 'pointer' }}><X size={24} /></button>
                        <h2 style={{ color: '#ffffff', marginBottom: '25px', fontSize: '1.4rem' }}>Đổi <span style={{ color: '#10b981' }}>Mật Khẩu</span></h2>
                        <form onSubmit={handleChangePassword}>
                            {targetUserId === user?.id && (
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', color: '#8b8d93', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '500' }}>Mật khẩu hiện tại</label>
                                    <input type="password" required minLength="6" placeholder="Nhập mật khẩu cũ..." value={passwords.old} onChange={(e) => setPasswords({...passwords, old: e.target.value})} style={inputStyle} />
                                </div>
                            )}
                            <div style={{ marginBottom: targetUserId === user?.id ? '20px' : '25px' }}>
                                <label style={{ display: 'block', color: '#8b8d93', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '500' }}>Mật khẩu mới</label>
                                <input type="password" required minLength="6" placeholder="Nhập mật khẩu mới..." value={passwords.new} onChange={(e) => setPasswords({...passwords, new: e.target.value})} style={inputStyle} />
                            </div>
                            {targetUserId === user?.id && (
                                <div style={{ marginBottom: '25px' }}>
                                    <label style={{ display: 'block', color: '#8b8d93', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '500' }}>Xác nhận mật khẩu mới</label>
                                    <input type="password" required minLength="6" placeholder="Nhập lại mật khẩu mới..." value={passwords.confirm} onChange={(e) => setPasswords({...passwords, confirm: e.target.value})} style={{ ...inputStyle, borderColor: (passwords.confirm && passwords.new !== passwords.confirm) ? '#ef4444' : 'rgba(255,255,255,0.05)' }} />
                                    {(passwords.confirm && passwords.new !== passwords.confirm) && <span style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '5px', display: 'block' }}>Mật khẩu không khớp!</span>}
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button type="button" onClick={() => setIsPassModalOpen(false)} style={{ background: 'transparent', color: '#8b8d93', border: '1px solid rgba(255,255,255,0.1)', padding: '12px 24px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600' }}>Hủy</button>
                                <button type="submit" style={{ background: '#10b981', color: '#131517', border: 'none', padding: '12px 24px', borderRadius: '10px', cursor: 'pointer', fontWeight: '700' }}>Cập nhật</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                /* CSS UX Cải tiến cho Users */
                .table-header { color: #8b8d93; font-size: 0.85rem; text-transform: uppercase; padding: 15px 10px; border-bottom: 1px solid rgba(255,255,255,0.05); }
                .user-row { cursor: pointer; transition: all 0.2s ease; border-bottom: 1px solid rgba(255,255,255,0.03); }
                .user-row:hover { background-color: rgba(255,255,255,0.02); }
                
                .btn-primary { background: #10b981; color: #131517; border: none; padding: 10px 20px; border-radius: 10px; cursor: pointer; font-weight: 700; display: flex; align-items: center; gap: 8px; transition: all 0.2s; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2); }
                .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 15px rgba(16, 185, 129, 0.3); }

                /* Action Button Hovers trong Modal */
                .action-btn:hover.pass-btn { border-color: rgba(59, 130, 246, 0.5); color: #3b82f6; background: rgba(59, 130, 246, 0.05); }
                .action-btn:hover.config-btn { border-color: rgba(168, 85, 247, 0.5); color: #a855f7; background: rgba(168, 85, 247, 0.05); }
                .action-btn:hover.delete-btn { border-color: rgba(239, 68, 68, 0.5); color: #ef4444; background: rgba(239, 68, 68, 0.05); }
            `}</style>
        </>
    );
};

export default Users;