// src/pages/Alarms.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellRing, AlertOctagon, AlertTriangle, CheckCircle, ShieldAlert, Trash2, Check } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../context/AuthContext';

const API_URL = "/api/alarms";

const Alarms = () => {
    const navigate = useNavigate();
    const { user } = useAuth(); 
    
    // Quyền hạn: Chỉ Admin hoặc Giám đốc/Nhân viên Vận hành mới được Xóa/Xử lý cảnh báo
    const canManageAlarms = user?.role === 'admin' || ['tenant_admin', 'operator'].includes(user?.role_in_tenant);

    const [alarms, setAlarms] = useState([]);

    // 1. HÀM TẢI DỮ LIỆU TỪ DB 
    const loadAlarms = async () => {
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
            if (!res.ok) throw new Error("Lỗi Server");

            const data = await res.json();
            setAlarms(data);
        } catch (error) {
            console.error("Lỗi tải cảnh báo:", error);
        }
    };

    useEffect(() => {
        let isMounted = true;
        if (isMounted) {
            loadAlarms(); 
        }

        const handleGlobalUpdate = (event) => {
            const msg = event.detail;
            if (msg.event_type === "alarm" || msg.event_type === "spoofing_detected") {
                loadAlarms();
            }
        };

        window.addEventListener('device_update', handleGlobalUpdate);

        return () => {
            isMounted = false;
            window.removeEventListener('device_update', handleGlobalUpdate);
        };
    }, [navigate]);

    // Xử lý cảnh báo (Đánh dấu đã giải quyết)
    const handleResolve = async (id) => {
        const token = localStorage.getItem("navis_token") || localStorage.getItem("access_token");
        try {
            const res = await fetch(`${API_URL}/${id}/resolve`, {
                method: "PUT",
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                toast.success("Đã xử lý cảnh báo thành công!");
                loadAlarms(); 
            } else {
                toast.error("Có lỗi xảy ra khi xử lý cảnh báo.");
            }
        } catch (error) {
            toast.error("Lỗi kết nối Server.");
        }
    };

    // Xóa cảnh báo
    const handleDeleteAlarm = async (alarmId) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa vĩnh viễn sự kiện này không?")) return;

        const token = localStorage.getItem("navis_token") || localStorage.getItem("access_token");
        try {
            const response = await fetch(`/api/alarms/${alarmId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (response.ok) {
                setAlarms(prevAlarms => prevAlarms.filter(alarm => alarm.id !== alarmId));
                toast.success("Đã xóa cảnh báo!");
            } else {
                const errData = await response.json();
                toast.error(`Lỗi: ${errData.detail}`);
            }
        } catch (error) {
            toast.error("Lỗi kết nối đến máy chủ!");
        }
    };

    // Tính toán KPI
    const total = alarms.length;
    const criticalCount = alarms.filter(a => a.status === 'Active' && a.severity === 'Critical').length;
    const warningCount = alarms.filter(a => a.status === 'Active' && a.severity === 'Warning').length;

    const formatTime = (timeStr) => {
        if (!timeStr) return '--';
        let rawTime = timeStr;
        if (!rawTime.endsWith('Z') && !rawTime.includes('+')) rawTime += 'Z';
        return new Date(rawTime).toLocaleString('vi-VN');
    };

    const getSeverityStyle = (severity) => {
        if (severity === 'Critical') return { background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' };
        if (severity === 'Warning') return { background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' };
        return { background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)' };
    };

    return (
        <>
            <div className="dashboard-container">
                <div className="header-section">
                    <h1 className="header-title">System Alarms & Events</h1>
                </div>

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

                <div style={{ backgroundColor: '#1c1e22', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.03)', padding: '30px' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: '600', color: '#ffffff', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ShieldAlert size={24} color="#10b981" /> Lịch sử sự kiện
                    </div>
                    
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr>
                                    <th className="table-header">Thời gian</th>
                                    <th className="table-header">Thiết bị (ID)</th>
                                    <th className="table-header">Mức độ</th>
                                    <th className="table-header">Mô tả sự kiện</th>
                                    <th className="table-header">Trạng thái</th>
                                    {/* Cột Hành động trống tiêu đề để UI thanh thoát hơn */}
                                    {canManageAlarms && <th className="table-header" style={{ width: '100px', textAlign: 'right' }}></th>}
                                </tr>
                            </thead>
                            <tbody>
                                {alarms.length === 0 ? (
                                    <tr>
                                        <td colSpan={canManageAlarms ? "6" : "5"} style={{ textAlign: 'center', padding: '40px', color: '#8b8d93' }}>
                                            Hệ thống đang hoạt động bình thường, không có dữ liệu cảnh báo.
                                        </td>
                                    </tr>
                                ) : (
                                    alarms.slice(0, 50).map(alarm => (
                                        <tr key={alarm.id} className="alarm-row">
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
                                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', boxShadow: '0 0 8px #ef4444' }}></div>
                                                        Đang diễn ra
                                                    </span>
                                                ) : (
                                                    <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: '500' }}>
                                                        <CheckCircle size={16} /> Đã xử lý
                                                    </span>
                                                )}
                                            </td>
                                            
                                            {/* HIỂN THỊ TRỰC TIẾP NÚT ACTION (THAY VÌ MENU 3 CHẤM) */}
                                            {canManageAlarms && (
                                                <td style={{ padding: '18px 10px', textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                                        {alarm.status === 'Active' && (
                                                            <button 
                                                                className="btn-action btn-resolve"
                                                                onClick={(e) => { e.stopPropagation(); handleResolve(alarm.id); }}
                                                                title="Đánh dấu đã xử lý"
                                                            >
                                                                <Check size={18} />
                                                            </button>
                                                        )}
                                                        <button 
                                                            className="btn-action btn-delete"
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteAlarm(alarm.id); }}
                                                            title="Xóa cảnh báo"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <style>{`
                /* CSS UX Cải tiến cho Alarms */
                .table-header { color: #8b8d93; font-size: 0.85rem; text-transform: uppercase; padding: 15px 10px; border-bottom: 1px solid rgba(255,255,255,0.05); }
                .alarm-row { transition: all 0.2s ease; border-bottom: 1px solid rgba(255,255,255,0.03); }
                .alarm-row:hover { background-color: rgba(255,255,255,0.02); }
                
                .btn-action { background: transparent; border: none; padding: 8px; border-radius: 8px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; }
                
                /* Nút Resolve (Màu xám -> Xanh lá khi hover) */
                .btn-resolve { color: #52525b; }
                .btn-resolve:hover { color: #10b981; background: rgba(16, 185, 129, 0.1); }
                
                /* Nút Delete (Màu xám -> Đỏ khi hover) */
                .btn-delete { color: #52525b; }
                .btn-delete:hover { color: #ef4444; background: rgba(239, 68, 68, 0.1); }
            `}</style>
        </>
    );
};

export default Alarms;