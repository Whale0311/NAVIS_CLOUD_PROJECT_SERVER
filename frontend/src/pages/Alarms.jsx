import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { BellRing, AlertOctagon, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';

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
        }
    };

    // Load lần đầu và thiết lập quét tự động mỗi 5 giây
    useEffect(() => {
        loadAlarms();
        const intervalId = setInterval(loadAlarms, 5000);
        return () => clearInterval(intervalId); // Dọn dẹp bộ nhớ khi chuyển trang
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
                loadAlarms(); // Tải lại danh sách ngay lập tức
            } else {
                alert("Có lỗi xảy ra khi xử lý cảnh báo.");
            }
        } catch (error) {
            console.error("Lỗi:", error);
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
        if (severity === 'Critical') return { background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' };
        if (severity === 'Warning') return { background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' };
        return { background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)' };
    };

    return (
        <Layout>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#e2e8f0', marginBottom: '30px' }}>
                System Alarms & Events
            </div>

            {/* KHỐI KPI */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '30px' }}>
                <div className="kpi-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        <span>Tổng số Cảnh báo</span>
                        <BellRing size={22} color="#3b82f6" />
                    </div>
                    <div style={{ fontSize: '2.4rem', fontWeight: 'bold', color: '#3b82f6', marginTop: '10px' }}>{total}</div>
                </div>
                <div className="kpi-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        <span>Đang kích hoạt (Nghiêm trọng)</span>
                        <AlertOctagon size={22} color="#ef4444" />
                    </div>
                    <div style={{ fontSize: '2.4rem', fontWeight: 'bold', color: '#ef4444', marginTop: '10px' }}>{criticalCount}</div>
                </div>
                <div className="kpi-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        <span>Cảnh báo Vàng</span>
                        <AlertTriangle size={22} color="#f59e0b" />
                    </div>
                    <div style={{ fontSize: '2.4rem', fontWeight: 'bold', color: '#f59e0b', marginTop: '10px' }}>{warningCount}</div>
                </div>
            </div>

            {/* BẢNG DỮ LIỆU */}
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', padding: '30px' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: '600', color: '#ffffff', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldAlert size={24} color="#10b981" />
                    Lịch sử sự kiện
                </div>
                
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr>
                            <th style={{ color: '#94a3b8', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.1)', fontWeight: '600', textTransform: 'uppercase' }}>Thời gian</th>
                            <th style={{ color: '#94a3b8', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.1)', fontWeight: '600', textTransform: 'uppercase' }}>Thiết bị (ID)</th>
                            <th style={{ color: '#94a3b8', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.1)', fontWeight: '600', textTransform: 'uppercase' }}>Mức độ</th>
                            <th style={{ color: '#94a3b8', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.1)', fontWeight: '600', textTransform: 'uppercase' }}>Mô tả sự kiện</th>
                            <th style={{ color: '#94a3b8', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.1)', fontWeight: '600', textTransform: 'uppercase' }}>Trạng thái</th>
                            <th style={{ color: '#94a3b8', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.1)', fontWeight: '600', textTransform: 'uppercase' }}>Hành động</th>
                        </tr>
                    </thead>
                    <tbody>
                        {alarms.length === 0 ? (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#737373' }}>
                                    Hệ thống đang hoạt động bình thường, không có dữ liệu cảnh báo.
                                </td>
                            </tr>
                        ) : (
                            alarms.map(alarm => (
                                <tr key={alarm.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background-color 0.2s' }}>
                                    <td style={{ padding: '18px 10px', color: '#a3a3a3' }}>{formatTime(alarm.time)}</td>
                                    <td style={{ padding: '18px 10px', fontWeight: 'bold', color: '#10b981' }}>{alarm.device_id}</td>
                                    <td style={{ padding: '18px 10px' }}>
                                        <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', ...getSeverityStyle(alarm.severity) }}>
                                            {alarm.severity}
                                        </span>
                                    </td>
                                    <td style={{ padding: '18px 10px', color: '#e2e8f0' }}>{alarm.event}</td>
                                    <td style={{ padding: '18px 10px' }}>
                                        {alarm.status === 'Active' ? (
                                            <span style={{ color: '#ef4444', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', animation: 'blink 1s infinite' }}></div>
                                                Đang diễn ra
                                            </span>
                                        ) : (
                                            <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <CheckCircle size={16} /> Đã xử lý
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ padding: '18px 10px' }}>
                                        {alarm.status === 'Active' ? (
                                            <button 
                                                onClick={() => handleResolve(alarm.id)}
                                                style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', cursor: 'pointer', padding: '6px 12px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold' }}
                                                onMouseOver={(e) => { e.currentTarget.style.background = '#10b981'; e.currentTarget.style.color = '#000'; }}
                                                onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'; e.currentTarget.style.color = '#10b981'; }}
                                            >
                                                ✔ Đánh dấu đã xử lý
                                            </button>
                                        ) : (
                                            <button disabled style={{ background: 'rgba(255,255,255,0.05)', color: '#666', border: '1px solid transparent', cursor: 'not-allowed', padding: '6px 12px', borderRadius: '6px', fontSize: '0.85rem' }}>
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
        </Layout>
    );
};

export default Alarms;