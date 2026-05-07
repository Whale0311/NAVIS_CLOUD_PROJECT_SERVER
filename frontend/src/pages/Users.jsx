import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Users as UsersIcon, UserPlus, KeyRound, Trash2, X, ShieldCheck, User } from 'lucide-react';

const API_URL = "http://127.0.0.1:8000/api/users";

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
            alert("Bạn không có quyền truy cập trang này!");
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
            console.error(err);
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
                alert("Tạo tài khoản thành công!");
            } else {
                const err = await res.json();
                alert("Lỗi: " + err.detail);
            }
        } catch (error) { alert("Lỗi kết nối Server"); }
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
                alert("Đã đổi mật khẩu thành công!");
            } else {
                alert("Có lỗi xảy ra");
            }
        } catch (error) { alert("Lỗi kết nối Server"); }
    };

    // Hành động: Xóa User
    const handleDeleteUser = async (id, email) => {
        if (!window.confirm(`Cảnh báo: Bạn có chắc chắn muốn XÓA vĩnh viễn tài khoản [${email}] không? Mọi dữ liệu thiết bị của người này sẽ bị xóa theo.`)) return;
        
        const token = localStorage.getItem("navis_token");
        try {
            const res = await fetch(`${API_URL}/${id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                fetchUsers();
            } else {
                const err = await res.json();
                alert("Lỗi: " + err.detail);
            }
        } catch (error) { alert("Lỗi kết nối Server"); }
    };

    return (
        <Layout>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#e2e8f0', marginBottom: '30px' }}>
                System Administration
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.02)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', padding: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', fontWeight: 'bold', color: '#ffffff' }}>
                        <UsersIcon size={24} color="#10b981" />
                        Quản Lý Người Dùng (<span style={{ color: '#10b981' }}>{users.length}</span>)
                    </div>
                    <button 
                        onClick={() => setIsAddModalOpen(true)}
                        style={{ background: '#10b981', color: '#000', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <UserPlus size={18} /> Thêm Tài Khoản
                    </button>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr>
                            <th style={{ color: '#94a3b8', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.1)', fontWeight: '600', textTransform: 'uppercase' }}>ID</th>
                            <th style={{ color: '#94a3b8', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.1)', fontWeight: '600', textTransform: 'uppercase' }}>Email</th>
                            <th style={{ color: '#94a3b8', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.1)', fontWeight: '600', textTransform: 'uppercase' }}>Quyền</th>
                            <th style={{ color: '#94a3b8', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => {
                            const isSelf = u.email === currentAdminEmail;
                            const isSuperAdmin = u.id === 1; // Giả sử ID 1 là Root Admin

                            return (
                                <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: '0.2s' }}>
                                    <td style={{ padding: '18px 10px', color: '#a3a3a3' }}>#{u.id}</td>
                                    <td style={{ padding: '18px 10px', fontWeight: '500', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {u.email}
                                        {isSelf && <span style={{ color: '#10b981', fontSize: '0.8rem', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>Bạn</span>}
                                    </td>
                                    <td style={{ padding: '18px 10px' }}>
                                        {u.role === 'admin' ? (
                                            <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                <ShieldCheck size={14} /> Admin
                                            </span>
                                        ) : (
                                            <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                <User size={14} /> User
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ padding: '18px 10px', textAlign: 'right' }}>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                            <button 
                                                onClick={() => { setTargetUserId(u.id); setIsPassModalOpen(true); }}
                                                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#a3a3a3', cursor: 'pointer', padding: '6px 12px', borderRadius: '6px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                                                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                                                onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#a3a3a3'; }}
                                            >
                                                <KeyRound size={16} /> Đổi MK
                                            </button>

                                            {(!isSelf && !isSuperAdmin) && (
                                                <button 
                                                    onClick={() => handleDeleteUser(u.id, u.email)}
                                                    style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#a3a3a3', cursor: 'pointer', padding: '6px 12px', borderRadius: '6px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                                                    onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; e.currentTarget.style.color = '#ef4444'; }}
                                                    onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#a3a3a3'; }}
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

            {/* MODAL THÊM MỚI */}
            {isAddModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ background: '#1a1a1a', padding: '30px', borderRadius: '16px', width: '420px', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
                        <button onClick={() => setIsAddModalOpen(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: '#a3a3a3', cursor: 'pointer' }}><X size={24} /></button>
                        <h2 style={{ color: '#10b981', marginBottom: '25px', fontSize: '1.4rem' }}>Thêm Người Dùng</h2>
                        
                        <form onSubmit={handleAddUser}>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', color: '#a3a3a3', marginBottom: '8px', fontWeight: '500' }}>Email</label>
                                <input type="email" required value={newUser.email} onChange={(e) => setNewUser({...newUser, email: e.target.value})} style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', outline: 'none' }} />
                            </div>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', color: '#a3a3a3', marginBottom: '8px', fontWeight: '500' }}>Mật khẩu</label>
                                <input type="password" required value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', outline: 'none' }} />
                            </div>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', color: '#a3a3a3', marginBottom: '8px', fontWeight: '500' }}>Vai trò (Role)</label>
                                <select value={newUser.role} onChange={(e) => setNewUser({...newUser, role: e.target.value})} style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', outline: 'none' }}>
                                    <option value="user">User (Chỉ xem thiết bị của mình)</option>
                                    <option value="admin">Admin (Toàn quyền hệ thống)</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '30px' }}>
                                <button type="button" onClick={() => setIsAddModalOpen(false)} style={{ background: 'transparent', color: '#a3a3a3', border: '1px solid rgba(255,255,255,0.2)', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}>Hủy</button>
                                <button type="submit" style={{ background: '#10b981', color: '#000', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Tạo tài khoản</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL ĐỔI MẬT KHẨU */}
            {isPassModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ background: '#1a1a1a', padding: '30px', borderRadius: '16px', width: '420px', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
                        <button onClick={() => setIsPassModalOpen(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: '#a3a3a3', cursor: 'pointer' }}><X size={24} /></button>
                        <h2 style={{ color: '#10b981', marginBottom: '25px', fontSize: '1.4rem' }}>Đổi Mật Khẩu</h2>
                        
                        <form onSubmit={handleChangePassword}>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', color: '#a3a3a3', marginBottom: '8px', fontWeight: '500' }}>Mật khẩu mới</label>
                                <input type="password" required minLength="6" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', outline: 'none' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '30px' }}>
                                <button type="button" onClick={() => setIsPassModalOpen(false)} style={{ background: 'transparent', color: '#a3a3a3', border: '1px solid rgba(255,255,255,0.2)', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}>Hủy</button>
                                <button type="submit" style={{ background: '#10b981', color: '#000', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Cập nhật</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default Users;