// src/pages/Devices.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { HardDrive, LineChart, Trash2, X, Plus, Search } from 'lucide-react';
// Import thư viện thông báo xịn xò
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const API_URL = "http://127.0.0.1:8000/api/devices";

const Devices = () => {
    const navigate = useNavigate();
    const [devices, setDevices] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // State cho Form thêm mới
    const [newDevice, setNewDevice] = useState({
        device_id: '',
        device_type: 'UBX'
    });

    // Fetch dữ liệu khi load trang
    const loadDevices = async () => {
        const token = localStorage.getItem("navis_token");
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

    useEffect(() => {
        loadDevices();
    }, []);

    // Xử lý thêm thiết bị mới
    const handleAddSubmit = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem("navis_token");
        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}` 
                },
                body: JSON.stringify({
                    device_id: newDevice.device_id,
                    name: newDevice.device_id, // Tạm mượn ID làm Name
                    device_type: newDevice.device_type,
                    is_active: true
                })
            });
            
            const data = await res.json();
            if (res.ok) {
                setIsModalOpen(false);
                setNewDevice({ device_id: '', device_type: 'UBX' });
                toast.success("Đã thêm thiết bị mới thành công!");
                loadDevices(); // Refresh list
            } else {
                toast.error("Lỗi: " + (data.detail || "Không thể tạo thiết bị"));
            }
        } catch (error) {
            toast.error("Lỗi kết nối Server");
        }
    };

    // Xử lý xóa thiết bị
    const handleDelete = async (id) => {
        if (!window.confirm("CẢNH BÁO: Bạn có chắc chắn muốn xóa vĩnh viễn thiết bị này khỏi hệ thống?")) return;
        
        const token = localStorage.getItem("navis_token");
        try {
            const res = await fetch(`${API_URL}/${id}`, {
                method: 'DELETE',
                headers: { "Authorization": `Bearer ${token}` }
            });
            
            if (res.ok) {
                toast.success("Đã xóa thiết bị thành công!");
                loadDevices(); // Refresh list
            } else {
                toast.error("Lỗi khi xóa thiết bị");
            }
        } catch (error) {
            toast.error("Lỗi kết nối Server");
        }
    };

    // Lọc dữ liệu theo thanh tìm kiếm
    const filteredDevices = devices.filter(dev => 
        dev.device_id && dev.device_id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Layout>
            <ToastContainer position="top-right" autoClose={3000} theme="dark" />
            
            <div className="dashboard-container">
                {/* Tiêu đề trang */}
                <div className="header-section">
                    <h1 className="header-title">Device Management</h1>
                </div>

                {/* Bảng Card chứa dữ liệu */}
                <div style={{ backgroundColor: '#1c1e22', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.03)', padding: '30px' }}>
                    
                    {/* Header của Bảng: Tiêu đề, Search, Nút Add */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem', fontWeight: '600', color: '#ffffff' }}>
                            Danh Sách Thiết Bị 
                            <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '2px 10px', borderRadius: '12px', fontSize: '0.9rem' }}>
                                {filteredDevices.length}
                            </span>
                        </div>

                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                            {/* Thanh tìm kiếm */}
                            <div style={{ position: 'relative' }}>
                                <Search size={18} color="#8b8d93" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                <input 
                                    type="text" 
                                    placeholder="Tìm theo Device ID..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{ background: '#131517', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '10px 15px 10px 40px', borderRadius: '8px', width: '280px', outline: 'none', transition: 'all 0.3s' }}
                                    onFocus={(e) => e.target.style.borderColor = '#10b981'}
                                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.05)'}
                                />
                            </div>

                            {/* Nút Thêm Thiết Bị */}
                            <button 
                                onClick={() => setIsModalOpen(true)}
                                style={{ background: '#10b981', color: '#131517', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}
                                onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                                <Plus size={20} /> Thêm Thiết Bị
                            </button>
                        </div>
                    </div>

                    {/* Bảng Dữ Liệu */}
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr>
                                    <th style={{ color: '#8b8d93', fontSize: '0.85rem', textTransform: 'uppercase', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Device ID</th>
                                    <th style={{ color: '#8b8d93', fontSize: '0.85rem', textTransform: 'uppercase', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Loại (Type)</th>
                                    <th style={{ color: '#8b8d93', fontSize: '0.85rem', textTransform: 'uppercase', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Kết nối lần cuối</th>
                                    <th style={{ color: '#8b8d93', fontSize: '0.85rem', textTransform: 'uppercase', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Chủ sở hữu</th>
                                    <th style={{ color: '#8b8d93', fontSize: '0.85rem', textTransform: 'uppercase', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'right' }}>Hành động</th>
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
                                                <span style={{ background: '#131517', border: '1px solid rgba(255,255,255,0.1)', color: '#a3a3a3', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', letterSpacing: '0.5px' }}>
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
                                                {dev.owner_email || 'N/A'}
                                            </td>
                                            <td style={{ padding: '18px 10px', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                    <button 
                                                        onClick={() => navigate(`/charts?id=${dev.device_id}`)}
                                                        style={{ background: 'rgba(16, 185, 129, 0.1)', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', color: '#10b981', transition: 'all 0.2s' }}
                                                        title="Xem biểu đồ"
                                                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)'}
                                                        onMouseOut={(e) => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'}
                                                    >
                                                        <LineChart size={18} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(dev.id)}
                                                        style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', color: '#ef4444', transition: 'all 0.2s' }}
                                                        title="Xóa vĩnh viễn"
                                                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                                                        onMouseOut={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* MODAL THÊM MỚI (Popup) */}
            {isModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ background: '#1c1e22', padding: '32px', borderRadius: '16px', width: '420px', border: '1px solid rgba(16, 185, 129, 0.3)', position: 'relative', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }}>
                        <button 
                            onClick={() => setIsModalOpen(false)}
                            style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: '#8b8d93', cursor: 'pointer', transition: 'color 0.2s' }}
                            onMouseOver={(e) => e.currentTarget.style.color = '#fff'}
                            onMouseOut={(e) => e.currentTarget.style.color = '#8b8d93'}
                        >
                            <X size={24} />
                        </button>

                        <h2 style={{ color: '#ffffff', marginBottom: '25px', fontSize: '1.4rem' }}>
                            Thêm <span style={{ color: '#10b981' }}>Thiết Bị</span> Mới
                        </h2>
                        
                        <form onSubmit={handleAddSubmit}>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', color: '#8b8d93', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '500' }}>Device ID</label>
                                <input 
                                    type="text" 
                                    required 
                                    placeholder="VD: b1_hust_ubx" 
                                    value={newDevice.device_id}
                                    onChange={(e) => setNewDevice({...newDevice, device_id: e.target.value})}
                                    style={{ width: '100%', padding: '14px', background: '#131517', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', color: 'white', outline: 'none', transition: 'border-color 0.3s' }}
                                    onFocus={(e) => e.target.style.borderColor = '#10b981'}
                                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.05)'}
                                />
                            </div>
                            <div style={{ marginBottom: '25px' }}>
                                <label style={{ display: 'block', color: '#8b8d93', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '500' }}>Loại thiết bị (Type)</label>
                                <select 
                                    value={newDevice.device_type}
                                    onChange={(e) => setNewDevice({...newDevice, device_type: e.target.value})}
                                    style={{ width: '100%', padding: '14px', background: '#131517', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', color: 'white', outline: 'none', cursor: 'pointer', appearance: 'none' }}
                                >
                                    <option value="UBX">Dữ liệu UBX</option>
                                    <option value="RTCM">Dữ liệu RTCM</option>
                                    <option value="SBF">Dữ liệu SBF</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button 
                                    type="button" 
                                    onClick={() => setIsModalOpen(false)} 
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
                                    Xác nhận
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default Devices;