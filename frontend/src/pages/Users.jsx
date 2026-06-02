// src/pages/Users.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users as UsersIcon, UserPlus, KeyRound, Trash2, X, ShieldCheck, User } from 'lucide-react';
// Import thư viện thông báo
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const API_URL = "/api/users";

const Users = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [currentAdminEmail, setCurrentAdminEmail] = useState('');
    
    // Quản lý Modal Thêm mới
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newUser, setNewUser] = useState({ email: '', password: '', role: 'user' });

    // Quản lý Modal Đổi mật khẩu
    const [isPassModalOpen, setIsPassModalOpen] = useState(false);
    const [targetUserId, setTargetUserId] = useState(null);
    const [newPassword, setNewPassword] = useState('');

    // Hàm lấy Payload từ JWT
    const getJwtPayload = () => {
        const token = localStorage.getItem("navis_token");
        if (!token) return null;
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            return JSON.parse(decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
        } catch (e) {
            return null;
        }
    };

    // Kiểm tra quyền (Gatekeeper) & Load dữ liệu
    useEffect(() => {
        const payload = getJwtPayload();
        
        if (!payload) {
            navigate('/');
            return;
        }
        
        if (payload.role !== "admin") {
            toast.error("Bạn không có quyền truy cập trang này!");
            navigate('/dashboard');
            return;
        }

        setCurrentAdminEmail(payload.sub);
        fetchUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigate]);

    const fetchUsers = async () => {
        const token = localStorage.getItem("navis_token");
        try {
            const res = await fetch(API_URL, { headers: { "Authorization": `Bearer ${token}` } });
            if (!res.ok) throw new Error("Lỗi xác thực");
            const data = await res.json();
            setUsers(data);
        } catch (err) {
            toast.error("Lỗi khi tải danh sách người dùng");
        }
    };

    // Hành động: Thêm User Mới
    const handleAddUser = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem("navis_token");
        try {
            const res = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify(newUser)
            });
            if (res.ok) {
                setIsAddModalOpen(false);
                setNewUser({ email: '', password: '', role: 'user' });
                fetchUsers();
                toast.success("Tạo tài khoản thành công!");
            } else {
                const err = await res.json();
                toast.error("Lỗi: " + err.detail);
            }
        } catch (error) { toast.error("Lỗi kết nối Server"); }
    };

    // Hành động: Đổi Mật khẩu
    const handleChangePassword = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem("navis_token");
        try {
            const res = await fetch(`${API_URL}/${targetUserId}/password`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ new_password: newPassword })
            });
            if (res.ok) {
                setIsPassModalOpen(false);
                setNewPassword('');
                toast.success("Đã đổi mật khẩu thành công!");
            } else {
                toast.error("Có lỗi xảy ra khi đổi mật khẩu");
            }
        } catch (error) { toast.error("Lỗi kết nối Server"); }
    };

    // Hành động: Xóa User
    const handleDeleteUser = async (id, email) => {
        if (!window.confirm(`CẢNH BÁO: Bạn có chắc chắn muốn XÓA vĩnh viễn tài khoản [${email}] không? Mọi dữ liệu thiết bị của người này sẽ bị xóa theo.`)) return;
        
        const token = localStorage.getItem("navis_token");
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
                toast.error("Lỗi: " + err.detail);
            }
        } catch (error) { toast.error("Lỗi kết nối Server"); }
    };

    return (
            <>

            <div className="dashboard-container">
                {/* Tiêu đề trang */}
                <div className="header-section">
                    <h1 className="header-title">System Administration</h1>
                </div>

                {/* Bảng Dữ Liệu */}
                <div style={{ backgroundColor: '#1c1e22', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.03)', padding: '30px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem', fontWeight: '600', color: '#ffffff' }}>
                            <UsersIcon size={24} color="#10b981" />
                            Quản Lý Người Dùng 
                            <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '2px 10px', borderRadius: '12px', fontSize: '0.9rem' }}>
                                {users.length}
                            </span>
                        </div>
                        <button 
                            onClick={() => setIsAddModalOpen(true)}
                            style={{ background: '#10b981', color: '#131517', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}
                            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            <UserPlus size={20} /> Thêm Tài Khoản
                        </button>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr>
                                    <th style={{ color: '#8b8d93', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase' }}>ID</th>
                                    <th style={{ color: '#8b8d93', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase' }}>Email</th>
                                    <th style={{ color: '#8b8d93', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase' }}>Quyền</th>
                                    <th style={{ color: '#8b8d93', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'right' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => {
                                    const isSelf = u.email === currentAdminEmail;
                                    const isSuperAdmin = u.id === 1; // Giả sử ID 1 là Root Admin

                                    return (
                                        <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background-color 0.2s' }}>
                                            <td style={{ padding: '18px 10px', color: '#a3a3a3', fontWeight: '500' }}>#{u.id}</td>
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
                                            <td style={{ padding: '18px 10px' }}>
                                                {u.role === 'admin' ? (
                                                    <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                        <ShieldCheck size={16} /> Admin
                                                    </span>
                                                ) : (
                                                    <span style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                        <User size={16} /> User
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: '18px 10px', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                                    <button 
                                                        onClick={() => { setTargetUserId(u.id); setIsPassModalOpen(true); }}
                                                        style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#a3a3a3', cursor: 'pointer', padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}
                                                        onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                                                        onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#a3a3a3'; }}
                                                    >
                                                        <KeyRound size={16} /> Đổi MK
                                                    </button>

                                                    {(!isSelf && !isSuperAdmin) && (
                                                        <button 
                                                            onClick={() => handleDeleteUser(u.id, u.email)}
                                                            style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}
                                                            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; e.currentTarget.style.color = '#ef4444'; }}
                                                            onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = '#ef4444'; }}
                                                        >
                                                            <Trash2 size={16} /> Xóa
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* MODAL THÊM MỚI */}
            {isAddModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ background: '#1c1e22', padding: '32px', borderRadius: '16px', width: '420px', border: '1px solid rgba(16, 185, 129, 0.3)', position: 'relative', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }}>
                        <button 
                            onClick={() => setIsAddModalOpen(false)} 
                            style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: '#8b8d93', cursor: 'pointer', transition: 'color 0.2s' }}
                            onMouseOver={(e) => e.currentTarget.style.color = '#fff'}
                            onMouseOut={(e) => e.currentTarget.style.color = '#8b8d93'}
                        >
                            <X size={24} />
                        </button>
                        
                        <h2 style={{ color: '#ffffff', marginBottom: '25px', fontSize: '1.4rem' }}>
                            Thêm <span style={{ color: '#10b981' }}>Người Dùng</span>
                        </h2>
                        
                        <form onSubmit={handleAddUser}>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', color: '#8b8d93', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '500' }}>Email</label>
                                <input 
                                    type="email" 
                                    required 
                                    value={newUser.email} 
                                    onChange={(e) => setNewUser({...newUser, email: e.target.value})} 
                                    style={{ width: '100%', padding: '14px', background: '#131517', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', color: 'white', outline: 'none', transition: 'border-color 0.3s' }} 
                                    onFocus={(e) => e.target.style.borderColor = '#10b981'}
                                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.05)'}
                                />
                            </div>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', color: '#8b8d93', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '500' }}>Mật khẩu</label>
                                <input 
                                    type="password" 
                                    required 
                                    value={newUser.password} 
                                    onChange={(e) => setNewUser({...newUser, password: e.target.value})} 
                                    style={{ width: '100%', padding: '14px', background: '#131517', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', color: 'white', outline: 'none', transition: 'border-color 0.3s' }} 
                                    onFocus={(e) => e.target.style.borderColor = '#10b981'}
                                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.05)'}
                                />
                            </div>
                            <div style={{ marginBottom: '25px' }}>
                                <label style={{ display: 'block', color: '#8b8d93', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '500' }}>Vai trò (Role)</label>
                                <select 
                                    value={newUser.role} 
                                    onChange={(e) => setNewUser({...newUser, role: e.target.value})} 
                                    style={{ width: '100%', padding: '14px', background: '#131517', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', color: 'white', outline: 'none', cursor: 'pointer', appearance: 'none' }}
                                >
                                    <option value="user">User (Chỉ xem thiết bị của mình)</option>
                                    <option value="admin">Admin (Toàn quyền hệ thống)</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button 
                                    type="button" 
                                    onClick={() => setIsAddModalOpen(false)} 
                                    style={{ background: 'transparent', color: '#8b8d93', border: '1px solid rgba(255,255,255,0.1)', padding: '12px 24px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s' }}
                                    onMouseOver={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
                                    onMouseOut={(e) => { e.currentTarget.style.color = '#8b8d93'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                                >
                                    Hủy
                                </button>
                                <button 
                                    type="submit" 
                                    style={{ background: '#10b981', color: '#131517', border: 'none', padding: '12px 24px', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.2)' }}
                                    onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                    onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                >
                                    Tạo tài khoản
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL ĐỔI MẬT KHẨU */}
            {isPassModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ background: '#1c1e22', padding: '32px', borderRadius: '16px', width: '420px', border: '1px solid rgba(16, 185, 129, 0.3)', position: 'relative', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }}>
                        <button 
                            onClick={() => setIsPassModalOpen(false)} 
                            style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: '#8b8d93', cursor: 'pointer', transition: 'color 0.2s' }}
                            onMouseOver={(e) => e.currentTarget.style.color = '#fff'}
                            onMouseOut={(e) => e.currentTarget.style.color = '#8b8d93'}
                        >
                            <X size={24} />
                        </button>
                        
                        <h2 style={{ color: '#ffffff', marginBottom: '25px', fontSize: '1.4rem' }}>
                            Đổi <span style={{ color: '#10b981' }}>Mật Khẩu</span>
                        </h2>
                        
                        <form onSubmit={handleChangePassword}>
                            <div style={{ marginBottom: '25px' }}>
                                <label style={{ display: 'block', color: '#8b8d93', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '500' }}>Mật khẩu mới</label>
                                <input 
                                    type="password" 
                                    required 
                                    minLength="6" 
                                    value={newPassword} 
                                    onChange={(e) => setNewPassword(e.target.value)} 
                                    style={{ width: '100%', padding: '14px', background: '#131517', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', color: 'white', outline: 'none', transition: 'border-color 0.3s' }} 
                                    onFocus={(e) => e.target.style.borderColor = '#10b981'}
                                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.05)'}
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button 
                                    type="button" 
                                    onClick={() => setIsPassModalOpen(false)} 
                                    style={{ background: 'transparent', color: '#8b8d93', border: '1px solid rgba(255,255,255,0.1)', padding: '12px 24px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s' }}
                                    onMouseOver={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
                                    onMouseOut={(e) => { e.currentTarget.style.color = '#8b8d93'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                                >
                                    Hủy
                                </button>
                                <button 
                                    type="submit" 
                                    style={{ background: '#10b981', color: '#131517', border: 'none', padding: '12px 24px', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.2)' }}
                                    onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                    onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                >
                                    Cập nhật
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

export default Users;