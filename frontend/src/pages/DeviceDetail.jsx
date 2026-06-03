// src/pages/DeviceDetail.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Terminal, Download, Power, Loader2, MoreVertical, Trash2, ShieldAlert } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../context/AuthContext'; // IMPORT BỘ XỬ LÝ QUYỀN

const DeviceDetail = () => {
    const { deviceId } = useParams();
    const navigate = useNavigate();
    
    // =====================================
    // BỨC TƯỜNG LỬA BẢO VỆ TRANG
    // =====================================
    const { user } = useAuth();
    // Chỉ Admin, Giám đốc, hoặc Nhân viên Vận hành (operator) mới được vào trang này
    const canControlDevice = user?.role === 'admin' || ['tenant_admin', 'operator'].includes(user?.role_in_tenant);
    
    // Nếu là Tài xế (viewer), chặn đứng và đá về trang chủ ngay lập tức
    useEffect(() => {
        if (!canControlDevice) {
            toast.error("Truy cập bị từ chối! Bạn không có quyền cấu hình thiết bị.");
            navigate('/devices');
        }
    }, [canControlDevice, navigate]);

    const [activeTab, setActiveTab] = useState('control'); 
    const [files, setFiles] = useState([]);
    const [isSendingCmd, setIsSendingCmd] = useState(false);
    
    const [openMenuId, setOpenMenuId] = useState(null);
    const [showGuide, setShowGuide] = useState(false); 

    const [selectedCmd, setSelectedCmd] = useState('start');
    const [cmdParams, setCmdParams] = useState({ mode: 'realtime' }); 

    const timeoutRef = useRef(null);
    const toastIdRef = useRef(null);

    const handleCmdChange = (e) => {
        const cmd = e.target.value;
        setSelectedCmd(cmd);
        
        if (cmd === 'start') setCmdParams({ mode: 'realtime' });
        else if (cmd === 'stop') setCmdParams({ reason: 'user_requested' });
        else if (cmd === 'restart') setCmdParams({ scope: 'pipeline' });
        else if (cmd === 'status') setCmdParams({});
        else if (cmd === 'configure') setCmdParams({ reference_svid: 3, min_sat_count: 4 });
    };

    // LẮNG NGHE PHẢN HỒI LỆNH TỪ TRẠM RADAR TOÀN CỤC
    useEffect(() => {
        const handleGlobalUpdate = (event) => {
            const msg = event.detail;
            const isAck = msg.event_type === "command_ack" || msg.schema === "gnss.cmd.ack.v1" || msg.event_type === "ack";

            if (isAck && msg.device_id === deviceId) {
                setIsSendingCmd(false); 
                clearTimeout(timeoutRef.current); 
                toast.update(toastIdRef.current, { render: "Mạch đã phản hồi lệnh thành công!", type: "success", isLoading: false, autoClose: 3000 });
            }
        };

        window.addEventListener('device_update', handleGlobalUpdate);
        return () => window.removeEventListener('device_update', handleGlobalUpdate);
    }, [deviceId]);

    // FETCH FILE
    useEffect(() => {
        if (activeTab === 'files' && canControlDevice) {
            const token = localStorage.getItem("navis_token") || localStorage.getItem("access_token");
            fetch(`/api/devices/${deviceId}/files`, {
                headers: { "Authorization": `Bearer ${token}` }
            })
            .then(res => res.json())
            .then(data => setFiles(data))
            .catch(() => toast.error("Lỗi lấy danh sách file"));
        }
    }, [activeTab, deviceId, canControlDevice]);

    // GỬI LỆNH (CÓ TIMEOUT)
    const sendCommand = async (cmdType, customPayload = {}) => {
        setIsSendingCmd(true);
        const token = localStorage.getItem("navis_token") || localStorage.getItem("access_token");
        
        toastIdRef.current = toast.loading(`Đang gửi lệnh ${cmdType}, chờ phản hồi...`);
        
        timeoutRef.current = setTimeout(() => {
            setIsSendingCmd(false);
            toast.update(toastIdRef.current, { render: "Thiết bị không phản hồi (Timeout)!", type: "warning", isLoading: false, autoClose: 3000 });
        }, 10000);

        try {
            const res = await fetch(`/api/devices/${deviceId}/command/${cmdType}`, {
                method: 'POST',
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify(customPayload) 
            });
            
            if (!res.ok) {
                clearTimeout(timeoutRef.current);
                toast.update(toastIdRef.current, { render: "Lỗi Server khi gửi lệnh!", type: "error", isLoading: false, autoClose: 3000 });
                setIsSendingCmd(false);
            }
        } catch (error) {
            clearTimeout(timeoutRef.current);
            toast.update(toastIdRef.current, { render: "Lỗi mạng khi gửi lệnh!", type: "error", isLoading: false, autoClose: 3000 });
            setIsSendingCmd(false);
        }
    };

    // TẢI FILE
    const handleDownloadFile = async (fileId, fileName) => {
        setOpenMenuId(null);
        const toastId = toast.loading("Đang tải dữ liệu...");
        const token = localStorage.getItem("navis_token") || localStorage.getItem("access_token");
        try {
            const res = await fetch(`/api/files/download/${fileId}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Không thể tải file");
            
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            
            toast.update(toastId, { render: "Tải xuống thành công!", type: "success", isLoading: false, autoClose: 2000 });
        } catch (error) {
            toast.update(toastId, { render: "Lỗi khi tải file!", type: "error", isLoading: false, autoClose: 3000 });
        }
    };

    // XÓA FILE 
    const handleDeleteFile = async (fileId) => {
        setOpenMenuId(null); 
        
        if(window.confirm("CẢNH BÁO: Bạn có chắc chắn muốn xóa vĩnh viễn file dữ liệu này? Không thể khôi phục lại!")) {
            const token = localStorage.getItem("navis_token") || localStorage.getItem("access_token");
            try {
                const res = await fetch(`/api/files/${fileId}`, {
                    method: 'DELETE',
                    headers: { "Authorization": `Bearer ${token}` }
                });
                
                if (res.ok) {
                    toast.success("Đã xóa file thành công!");
                    setFiles(files.filter(f => f.id !== fileId)); 
                } else {
                    toast.error("Lỗi khi xóa file từ Server!");
                }
            } catch (error) {
                toast.error("Lỗi kết nối đến Server!");
            }
        }
    };

    useEffect(() => {
        const handleClickOutside = () => {
            setOpenMenuId(null);
            setShowGuide(false);
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    // Nếu không có quyền, render trang trống để chờ chuyển hướng (tránh chớp UI)
    if (!canControlDevice) return null;

    return (
        <>
            <div className="dashboard-container">
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
                    <button onClick={() => navigate(-1)} style={{ background: '#1c1e22', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px', borderRadius: '8px', cursor: 'pointer' }}>
                        <ArrowLeft size={20} />
                    </button>
                    <h1 style={{ color: '#fff', margin: 0, fontSize: '1.8rem' }}>Cấu hình thiết bị: <span style={{ color: '#10b981' }}>{deviceId}</span></h1>
                </div>

                <div style={{ background: '#1c1e22', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.03)', padding: '30px' }}>
                    
                    <div style={{ display: 'flex', gap: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '20px', marginBottom: '25px' }}>
                        <button onClick={() => setActiveTab('control')} style={{ background: 'none', border: 'none', color: activeTab === 'control' ? '#10b981' : '#8b8d93', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Terminal size={20}/> Điều khiển
                        </button>
                        <button onClick={() => setActiveTab('files')} style={{ background: 'none', border: 'none', color: activeTab === 'files' ? '#10b981' : '#8b8d93', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Download size={20}/> Quản lý File
                        </button>
                    </div>

                    {/* TAB ĐIỀU KHIỂN */}
                    {activeTab === 'control' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                            
                            {/* CỘT 1: LỆNH HỆ THỐNG */}
                            <div style={{ background: '#131517', padding: '25px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column' }}>
                                <h3 style={{ color: '#fff', marginTop: 0, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Power size={20} color="#ef4444"/> Lệnh Hệ Thống
                                </h3>
                                <p style={{ color: '#8b8d93', fontSize: '0.9rem', marginBottom: '25px' }}>
                                    Tác động cấp thấp đến toàn bộ thiết bị phần cứng. Quá trình này có thể làm gián đoạn kết nối trong ít phút.
                                </p>
                                
                                <div style={{ marginTop: 'auto' }}>
                                    <button 
                                        onClick={() => sendCommand('reboot', { scope: 'hardware' })}
                                        disabled={isSendingCmd}
                                        style={{ background: isSendingCmd ? '#4b5563' : 'rgba(239, 68, 68, 0.1)', color: isSendingCmd ? '#a3a3a3' : '#ef4444', border: '1px solid', borderColor: isSendingCmd ? 'transparent' : '#ef4444', padding: '12px 24px', borderRadius: '8px', cursor: isSendingCmd ? 'not-allowed' : 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px', width: '100%', justifyContent: 'center', transition: 'all 0.2s' }}
                                        onMouseOver={(e) => !isSendingCmd && (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)')}
                                        onMouseOut={(e) => !isSendingCmd && (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)')}
                                    >
                                        {isSendingCmd ? <Loader2 size={18} className="spin" /> : <Power size={18} />}
                                        {isSendingCmd ? 'Đang xử lý...' : 'Khởi động lại mạch (Reboot)'}
                                    </button>
                                </div>
                            </div>

                            {/* CỘT 2: LỆNH MODULE UBLOX */}
                            <div style={{ background: '#131517', padding: '25px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <h3 style={{ color: '#fff', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Terminal size={20} color="#3b82f6"/> Điều khiển Ublox Pipeline
                                </h3>
                                <p style={{ color: '#8b8d93', fontSize: '0.9rem', marginBottom: '20px' }}>
                                    Can thiệp trực tiếp vào tiến trình thu thập dữ liệu vệ tinh GNSS mà không làm tắt thiết bị.
                                </p>

                                <div style={{ marginBottom: '15px' }}>
                                    <label style={{ color: '#8b8d93', fontSize: '0.85rem', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Loại Lệnh</label>
                                    <select 
                                        value={selectedCmd}
                                        onChange={handleCmdChange}
                                        style={{ width: '100%', padding: '12px 15px', background: '#1c1e22', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', outline: 'none', cursor: 'pointer', appearance: 'none', fontWeight: '500' }}
                                    >
                                        <option value="start">▶ Bắt đầu luồng dữ liệu (Start)</option>
                                        <option value="stop">■ Dừng luồng dữ liệu (Stop)</option>
                                        <option value="restart">↻ Khởi động lại luồng (Restart)</option>
                                        <option value="status">ℹ Kiểm tra trạng thái (Status)</option>
                                        <option value="configure">⚙ Cấu hình bộ lọc (Configure)</option>
                                    </select>
                                </div>

                                {selectedCmd !== 'status' && (
                                    <div style={{ marginBottom: '20px', background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.05)' }}>
                                        <label style={{ color: '#8b8d93', fontSize: '0.85rem', display: 'block', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            Tham số đính kèm
                                        </label>
                                        
                                        {selectedCmd === 'start' && (
                                            <select value={cmdParams.mode} onChange={(e) => setCmdParams({ mode: e.target.value })} style={{ width: '100%', padding: '10px', background: '#1c1e22', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#10b981', outline: 'none' }}>
                                                <option value="realtime">Thời gian thực (Realtime)</option>
                                                <option value="sdr_snapshot">Chụp dữ liệu thô (SDR Snapshot)</option>
                                            </select>
                                        )}

                                        {selectedCmd === 'stop' && (
                                            <select value={cmdParams.reason} onChange={(e) => setCmdParams({ reason: e.target.value })} style={{ width: '100%', padding: '10px', background: '#1c1e22', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#10b981', outline: 'none' }}>
                                                <option value="user_requested">Người dùng yêu cầu tạm dừng</option>
                                                <option value="maintenance">Bảo trì hệ thống định kỳ</option>
                                                <option value="error">Phát hiện lỗi phần cứng</option>
                                            </select>
                                        )}

                                        {selectedCmd === 'restart' && (
                                            <div>
                                                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>Phạm vi (Scope)</span>
                                                <input type="text" value={cmdParams.scope} disabled style={{ width: '100%', padding: '10px', background: '#1c1e22', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', color: '#6b7280', marginTop: '5px' }} />
                                            </div>
                                        )}

                                        {selectedCmd === 'configure' && (
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                                <div>
                                                    <label style={{ fontSize: '0.8rem', color: '#8b8d93', display: 'block', marginBottom: '5px' }}>Reference SVID</label>
                                                    <input type="number" value={cmdParams.reference_svid} onChange={(e) => setCmdParams({ ...cmdParams, reference_svid: Number(e.target.value) })} style={{ width: '100%', padding: '10px', background: '#1c1e22', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#10b981', outline: 'none' }} />
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '0.8rem', color: '#8b8d93', display: 'block', marginBottom: '5px' }}>Min Sat Count</label>
                                                    <input type="number" value={cmdParams.min_sat_count} onChange={(e) => setCmdParams({ ...cmdParams, min_sat_count: Number(e.target.value) })} style={{ width: '100%', padding: '10px', background: '#1c1e22', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#10b981', outline: 'none' }} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <button 
                                    onClick={() => sendCommand(selectedCmd, cmdParams)}
                                    disabled={isSendingCmd}
                                    style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', cursor: isSendingCmd ? 'not-allowed' : 'pointer', fontWeight: 'bold', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background 0.2s' }}
                                    onMouseOver={(e) => !isSendingCmd && (e.currentTarget.style.background = '#2563eb')}
                                    onMouseOut={(e) => !isSendingCmd && (e.currentTarget.style.background = '#3b82f6')}
                                >
                                    {isSendingCmd ? <Loader2 size={18} className="spin" /> : <Terminal size={18} />}
                                    {isSendingCmd ? 'Đang gửi...' : `Gửi cấu hình ${selectedCmd.toUpperCase()}`}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* TAB QUẢN LÝ FILE RAW */}
                    {activeTab === 'files' && (
                        <div style={{ overflowX: 'auto', minHeight: '300px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr>
                                        <th style={{ color: '#8b8d93', padding: '15px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Tên File</th>
                                        <th style={{ color: '#8b8d93', padding: '15px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Thời gian tạo</th>
                                        <th style={{ color: '#8b8d93', padding: '15px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Kích thước</th>
                                        <th style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', width: '50px' }}></th> 
                                    </tr>
                                </thead>
                                <tbody>
                                    {files.map(f => (
                                        <tr key={f.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                            <td style={{ padding: '15px', color: '#fff' }}>{f.file_name}</td>
                                            <td style={{ padding: '15px', color: '#e2e8f0' }}>{new Date(f.timestamp + 'Z').toLocaleString('vi-VN')}</td>
                                            <td style={{ padding: '15px', color: '#e2e8f0' }}>{(f.file_size_bytes / 1024).toFixed(2)} KB</td>
                                            <td style={{ padding: '15px', textAlign: 'center', position: 'relative' }}>
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setOpenMenuId(openMenuId === f.id ? null : f.id);
                                                    }}
                                                    style={{ background: 'transparent', border: 'none', color: '#8b8d93', cursor: 'pointer', padding: '5px' }}
                                                >
                                                    <MoreVertical size={20} />
                                                </button>

                                                {openMenuId === f.id && (
                                                    <div style={{ position: 'absolute', right: '30px', top: '15px', background: '#2a2d32', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '5px', width: '150px', zIndex: 10, boxShadow: '0 10px 15px rgba(0,0,0,0.5)' }}>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleDownloadFile(f.id, f.file_name); }}
                                                            style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '4px' }}
                                                            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                                        >
                                                            <Download size={16} color="#10b981" /> Tải xuống
                                                        </button>
                                                        
                                                        {/* Nút Xóa File (Giới hạn quyền tương tự) */}
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteFile(f.id); }}
                                                            style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '4px', marginTop: '2px' }}
                                                            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                                        >
                                                            <Trash2 size={16} color="#ef4444" /> Xóa file
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {files.length === 0 && (
                                        <tr><td colSpan="4" style={{ textAlign: 'center', padding: '30px', color: '#8b8d93' }}>Chưa có file dữ liệu nào.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
            
            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { 100% { transform: rotate(360deg); } }
            `}</style>
        </>
    );
};

export default DeviceDetail;