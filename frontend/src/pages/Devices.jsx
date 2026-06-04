// src/pages/Devices.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HardDrive, LineChart, Trash2, X, Plus, Search, Settings, MoreVertical, UserPlus } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../context/AuthContext'; // IMPORT BỘ XỬ LÝ QUYỀN

const API_URL = "/api/devices";

const Devices = () => {
    const navigate = useNavigate();
    const { user } = useAuth(); // Lấy thông tin user hiện tại
    
    // Quyền hạn: Chỉ Super Admin và Giám đốc mới được thêm/sửa/xóa/giao xe
    const canFullControl = user?.role === 'admin' || user?.role_in_tenant === 'tenant_admin';
    const canViewDetails = canFullControl || user?.role_in_tenant === 'operator';
    const [devices, setDevices] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [openMenuId, setOpenMenuId] = useState(null);
    
    // State cho Form thêm mới
    const [newDevice, setNewDevice] = useState({
        device_id: '',
        device_type: 'UBX',
        site_id: ''
    });

    // ==========================================
    // STATE CHO TÍNH NĂNG GIAO XE (ASSIGN)
    // ==========================================
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [assigningDevice, setAssigningDevice] = useState(null);
    const [usersList, setUsersList] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState('');

    useEffect(() => {
        const handleClickOutside = () => setOpenMenuId(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    // ==========================================
    // API CALLS
    // ==========================================
    const loadDevices = async () => {
        const token = localStorage.getItem("navis_token") || localStorage.getItem("access_token");
        try {
            const res = await fetch(API_URL, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.status === 401) {
                localStorage.removeItem("navis_token");
                navigate('/');
                return;
            }
            const data = await res.json();
            setDevices(data);
        } catch (error) {
            toast.error("Lỗi kết nối Server khi lấy danh sách thiết bị");
        }
    };

    // Lấy danh sách nhân viên để hiện trong Dropdown Giao Xe
    const loadUsers = async () => {
        if (!canFullControl) return;
        const token = localStorage.getItem("navis_token") || localStorage.getItem("access_token");
        try {
            const res = await fetch("/api/users", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setUsersList(data);
            }
        } catch (error) { console.error("Không thể tải danh sách user"); }
    };

    useEffect(() => {
        loadDevices();
        if (canManageDevices) loadUsers();
    }, [canManageDevices]);

    // ==========================================
    // HANDLERS
    // ==========================================
    const handleAddSubmit = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem("navis_token") || localStorage.getItem("access_token");
        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}` 
                },
                body: JSON.stringify({
                    device_id: newDevice.device_id,
                    name: newDevice.device_id, 
                    device_type: newDevice.device_type,
                    site_id: newDevice.site_id, 
                    is_active: true
                })
            });
            
            const data = await res.json();
            if (res.ok) {
                setIsModalOpen(false);
                setNewDevice({ device_id: '', device_type: 'UBX', site_id: '' }); 
                toast.success("Đã thêm thiết bị mới thành công!");
                loadDevices(); 
            } else {
                toast.error("Lỗi: " + (data.detail || "Không thể tạo thiết bị"));
            }
        } catch (error) { toast.error("Lỗi kết nối Server"); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("CẢNH BÁO: Bạn có chắc chắn muốn xóa vĩnh viễn thiết bị này khỏi hệ thống?")) return;
        
        const token = localStorage.getItem("navis_token") || localStorage.getItem("access_token");
        try {
            const res = await fetch(`${API_URL}/${id}`, {
                method: 'DELETE',
                headers: { "Authorization": `Bearer ${token}` }
            });
            
            if (res.ok) {
                toast.success("Đã xóa thiết bị thành công!");
                loadDevices(); 
            } else {
                const data = await res.json();
                toast.error("Lỗi: " + (data.detail || "Không thể xóa"));
            }
        } catch (error) { toast.error("Lỗi kết nối Server"); }
    };

    // Hàm Xử Lý Phân Công Xe
    const handleAssignSubmit = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem("navis_token") || localStorage.getItem("access_token");
        try {
            const payload = {
                user_id: selectedUserId ? parseInt(selectedUserId) : null // Trả về null nếu thu hồi
            };

            const res = await fetch(`${API_URL}/${assigningDevice.id}/assign`, {
                method: 'PUT',
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}` 
                },
                body: JSON.stringify(payload)
            });
            
            if (res.ok) {
                setIsAssignModalOpen(false);
                toast.success("Cập nhật phân công thiết bị thành công!");
                loadDevices(); 
            } else {
                const data = await res.json();
                toast.error("Lỗi: " + (data.detail || "Không thể giao xe"));
            }
        } catch (error) { toast.error("Lỗi kết nối Server"); }
    };

    const filteredDevices = devices.filter(dev => 
        dev.device_id && dev.device_id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // ==========================================
    // INLINE STYLES TÁI SỬ DỤNG
    // ==========================================
    const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center' };
    const modalBoxStyle = { background: '#1c1e22', padding: '32px', borderRadius: '16px', width: '420px', border: '1px solid rgba(16, 185, 129, 0.3)', position: 'relative', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' };
    const inputStyle = { width: '100%', padding: '14px', background: '#131517', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', color: 'white', outline: 'none', transition: 'border-color 0.3s' };

    return (
            <>
            <div className="dashboard-container">
                <div className="header-section">
                    <h1 className="header-title">Device Management</h1>
                </div>

                <div style={{ backgroundColor: '#1c1e22', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.03)', padding: '30px' }}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem', fontWeight: '600', color: '#ffffff' }}>
                            Danh Sách Thiết Bị 
                            <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '2px 10px', borderRadius: '12px', fontSize: '0.9rem' }}>
                                {filteredDevices.length}
                            </span>
                        </div>

                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                            <div style={{ position: 'relative' }}>
                                <Search size={18} color="#8b8d93" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                <input 
                                    type="text" 
                                    placeholder="Tìm theo Device ID..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{ ...inputStyle, width: '280px', paddingLeft: '40px' }}
                                />
                            </div>

                            {/* CHỈ QUẢN LÝ MỚI THẤY NÚT THÊM */}
                            {canManageDevices && (
                                <button 
                                    onClick={() => setIsModalOpen(true)}
                                    style={{ background: '#10b981', color: '#131517', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}
                                    onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                    onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                >
                                    <Plus size={20} /> Thêm Thiết Bị
                                </button>
                            )}
                        </div>
                    </div>

                    <div style={{ overflow: 'visible', paddingBottom: '80px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr>
                                    <th style={{ color: '#8b8d93', fontSize: '0.85rem', textTransform: 'uppercase', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Device ID</th>
                                    <th style={{ color: '#8b8d93', fontSize: '0.85rem', textTransform: 'uppercase', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Loại (Type)</th>
                                    <th style={{ color: '#8b8d93', fontSize: '0.85rem', textTransform: 'uppercase', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Kết nối lần cuối</th>
                                    <th style={{ color: '#8b8d93', fontSize: '0.85rem', textTransform: 'uppercase', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Tổ chức</th>
                                    <th style={{ color: '#8b8d93', fontSize: '0.85rem', textTransform: 'uppercase', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>Hành động</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredDevices.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#8b8d93' }}>
                                            Không tìm thấy thiết bị nào trong hệ thống.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredDevices.map(dev => (
                                        <tr key={dev.id} style={{ transition: 'background-color 0.2s', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                            <td style={{ padding: '18px 10px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ffffff', fontWeight: '600' }}>
                                                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '8px', borderRadius: '8px' }}>
                                                        <HardDrive size={18} color="#10b981" />
                                                    </div>
                                                    {dev.device_id}
                                                </div>
                                            </td>
                                            <td style={{ padding: '18px 10px' }}>
                                                <span style={{ background: '#131517', border: '1px solid rgba(255,255,255,0.1)', color: '#a3a3a3', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600' }}>
                                                    {dev.device_type || 'UBX'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '18px 10px', color: '#e2e8f0', fontSize: '0.95rem' }}>
                                                {(() => {
                                                    if (!dev.last_seen) return <span style={{ color: '#10b981' }}>Vừa mới kết nối</span>;
                                                    let rawTime = dev.last_seen;
                                                    if (!rawTime.endsWith('Z') && !rawTime.includes('+')) rawTime += 'Z';
                                                    return new Date(rawTime).toLocaleString('vi-VN');
                                                })()}
                                            </td>
                                            <td style={{ padding: '18px 10px', color: '#e2e8f0', fontSize: '0.95rem' }}>
                                                {/* Hiển thị tên Tenant thay vì owner_email */}
                                                {dev.tenant_name || 'N/A'}
                                            </td>
                                            <td style={{ padding: '18px 10px', textAlign: 'center', position: 'relative' }}>
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setOpenMenuId(openMenuId === dev.id ? null : dev.id);
                                                    }}
                                                    style={{ background: 'transparent', border: 'none', color: '#8b8d93', cursor: 'pointer', padding: '5px' }}
                                                >
                                                    <MoreVertical size={20} />
                                                </button>

                                                {openMenuId === dev.id && (
                                                    <div style={{ position: 'absolute', right: '30px', top: '15px', background: '#2a2d32', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '5px', width: '160px', zIndex: 10, boxShadow: '0 10px 15px rgba(0,0,0,0.5)' }}>
                                                        
                                                        {/* NÚT QUẢN LÝ: Manager và Giám đốc đều thấy */}
                                                        {canViewDetails && (
                                                            <button 
                                                                onClick={(e) => { 
                                                                    e.stopPropagation(); 
                                                                    navigate(`/devices/${dev.device_id}`); 
                                                                }}
                                                                style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', color: '#3b82f6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '4px' }}
                                                                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                                                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                                            >
                                                                <Settings size={16} /> Quản lý
                                                            </button>
                                                        )}

                                                        {/* NÚT PHÂN CÔNG: Chỉ Giám đốc mới thấy */}
                                                        {canFullControl && (
                                                            <button 
                                                                onClick={(e) => { 
                                                                    e.stopPropagation(); 
                                                                    setAssigningDevice(dev);
                                                                    setSelectedUserId(dev.assigned_user_id || ''); 
                                                                    setIsAssignModalOpen(true);
                                                                    setOpenMenuId(null); 
                                                                }}
                                                                style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', color: '#a855f7', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '4px', marginTop: '2px' }}
                                                                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                                                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                                            >
                                                                <UserPlus size={16} /> Phân công
                                                            </button>
                                                        )}

                                                        {/* NÚT BIỂU ĐỒ: Ai cũng thấy (User, Manager, Giám đốc) */}
                                                        <button 
                                                            onClick={(e) => { 
                                                                e.stopPropagation(); 
                                                                navigate(`/charts?id=${dev.device_id}`); 
                                                            }}
                                                            style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', color: '#10b981', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '4px', marginTop: '2px' }}
                                                            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                                        >
                                                            <LineChart size={16} /> Biểu đồ
                                                        </button>

                                                        {/* NÚT XÓA: Chỉ Giám đốc mới thấy */}
                                                        {canFullControl && (
                                                            <button 
                                                                onClick={(e) => { 
                                                                    e.stopPropagation(); 
                                                                    handleDelete(dev.id); 
                                                                    setOpenMenuId(null); 
                                                                }}
                                                                style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '4px', marginTop: '2px' }}
                                                                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                                                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                                            >
                                                                <Trash2 size={16} /> Xóa thiết bị
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* MODAL THÊM THIẾT BỊ MỚI */}
            {isModalOpen && (
                <div style={modalOverlayStyle}>
                    <div style={modalBoxStyle}>
                        <button onClick={() => setIsModalOpen(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: '#8b8d93', cursor: 'pointer' }}>
                            <X size={24} />
                        </button>

                        <h2 style={{ color: '#ffffff', marginBottom: '25px', fontSize: '1.4rem' }}>
                            Thêm <span style={{ color: '#10b981' }}>Thiết Bị</span> Mới
                        </h2>
                        
                        <form onSubmit={handleAddSubmit}>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', color: '#8b8d93', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '500' }}>Device ID</label>
                                <input type="text" required placeholder="VD: b1_hust_ubx" value={newDevice.device_id} onChange={(e) => setNewDevice({...newDevice, device_id: e.target.value})} style={inputStyle} />
                            </div>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', color: '#8b8d93', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '500' }}>Site ID</label>
                                <input type="text" required placeholder="VD: phong_lab_302" value={newDevice.site_id || ''} onChange={(e) => setNewDevice({...newDevice, site_id: e.target.value})} style={inputStyle} />
                            </div>
                            <div style={{ marginBottom: '25px' }}>
                                <label style={{ display: 'block', color: '#8b8d93', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '500' }}>Loại thiết bị (Type)</label>
                                <select value={newDevice.device_type} onChange={(e) => setNewDevice({...newDevice, device_type: e.target.value})} style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' }}>
                                    <option value="UBX">Dữ liệu UBX</option>
                                    <option value="RTCM">Dữ liệu RTCM</option>
                                    <option value="SBF">Dữ liệu SBF</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button type="button" onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', color: '#8b8d93', border: '1px solid rgba(255,255,255,0.1)', padding: '12px 24px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600' }}>Hủy</button>
                                <button type="submit" style={{ background: '#10b981', color: '#131517', border: 'none', padding: '12px 24px', borderRadius: '10px', cursor: 'pointer', fontWeight: '700' }}>Xác nhận</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL PHÂN CÔNG TÀI XẾ (ASSIGN) */}
            {isAssignModalOpen && assigningDevice && (
                <div style={modalOverlayStyle}>
                    <div style={modalBoxStyle}>
                        <button onClick={() => setIsAssignModalOpen(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: '#8b8d93', cursor: 'pointer' }}>
                            <X size={24} />
                        </button>

                        <h2 style={{ color: '#ffffff', marginBottom: '25px', fontSize: '1.4rem' }}>
                            Phân Công <span style={{ color: '#a855f7' }}>Phụ Trách</span>
                        </h2>
                        
                        <form onSubmit={handleAssignSubmit}>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', color: '#8b8d93', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '500' }}>Thiết bị đang thao tác</label>
                                <input type="text" disabled value={assigningDevice.device_id} style={{ ...inputStyle, background: 'rgba(255,255,255,0.02)', color: '#a3a3a3' }} />
                            </div>
                            <div style={{ marginBottom: '30px' }}>
                                <label style={{ display: 'block', color: '#8b8d93', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '500' }}>Chọn nhân sự phụ trách</label>
                                <select 
                                    value={selectedUserId} 
                                    onChange={(e) => setSelectedUserId(e.target.value)} 
                                    style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' }}
                                >
                                    <option value="">-- Thu hồi về kho (Không phân công) --</option>
                                    
                                    {usersList
                                        .filter(u => u.role_in_tenant !== 'tenant_admin') 
                                        .map(u => (
                                            <option key={u.id} value={u.id}>
                                                {u.email} - ({u.role_in_tenant === 'operator' ? 'Manager' : 'User'})
                                            </option>
                                        ))
                                    }
                                    
                                </select>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button type="button" onClick={() => setIsAssignModalOpen(false)} style={{ background: 'transparent', color: '#8b8d93', border: '1px solid rgba(255,255,255,0.1)', padding: '12px 24px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600' }}>Hủy</button>
                                <button type="submit" style={{ background: '#a855f7', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '10px', cursor: 'pointer', fontWeight: '700' }}>Lưu Phân Công</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

export default Devices;