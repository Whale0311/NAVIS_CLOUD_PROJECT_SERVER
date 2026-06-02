// src/pages/Alarms.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellRing, AlertOctagon, AlertTriangle, CheckCircle, ShieldAlert, MoreVertical, Trash2, Check } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const API_URL = "/api/alarms";

const Alarms = () => {
    const navigate = useNavigate();
    const [alarms, setAlarms] = useState([]);
    const [openMenuId, setOpenMenuId] = useState(null);

    useEffect(() => {
        const handleClickOutside = () => {
            setOpenMenuId(null);
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);
    // 1. HÀM TẢI DỮ LIỆU TỪ DB (Chỉ gọi khi load trang hoặc khi có báo động mới)
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

    useEffect(() => {
        let isMounted = true;
        if (isMounted) {
            loadAlarms(); // Lấy danh sách lúc mới vào trang
        }

        const handleGlobalUpdate = (event) => {
            const msg = event.detail;
            
            // Nếu Trạm tổng báo có Spoofing hoặc Alarm -> tự động kéo API cập nhật lại bảng
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
    // ==========================================
    // HÀM XỬ LÝ XÓA CẢNH BÁO
    // ==========================================
    const handleDeleteAlarm = async (alarmId) => {
        // Thêm hộp thoại xác nhận cho chắc chắn
        if (!window.confirm("Bạn có chắc chắn muốn xóa vĩnh viễn sự kiện này không?")) return;

        const token = localStorage.getItem("navis_token");
        try {
            const response = await fetch(`/api/alarms/${alarmId}`, {
                method: "DELETE",
                headers: { 
                    "Authorization": `Bearer ${token}` 
                }
            });

            if (response.ok) {
                // Xóa thành công -> Cập nhật lại State để giao diện tự mất dòng đó
                setAlarms(prevAlarms => prevAlarms.filter(alarm => alarm.id !== alarmId));
                
                // (Tùy chọn) Cập nhật lại các con số KPI ở trên cùng nếu ông có dùng State cho chúng
                // setTotalAlarms(prev => prev - 1);
            } else {
                const errData = await response.json();
                alert(`Lỗi: ${errData.detail}`);
            }
        } catch (error) {
            console.error("Lỗi khi gọi API xóa cảnh báo:", error);
            alert("Lỗi kết nối đến máy chủ!");
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
                    
                    {/* Bảng Dữ Liệu */}
<div style={{ overflow: 'visible', paddingBottom: '80px' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr>
                                    <th style={{ color: '#8b8d93', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase' }}>Thời gian</th>
                                    <th style={{ color: '#8b8d93', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase' }}>Thiết bị (ID)</th>
                                    <th style={{ color: '#8b8d93', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase' }}>Mức độ</th>
                                    <th style={{ color: '#8b8d93', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase' }}>Mô tả sự kiện</th>
                                    <th style={{ color: '#8b8d93', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase' }}>Trạng thái</th>
                                    <th style={{ color: '#8b8d93', padding: '15px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', textAlign: 'center' }}>Hành động</th>
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
                                    alarms.slice(0, 50).map(alarm => (
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
                                            <td style={{ padding: '18px 10px', textAlign: 'center', position: 'relative' }}>
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setOpenMenuId(openMenuId === alarm.id ? null : alarm.id);
                                                    }}
                                                    style={{ background: 'transparent', border: 'none', color: '#8b8d93', cursor: 'pointer', padding: '5px' }}
                                                >
                                                    <MoreVertical size={20} />
                                                </button>

                                                {openMenuId === alarm.id && (
                                                    <div style={{ position: 'absolute', right: '30px', top: '15px', background: '#2a2d32', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '5px', width: '130px', zIndex: 10, boxShadow: '0 10px 15px rgba(0,0,0,0.5)' }}>
                                                        
                                                        {alarm.status === 'Active' && (
                                                            <button 
                                                                onClick={(e) => { 
                                                                    e.stopPropagation(); 
                                                                    handleResolve(alarm.id); 
                                                                    setOpenMenuId(null); 
                                                                }}
                                                                style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', color: '#10b981', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '4px' }}
                                                                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                                                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                                            >
                                                                <Check size={16} /> Xử lý
                                                            </button>
                                                        )}

                                                        <button 
                                                            onClick={(e) => { 
                                                                e.stopPropagation(); 
                                                                handleDeleteAlarm(alarm.id); 
                                                                setOpenMenuId(null); 
                                                            }}
                                                            style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '4px', marginTop: '2px' }}
                                                            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                                        >
                                                            <Trash2 size={16} /> Xóa
                                                        </button>
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
    );
};

export default Alarms;