// src/pages/Devices.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HardDrive, LineChart, Trash2, X, Plus, Search, Settings, UserPlus } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../context/AuthContext';

const API_URL = "/api/devices";

const Devices = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    
    const isTenantAdmin = user?.role_in_tenant === 'tenant_admin';

    const [devices, setDevices] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // STATE MỚI: Quản lý thiết bị đang được click để hiện Action Modal
    const [actionModalDevice, setActionModalDevice] = useState(null);

    const [newDevice, setNewDevice] = useState({
        device_id: '',
        device_type: 'UBX',
        site_id: ''
    });

    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [assigningDevice, setAssigningDevice] = useState(null);
    const [usersList, setUsersList] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState('');

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

    const loadUsers = async () => {
        if (!isTenantAdmin) return;
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
        if (isTenantAdmin) loadUsers();
    }, [isTenantAdmin]);

    const handleAddSubmit = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem("navis_token") || localStorage.getItem("access_token");
        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
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
                setActionModalDevice(null); // Đóng modal nếu đang mở
            } else {
                const data = await res.json();
                toast.error("Lỗi: " + (data.detail || "Không thể xóa"));
            }
        } catch (error) { toast.error("Lỗi kết nối Server"); }
    };

    const handleAssignSubmit = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem("navis_token") || localStorage.getItem("access_token");
        try {
            const payload = { user_id: selectedUserId ? parseInt(selectedUserId) : null };
            const res = await fetch(`${API_URL}/${assigningDevice.id}/assign`, {
                method: 'PUT',
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
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

    // STYLES
    const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center' };
    const modalBoxStyle = { background: '#1c1e22', padding: '32px', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.3)', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)' };
    const inputStyle = { width: '100%', padding: '14px', background: '#131517', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', color: 'white', outline: 'none' };
    
    // Nút chức năng to trong Action Modal
    const actionBtnStyle = (color) => ({
        width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px', 
        background: 'rgba(255,255,255,0.03)', border: `1px solid rgba(255,255,255,0.05)`, 
        borderRadius: '12px', color: '#e2e8f0', fontSize: '1.05rem', fontWeight: '500', 
        cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left'
    });

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
                                    type="text" placeholder="Tìm theo Device ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{ ...inputStyle, width: '280px', paddingLeft: '40px' }}
                                />
                            </div>
                            {isTenantAdmin && (
                                <button onClick={() => setIsModalOpen(true)} className="btn-primary">
                                    <Plus size={20} /> Thêm Thiết Bị
                                </button>
                            )}
                        </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr>
                                    <th className="table-header">Device ID</th>
                                    <th className="table-header">Loại (Type)</th>
                                    <th className="table-header">Kết nối lần cuối</th>
                                    <th className="table-header">Tổ chức</th>
                                    <th className="table-header" style={{ width: '60px' }}></th> {/* Cột trống cho icon xóa */}
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
                                        <tr key={dev.id} className="device-row" onClick={() => setActionModalDevice(dev)}>
                                            <td style={{ padding: '18px 10px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#ffffff', fontWeight: '600' }}>
                                                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '10px', borderRadius: '10px' }}>
                                                        <HardDrive size={20} color="#10b981" />
                                                    </div>
                                                    {dev.device_id}
                                                </div>
                                            </td>
                                            <td style={{ padding: '18px 10px' }}>
                                                <span style={{ background: '#131517', border: '1px solid rgba(255,255,255,0.1)', color: '#a3a3a3', padding: '6px 12px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600' }}>
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
                                                {dev.tenant_name || 'N/A'}
                                            </td>
                                            <td style={{ padding: '18px 10px', textAlign: 'right' }}>
                                                {isTenantAdmin && (
                                                    <button 
                                                        className="btn-delete"
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); // 🚨 Chặn click không mở Action Modal
                                                            handleDelete(dev.id); 
                                                        }}
                                                        title="Xóa thiết bị"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
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

            {/* MODAL MENU THAO TÁC (Hiện khi click vào dòng) */}
            {actionModalDevice && (
                <div style={modalOverlayStyle} onClick={() => setActionModalDevice(null)}>
                    <div style={{ ...modalBoxStyle, width: '380px', padding: '25px' }} onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setActionModalDevice(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: '#8b8d93', cursor: 'pointer' }}>
                            <X size={24} />
                        </button>

                        <h3 style={{ color: '#fff', marginTop: 0, marginBottom: '20px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            Tùy chọn: <span style={{ color: '#10b981' }}>{actionModalDevice.device_id}</span>
                        </h3>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <button className="action-btn chart-btn" onClick={() => navigate(`/charts?id=${actionModalDevice.device_id}`)} style={actionBtnStyle()}>
                                <LineChart size={20} /> Theo dõi Biểu đồ dữ liệu
                            </button>

                            {isTenantAdmin && (
                                <>
                                    <button className="action-btn assign-btn" onClick={() => {
                                        setAssigningDevice(actionModalDevice);
                                        setSelectedUserId(actionModalDevice.assigned_user_id || '');
                                        setActionModalDevice(null);
                                        setIsAssignModalOpen(true);
                                    }} style={actionBtnStyle()}>
                                        <UserPlus size={20} /> Phân công nhân sự
                                    </button>

                                    <button className="action-btn config-btn" onClick={() => navigate(`/devices/${actionModalDevice.device_id}`)} style={actionBtnStyle()}>
                                        <Settings size={20} /> Quản lý cấu hình & File
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL THÊM THIẾT BỊ MỚI */}
            {isModalOpen && (
                <div style={modalOverlayStyle}>
                    <div style={{...modalBoxStyle, width: '420px'}}>
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
                    <div style={{...modalBoxStyle, width: '420px'}}>
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
                                <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' }}>
                                    <option value="">-- Thu hồi về kho (Không phân công) --</option>
                                    {usersList.filter(u => u.role_in_tenant !== 'tenant_admin' && u.role !== 'admin').map(u => (
                                        <option key={u.id} value={u.id}>{u.email} (User)</option>
                                    ))}
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

            <style>{`
                /* CSS UX Cải tiến */
                .table-header { color: #8b8d93; font-size: 0.85rem; text-transform: uppercase; padding: 15px 10px; border-bottom: 1px solid rgba(255,255,255,0.05); }
                .device-row { cursor: pointer; transition: all 0.2s ease; border-bottom: 1px solid rgba(255,255,255,0.03); }
                .device-row:hover { background-color: rgba(255,255,255,0.02); }
                
                .btn-delete { color: #52525b; background: transparent; border: none; padding: 8px; border-radius: 8px; cursor: pointer; transition: all 0.2s; }
                .btn-delete:hover { color: #ef4444; background: rgba(239, 68, 68, 0.1); }
                
                .btn-primary { background: #10b981; color: #131517; border: none; padding: 10px 20px; border-radius: 10px; cursor: pointer; font-weight: 700; display: flex; align-items: center; gap: 8px; transition: all 0.2s; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2); }
                .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 15px rgba(16, 185, 129, 0.3); }

                /* Action Button Hovers */
                .action-btn:hover.chart-btn { border-color: rgba(16, 185, 129, 0.5); color: #10b981; background: rgba(16, 185, 129, 0.05); }
                .action-btn:hover.assign-btn { border-color: rgba(168, 85, 247, 0.5); color: #a855f7; background: rgba(168, 85, 247, 0.05); }
                .action-btn:hover.config-btn { border-color: rgba(59, 130, 246, 0.5); color: #3b82f6; background: rgba(59, 130, 246, 0.05); }
            `}</style>
        </>
    );
};

export default Devices;