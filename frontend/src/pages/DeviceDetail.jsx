// src/pages/DeviceDetail.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Terminal, Download, Power, Loader2, Trash2, ShieldAlert, FileArchive, FileCode2, Filter, Calendar } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../context/AuthContext';

const DeviceDetail = () => {
    const { deviceId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    
    const canControlDevice = user?.role === 'admin' || ['tenant_admin', 'operator'].includes(user?.role_in_tenant);
    
    useEffect(() => {
        if (!canControlDevice) {
            toast.error("Truy cập bị từ chối! Bạn không có quyền cấu hình thiết bị.");
            navigate('/devices');
        }
    }, [canControlDevice, navigate]);

    const [activeTab, setActiveTab] = useState('control'); 
    const [files, setFiles] = useState([]);
    const [isSendingCmd, setIsSendingCmd] = useState(false);
    
    // STATE MỚI: BỘ LỌC FILE
    const [filterType, setFilterType] = useState('all'); // all, ubx, bin
    const [filterAlarm, setFilterAlarm] = useState('all'); // all, true
    const [filterDate, setFilterDate] = useState(''); // YYYY-MM-DD

    const [selectedCmd, setSelectedCmd] = useState('start');
    const [cmdParams, setCmdParams] = useState({ mode: 'realtime' }); 

    const timeoutRef = useRef(null);
    const toastIdRef = useRef(null);

    // ==========================================
    // HÀM CHUẨN HÓA THỜI GIAN
    // ==========================================
    const formatFileTime = (timeVal) => {
        if (!timeVal) return 'Đang ghi...';
        if (typeof timeVal === 'number') {
            return new Date(timeVal < 1e12 ? timeVal * 1000 : timeVal).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        }
        let safeStr = String(timeVal).replace(/\.\d+/, ''); 
        if (!safeStr.endsWith('Z') && !safeStr.includes('+')) safeStr += 'Z';
        const d = new Date(safeStr);
        return isNaN(d.getTime()) ? `--` : d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    };

    const formatFullDate = (timeVal) => {
        if (!timeVal) return '';
        let safeStr = String(timeVal).replace(/\.\d+/, ''); 
        if (!safeStr.endsWith('Z') && !safeStr.includes('+')) safeStr += 'Z';
        return new Date(safeStr).toLocaleDateString('vi-VN');
    };

    const handleCmdChange = (e) => {
        const cmd = e.target.value;
        setSelectedCmd(cmd);
        if (cmd === 'start') setCmdParams({ mode: 'realtime' });
        else if (cmd === 'stop') setCmdParams({ reason: 'user_requested' });
        else if (cmd === 'restart') setCmdParams({ scope: 'pipeline' });
        else if (cmd === 'status') setCmdParams({});
        else if (cmd === 'configure') setCmdParams({ reference_svid: 3, min_sat_count: 4 });
    };

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

    // ==========================================
    // FETCH FILE VỚI BỘ LỌC TÍCH HỢP
    // ==========================================
    const loadFiles = async () => {
        const token = localStorage.getItem("navis_token") || localStorage.getItem("access_token");
        try {
            // Xây dựng URL Query
            let url = `/api/devices/${deviceId}/files?limit=100`;
            if (filterType !== 'all') url += `&file_type=${filterType}`;
            if (filterAlarm === 'true') url += `&has_alarm=true`;
            if (filterDate) url += `&date_str=${filterDate}`;

            const res = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
            if (res.ok) {
                const data = await res.json();
                setFiles(data);
            } else {
                toast.error("Lỗi lấy danh sách file");
            }
        } catch (error) { toast.error("Lỗi kết nối Server"); }
    };

    useEffect(() => {
        if (activeTab === 'files' && canControlDevice) {
            loadFiles();
        }
    }, [activeTab, deviceId, canControlDevice, filterType, filterAlarm, filterDate]);

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

    // TẢI FILE (THAY ĐỔI LỜI NHẮN THÀNH ZIP)
    const handleDownloadFile = async (fileId, fileName) => {
        const toastId = toast.loading("Đang nén file ZIP và tải xuống...");
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
            a.download = `${fileName}.zip`; // Lưu với đuôi .zip
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
        if(window.confirm("CẢNH BÁO: Bạn có chắc chắn muốn xóa vĩnh viễn file dữ liệu này khỏi Server?")) {
            const token = localStorage.getItem("navis_token") || localStorage.getItem("access_token");
            try {
                const res = await fetch(`/api/files/${fileId}`, {
                    method: 'DELETE',
                    headers: { "Authorization": `Bearer ${token}` }
                });
                
                if (res.ok) {
                    toast.success("Đã xóa file thành công!");
                    loadFiles(); // Refresh lại danh sách
                } else {
                    toast.error("Lỗi khi xóa file từ Server!");
                }
            } catch (error) { toast.error("Lỗi kết nối đến Server!"); }
        }
    };

    if (!canControlDevice) return null;

    const inputStyle = { padding: '12px 15px', background: '#131517', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', color: 'white', outline: 'none' };

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
                        <button onClick={() => setActiveTab('control')} style={{ background: 'none', border: 'none', color: activeTab === 'control' ? '#10b981' : '#8b8d93', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'color 0.2s' }}>
                            <Terminal size={20}/> Điều khiển
                        </button>
                        <button onClick={() => setActiveTab('files')} style={{ background: 'none', border: 'none', color: activeTab === 'files' ? '#10b981' : '#8b8d93', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'color 0.2s' }}>
                            <FileArchive size={20}/> Dữ liệu lưu trữ (Logs)
                        </button>
                    </div>

                    {/* TAB ĐIỀU KHIỂN (Giữ nguyên) */}
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
                                    <button onClick={() => sendCommand('reboot', { scope: 'hardware' })} disabled={isSendingCmd} className="btn-reboot">
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
                                    <label style={{ color: '#8b8d93', fontSize: '0.85rem', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>Loại Lệnh</label>
                                    <select value={selectedCmd} onChange={handleCmdChange} style={{ ...inputStyle, width: '100%', cursor: 'pointer' }}>
                                        <option value="start">▶ Bắt đầu luồng dữ liệu (Start)</option>
                                        <option value="stop">■ Dừng luồng dữ liệu (Stop)</option>
                                        <option value="restart">↻ Khởi động lại luồng (Restart)</option>
                                        <option value="status">ℹ Kiểm tra trạng thái (Status)</option>
                                        <option value="configure">⚙ Cấu hình bộ lọc (Configure)</option>
                                    </select>
                                </div>

                                {selectedCmd !== 'status' && (
                                    <div style={{ marginBottom: '20px', background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.05)' }}>
                                        <label style={{ color: '#8b8d93', fontSize: '0.85rem', display: 'block', marginBottom: '12px', textTransform: 'uppercase' }}>Tham số đính kèm</label>
                                        {selectedCmd === 'start' && (
                                            <select value={cmdParams.mode} onChange={(e) => setCmdParams({ mode: e.target.value })} style={{ ...inputStyle, width: '100%', color: '#10b981' }}>
                                                <option value="realtime">Thời gian thực (Realtime)</option>
                                                <option value="sdr_snapshot">Chụp dữ liệu thô (SDR Snapshot)</option>
                                            </select>
                                        )}
                                        {selectedCmd === 'stop' && (
                                            <select value={cmdParams.reason} onChange={(e) => setCmdParams({ reason: e.target.value })} style={{ ...inputStyle, width: '100%', color: '#10b981' }}>
                                                <option value="user_requested">Người dùng yêu cầu tạm dừng</option>
                                                <option value="maintenance">Bảo trì hệ thống định kỳ</option>
                                                <option value="error">Phát hiện lỗi phần cứng</option>
                                            </select>
                                        )}
                                        {selectedCmd === 'restart' && (
                                            <div>
                                                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>Phạm vi (Scope)</span>
                                                <input type="text" value={cmdParams.scope} disabled style={{ ...inputStyle, width: '100%', color: '#6b7280', marginTop: '5px' }} />
                                            </div>
                                        )}
                                        {selectedCmd === 'configure' && (
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                                <div>
                                                    <label style={{ fontSize: '0.8rem', color: '#8b8d93', display: 'block', marginBottom: '5px' }}>Reference SVID</label>
                                                    <input type="number" value={cmdParams.reference_svid} onChange={(e) => setCmdParams({ ...cmdParams, reference_svid: Number(e.target.value) })} style={{ ...inputStyle, width: '100%', color: '#10b981' }} />
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '0.8rem', color: '#8b8d93', display: 'block', marginBottom: '5px' }}>Min Sat Count</label>
                                                    <input type="number" value={cmdParams.min_sat_count} onChange={(e) => setCmdParams({ ...cmdParams, min_sat_count: Number(e.target.value) })} style={{ ...inputStyle, width: '100%', color: '#10b981' }} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <button onClick={() => sendCommand(selectedCmd, cmdParams)} disabled={isSendingCmd} className="btn-send">
                                    {isSendingCmd ? <Loader2 size={18} className="spin" /> : <Terminal size={18} />}
                                    {isSendingCmd ? 'Đang gửi...' : `Gửi cấu hình ${selectedCmd.toUpperCase()}`}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* TAB QUẢN LÝ FILE RAW MỚI */}
                    {activeTab === 'files' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            
                            {/* BỘ LỌC FILE */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '12px', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8b8d93', fontWeight: '600', marginRight: '10px' }}>
                                    <Filter size={18}/> Bộ lọc:
                                </div>

                                <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ ...inputStyle, padding: '10px 15px', width: 'auto', cursor: 'pointer' }}>
                                    <option value="all">Tất cả định dạng</option>
                                    <option value="ubx">Dữ liệu UBX</option>
                                    <option value="bin">Dữ liệu Forensic (BIN)</option>
                                </select>

                                <select value={filterAlarm} onChange={(e) => setFilterAlarm(e.target.value)} style={{ ...inputStyle, padding: '10px 15px', width: 'auto', cursor: 'pointer', color: filterAlarm === 'true' ? '#ef4444' : 'white' }}>
                                    <option value="all">Mọi trạng thái</option>
                                    <option value="true">🚨 Có chứa tấn công</option>
                                </select>

                                <div style={{ display: 'flex', alignItems: 'center', background: '#131517', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', padding: '0 10px' }}>
                                    <Calendar size={16} color="#8b8d93" />
                                    <input 
                                        type="date" 
                                        value={filterDate} 
                                        onChange={(e) => setFilterDate(e.target.value)} 
                                        style={{ background: 'transparent', border: 'none', color: 'white', padding: '10px', outline: 'none', cursor: 'pointer' }}
                                    />
                                </div>

                                {(filterType !== 'all' || filterAlarm !== 'all' || filterDate !== '') && (
                                    <button 
                                        onClick={() => { setFilterType('all'); setFilterAlarm('all'); setFilterDate(''); }}
                                        style={{ background: 'transparent', border: 'none', color: '#3b82f6', cursor: 'pointer', fontWeight: '600', padding: '10px' }}
                                    >
                                        Xóa lọc
                                    </button>
                                )}
                            </div>

                            {/* BẢNG DỮ LIỆU */}
                            <div style={{ overflowX: 'auto', minHeight: '300px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                    <thead>
                                        <tr>
                                            <th className="table-header">Tên File</th>
                                            <th className="table-header">Ngày ghi</th>
                                            <th className="table-header">Khung giờ (1 tiếng)</th>
                                            <th className="table-header">Định dạng</th>
                                            <th className="table-header">Kích thước</th>
                                            <th className="table-header" style={{ width: '120px', textAlign: 'right' }}>Hành động</th> 
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {files.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" style={{ textAlign: 'center', padding: '50px', color: '#8b8d93' }}>
                                                    <FileArchive size={40} style={{ opacity: 0.2, marginBottom: '10px' }} />
                                                    <br/> Không tìm thấy file dữ liệu nào phù hợp.
                                                </td>
                                            </tr>
                                        ) : (
                                            files.map(f => (
                                                <tr key={f.id} className="file-row">
                                                    <td style={{ padding: '15px', color: '#fff', fontWeight: '500' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            {f.file_type === 'ubx' ? <FileCode2 size={18} color="#3b82f6" /> : <FileArchive size={18} color="#a855f7" />}
                                                            {f.file_name}
                                                            {/* HIỂN THỊ CỜ CẢNH BÁO MÀU ĐỎ NẾU CÓ */}
                                                            {f.has_alarm && (
                                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700', marginLeft: '5px' }}>
                                                                    <ShieldAlert size={12} /> TẤN CÔNG
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '15px', color: '#a3a3a3' }}>{formatFullDate(f.start_time)}</td>
                                                    <td style={{ padding: '15px', color: '#10b981', fontWeight: '600' }}>
                                                        {formatFileTime(f.start_time)} &rarr; {formatFileTime(f.end_time)}
                                                    </td>
                                                    <td style={{ padding: '15px' }}>
                                                        <span style={{ background: '#131517', border: '1px solid rgba(255,255,255,0.05)', color: '#e2e8f0', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', textTransform: 'uppercase' }}>
                                                            .{f.file_type}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '15px', color: '#a3a3a3' }}>{(f.file_size_bytes / 1024).toFixed(2)} KB</td>
                                                    <td style={{ padding: '15px', textAlign: 'right' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                                            <button 
                                                                className="btn-action btn-download"
                                                                onClick={(e) => { e.stopPropagation(); handleDownloadFile(f.id, f.file_name); }}
                                                                title="Nén & Tải xuống (.zip)"
                                                            >
                                                                <Download size={18} />
                                                            </button>
                                                            <button 
                                                                className="btn-action btn-delete"
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteFile(f.id); }}
                                                                title="Xóa file khỏi Server"
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
                    )}
                </div>
            </div>
            
            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { 100% { transform: rotate(360deg); } }

                /* Style mới cho Form Buttons */
                .btn-reboot { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid transparent; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 10px; width: 100%; justify-content: center; transition: all 0.2s; }
                .btn-reboot:hover:not(:disabled) { background: rgba(239, 68, 68, 0.2); }
                .btn-reboot:disabled { background: #4b5563; color: #a3a3a3; cursor: not-allowed; }

                .btn-send { background: #3b82f6; color: #fff; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-weight: bold; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; transition: background 0.2s; }
                .btn-send:hover:not(:disabled) { background: #2563eb; }
                .btn-send:disabled { cursor: not-allowed; opacity: 0.7; }

                /* Style cho Bảng File */
                .table-header { color: #8b8d93; font-size: 0.85rem; text-transform: uppercase; padding: 15px; border-bottom: 1px solid rgba(255,255,255,0.05); }
                .file-row { transition: all 0.2s ease; border-bottom: 1px solid rgba(255,255,255,0.03); }
                .file-row:hover { background-color: rgba(255,255,255,0.02); }

                /* Inline Actions */
                .btn-action { background: transparent; border: none; padding: 8px; border-radius: 8px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; }
                .btn-download { color: #8b8d93; }
                .btn-download:hover { color: #10b981; background: rgba(16, 185, 129, 0.1); }
                .btn-delete { color: #8b8d93; }
                .btn-delete:hover { color: #ef4444; background: rgba(239, 68, 68, 0.1); }
            `}</style>
        </>
    );
};

export default DeviceDetail;