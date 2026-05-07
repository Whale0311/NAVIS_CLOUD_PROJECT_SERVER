import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { HardDrive, LineChart, Trash2, X } from 'lucide-react';

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
            console.error("Lỗi lấy danh sách thiết bị", error);
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
                loadDevices(); // Refresh list
            } else {
                alert("Lỗi: " + (data.detail || "Không thể tạo thiết bị"));
            }
        } catch (error) {
            alert("Lỗi kết nối Server");
        }
    };

    // Xử lý xóa thiết bị
    const handleDelete = async (id) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa vĩnh viễn thiết bị này khỏi hệ thống?")) return;
        
        const token = localStorage.getItem("navis_token");
        try {
            const res = await fetch(`${API_URL}/${id}`, {
                method: 'DELETE',
                headers: { "Authorization": `Bearer ${token}` }
            });
            
            if (res.ok) {
                loadDevices(); // Refresh list
            } else {
                alert("Lỗi khi xóa thiết bị");
            }
        } catch (error) {
            alert("Lỗi kết nối Server");
        }
    };

    // Lọc dữ liệu theo thanh tìm kiếm
    const filteredDevices = devices.filter(dev => 
        dev.device_id && dev.device_id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Layout>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#e2e8f0', marginBottom: '30px' }}>
                Device Management
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.02)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', padding: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', fontWeight: 'bold', color: '#ffffff' }}>
                        Danh Sách Thiết Bị (<span style={{ color: '#10b981' }}>{filteredDevices.length}</span>)
                    </div>
                    <button 
                        onClick={() => setIsModalOpen(true)}
                        style={{ background: '#10b981', color: '#000', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        + Thêm Thiết Bị
                    </button>
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <input 
                        type="text" 
                        placeholder="Tìm kiếm theo ID Thiết Bị..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 15px', borderRadius: '8px', width: '300px', outline: 'none' }}
                    />
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr>
                            <th style={{ color: '#94a3b8', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Device ID</th>
                            <th style={{ color: '#94a3b8', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Loại (Type)</th>
                            <th style={{ color: '#94a3b8', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Kết nối lần cuối</th>
                            <th style={{ color: '#94a3b8', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Chủ sở hữu</th>
                            <th style={{ color: '#94a3b8', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Hành động</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredDevices.length === 0 ? (
                            <tr>
                                <td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#737373' }}>
                                    Không tìm thấy thiết bị nào trong hệ thống.
                                </td>
                            </tr>
                        ) : (
                            filteredDevices.map(dev => (
                                <tr key={dev.id} style={{ transition: '0.2s', cursor: 'default' }}>
                                    <td style={{ padding: '18px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#10b981', fontWeight: 'bold' }}>
                                            <HardDrive size={20} />
                                            {dev.device_id}
                                        </div>
                                    </td>
                                    <td style={{ padding: '18px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <span style={{ background: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                            {dev.device_type || 'UBX'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '18px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#e2e8f0' }}>
                                        {(() => {
                                            if (!dev.last_seen) return 'Vừa mới kết nối';
                                            let rawTime = dev.last_seen;
                                            // Bổ sung 'Z' để ép trình duyệt hiểu đây là giờ UTC và tự động cộng 7 tiếng cho giờ Việt Nam
                                            if (!rawTime.endsWith('Z') && !rawTime.includes('+')) {
                                                rawTime += 'Z';
                                            }
                                            return new Date(rawTime).toLocaleString('vi-VN');
                                        })()}
                                    </td>
                                    <td style={{ padding: '18px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#e2e8f0' }}>
                                        {dev.owner_email || 'N/A'}
                                    </td>
                                    <td style={{ padding: '18px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button 
                                                onClick={() => navigate(`/charts?id=${dev.device_id}`)}
                                                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer', color: '#10b981' }}
                                                title="Xem biểu đồ"
                                            >
                                                <LineChart size={20} />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(dev.id)}
                                                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer', color: '#ef4444' }}
                                                title="Xóa vĩnh viễn"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* MODAL THÊM MỚI (Popup) */}
            {isModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ background: '#1a1a1a', padding: '30px', borderRadius: '16px', width: '420px', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
                        <button 
                            onClick={() => setIsModalOpen(false)}
                            style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: '#a3a3a3', cursor: 'pointer' }}
                        >
                            <X size={24} />
                        </button>

                        <h2 style={{ color: '#10b981', marginBottom: '25px' }}>Thêm Thiết Bị Mới</h2>
                        <form onSubmit={handleAddSubmit}>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', color: '#a3a3a3', marginBottom: '8px' }}>Device ID</label>
                                <input 
                                    type="text" 
                                    required 
                                    placeholder="VD: b1_hust_ubx" 
                                    value={newDevice.device_id}
                                    onChange={(e) => setNewDevice({...newDevice, device_id: e.target.value})}
                                    style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', outline: 'none' }}
                                />
                            </div>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', color: '#a3a3a3', marginBottom: '8px' }}>Loại thiết bị (Type)</label>
                                <select 
                                    value={newDevice.device_type}
                                    onChange={(e) => setNewDevice({...newDevice, device_type: e.target.value})}
                                    style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', outline: 'none' }}
                                >
                                    <option value="UBX">UBX</option>
                                    <option value="RTCM">RTCM</option>
                                    <option value="SBF">SBF</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '30px' }}>
                                <button type="button" onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', color: '#a3a3a3', border: '1px solid rgba(255,255,255,0.2)', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}>Hủy</button>
                                <button type="submit" style={{ background: '#10b981', color: '#000', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Xác nhận</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </Layout>
    );
};

export default Devices;