// src/pages/Alarms.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { BellRing, AlertOctagon, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';
// Import Toastify để hiển thị thông báo xịn xò
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const API_URL = "http://127.0.0.1:8000/api/alarms";

const Alarms = () => {
    const navigate = useNavigate();
    const [alarms, setAlarms] = useState([]);

    // Hàm lấy dữ liệu từ Backend
    const loadAlarms = async () => {
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
            if (!res.ok) throw new Error("Lỗi Server");

            const data = await res.json();
            setAlarms(data);
        } catch (error) {
            console.error("Lỗi tải cảnh báo:", error);
            // Không dùng toast ở đây để tránh spam thông báo mỗi 5s nếu mất mạng tạm thời
        }
    };

    // Load lần đầu và thiết lập quét tự động mỗi 5 giây
    useEffect(() => {
        loadAlarms();
        const intervalId = setInterval(loadAlarms, 5000);
        return () => clearInterval(intervalId);
    }, [navigate]);

    // Xử lý cảnh báo (Đánh dấu đã giải quyết)
    const handleResolve = async (id) => {
        const token = localStorage.getItem("navis_token");
        try {
            const res = await fetch(`${API_URL}/${id}/resolve`, {
                method: "PUT",
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                toast.success("Đã xử lý cảnh báo thành công!");
                loadAlarms(); // Tải lại danh sách ngay lập tức
            } else {
                toast.error("Có lỗi xảy ra khi xử lý cảnh báo.");
            }
        } catch (error) {
            toast.error("Lỗi kết nối Server.");
        }
    };

    // Tính toán KPI
    const total = alarms.length;
    const criticalCount = alarms.filter(a => a.status === 'Active' && a.severity === 'Critical').length;
    const warningCount = alarms.filter(a => a.status === 'Active' && a.severity === 'Warning').length;

    // Helper: Định dạng thời gian chống lệch múi giờ
    const formatTime = (timeStr) => {
        if (!timeStr) return '--';
        let rawTime = timeStr;
        if (!rawTime.endsWith('Z') && !rawTime.includes('+')) rawTime += 'Z';
        return new Date(rawTime).toLocaleString('vi-VN');
    };

    // Helper: Lấy Style cho Huy hiệu (Badge)
    const getSeverityStyle = (severity) => {
        if (severity === 'Critical') return { background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' };
        if (severity === 'Warning') return { background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' };
        return { background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)' };
    };

    return (
        <Layout>
            <ToastContainer position="top-right" autoClose={3000} theme="dark" />
            
            <div className="dashboard-container">
                {/* Tiêu đề trang */}
                <div className="header-section">
                    <h1 className="header-title">System Alarms & Events</h1>
                </div>

                {/* KHỐI KPI - Ghi đè grid thành 3 cột cho vừa số liệu trang này */}
                <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    <div className="kpi-card">
                        <div className="kpi-header">
                            <span>Tổng số Cảnh báo</span>
                            <BellRing size={18} color="#3b82f6" />
                        </div>
                        <div className="kpi-value" style={{ color: '#3b82f6' }}>{total}</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-header">
                            <span>Đang kích hoạt (Nghiêm trọng)</span>
                            <AlertOctagon size={18} color="#ef4444" />
                        </div>
                        <div className="kpi-value" style={{ color: '#ef4444' }}>{criticalCount}</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-header">
                            <span>Cảnh báo Vàng</span>
                            <AlertTriangle size={18} color="#f59e0b" />
                        </div>
                        <div className="kpi-value" style={{ color: '#f59e0b' }}>{warningCount}</div>
                    </div>
                </div>

                {/* BẢNG DỮ LIỆU */}
                <div style={{ backgroundColor: '#1c1e22', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.03)', padding: '30px' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: '600', color: '#ffffff', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ShieldAlert size={24} color="#10b981" />
                        Lịch sử sự kiện
                    </div>
                    
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr>
                                    <th style={{ color: '#8b8d93', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase' }}>Thời gian</th>
                                    <th style={{ color: '#8b8d93', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase' }}>Thiết bị (ID)</th>
                                    <th style={{ color: '#8b8d93', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase' }}>Mức độ</th>
                                    <th style={{ color: '#8b8d93', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase' }}>Mô tả sự kiện</th>
                                    <th style={{ color: '#8b8d93', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase' }}>Trạng thái</th>
                                    <th style={{ color: '#8b8d93', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', textAlign: 'right' }}>Hành động</th>
                                </tr>
                            </thead>
                            <tbody>
                                {alarms.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#8b8d93' }}>
                                            Hệ thống đang hoạt động bình thường, không có dữ liệu cảnh báo.
                                        </td>
                                    </tr>
                                ) : (
                                    alarms.map(alarm => (
                                        <tr key={alarm.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background-color 0.2s' }}>
                                            <td style={{ padding: '18px 10px', color: '#a3a3a3', fontSize: '0.95rem' }}>{formatTime(alarm.time)}</td>
                                            <td style={{ padding: '18px 10px', fontWeight: '600', color: '#ffffff' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                                                    {alarm.device_id}
                                                </span>
                                            </td>
                                            <td style={{ padding: '18px 10px' }}>
                                                <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', ...getSeverityStyle(alarm.severity) }}>
                                                    {alarm.severity}
                                                </span>
                                            </td>
                                            <td style={{ padding: '18px 10px', color: '#e2e8f0', fontSize: '0.95rem' }}>{alarm.event}</td>
                                            <td style={{ padding: '18px 10px' }}>
                                                {alarm.status === 'Active' ? (
                                                    <span style={{ color: '#ef4444', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
                                                        {/* CSS cho hiệu ứng chớp tắt nhỏ (blink) bạn có thể nhúng trực tiếp hoặc để sẵn ở file css */}
                                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', boxShadow: '0 0 8px #ef4444' }}></div>
                                                        Đang diễn ra
                                                    </span>
                                                ) : (
                                                    <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: '500' }}>
                                                        <CheckCircle size={16} /> Đã xử lý
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: '18px 10px', textAlign: 'right' }}>
                                                {alarm.status === 'Active' ? (
                                                    <button 
                                                        onClick={() => handleResolve(alarm.id)}
                                                        style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#10b981', cursor: 'pointer', padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', transition: 'all 0.2s' }}
                                                        onMouseOver={(e) => { e.currentTarget.style.background = '#10b981'; e.currentTarget.style.color = '#131517'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                                        onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'; e.currentTarget.style.color = '#10b981'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                                    >
                                                        ✔ Xử lý
                                                    </button>
                                                ) : (
                                                    <button disabled style={{ background: '#131517', color: '#52555a', border: '1px solid rgba(255,255,255,0.05)', cursor: 'not-allowed', padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '500' }}>
                                                        Đã lưu trữ
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
        </Layout>
    );
};

export default Alarms;