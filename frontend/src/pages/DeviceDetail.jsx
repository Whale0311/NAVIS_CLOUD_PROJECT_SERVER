import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { ArrowLeft, Terminal, Download, Info, Power, Loader2, MoreVertical, Trash2 } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';

const DeviceDetail = () => {
    const { deviceId } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('control'); 
    
    const [files, setFiles] = useState([]);
    const [isSendingCmd, setIsSendingCmd] = useState(false);
    
    // State cho UI
    const [openMenuId, setOpenMenuId] = useState(null);
    const [showGuide, setShowGuide] = useState(false); // State bật/tắt cẩm nang lệnh
    const commandTemplates = {
        set_rate: '{\n  "interval_ms": 5000\n}',
        update_fw: '{\n  "version": "1.0.2"\n}',
        set_mode: '{\n  "mode": "rtk"\n}'
    };
    const [selectedCmd, setSelectedCmd] = useState('set_rate');
    const [payloadText, setPayloadText] = useState(commandTemplates['set_rate']);

    const handleCmdChange = (e) => {
        const cmd = e.target.value;
        setSelectedCmd(cmd);
        setPayloadText(commandTemplates[cmd]); // Tự động điền code mẫu vào ô JSON
    };
    // Ref để quản lý Timeout của lệnh gửi
    const timeoutRef = useRef(null);
    const toastIdRef = useRef(null);
    // ===============================================
    // LẮNG NGHE PHẢN HỒI LỆNH TỪ TRẠM RADAR TOÀN CỤC
    // ===============================================
    useEffect(() => {
        const handleGlobalUpdate = (event) => {
            const msg = event.detail;
            
            const isAck = msg.event_type === "command_ack" || msg.schema === "gnss.cmd.ack.v1" || msg.event_type === "ack";

            if (isAck && msg.device_id === deviceId) {
                setIsSendingCmd(false); 
                clearTimeout(timeoutRef.current); 
                
                // UPDATE LẠI THÔNG BÁO THÀNH CÔNG (Tự động tắt sau 3s)
                toast.update(toastIdRef.current, { render: "Mạch đã phản hồi lệnh thành công!", type: "success", isLoading: false, autoClose: 3000 });
            }
        };

        // Bật tai lên nghe
        window.addEventListener('device_update', handleGlobalUpdate);
        
        // Rút tai nghe khi thoát trang
        return () => window.removeEventListener('device_update', handleGlobalUpdate);
    }, [deviceId]);

    // 2. FETCH FILE
    useEffect(() => {
        if (activeTab === 'files') {
            const token = localStorage.getItem("navis_token");
            fetch(`http://localhost:8000/api/devices/${deviceId}/files`, {
                headers: { "Authorization": `Bearer ${token}` }
            })
            .then(res => res.json())
            .then(data => setFiles(data))
            .catch(() => toast.error("Lỗi lấy danh sách file"));
        }
    }, [activeTab, deviceId]);

    // 3. GỬI LỆNH (CÓ TIMEOUT)
    const sendCommand = async (cmdType, customPayload = {}) => {
        setIsSendingCmd(true);
        const token = localStorage.getItem("navis_token");
        try {
            const res = await fetch(`http://localhost:8000/api/devices/${deviceId}/command/${cmdType}`, {
                method: 'POST',
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ payload: customPayload })
            });
            if(res.ok) {
                // HIỂN THỊ LOADING VÀ LƯU ID LẠI
                toastIdRef.current = toast.loading(`Đang gửi lệnh ${cmdType}, chờ phản hồi...`);
                
                timeoutRef.current = setTimeout(() => {
                    setIsSendingCmd(false);
                    // UPDATE LẠI THÔNG BÁO NẾU TIMEOUT (Tự động tắt sau 3s)
                    toast.update(toastIdRef.current, { render: "Thiết bị không phản hồi (Timeout)!", type: "warning", isLoading: false, autoClose: 3000 });
                }, 10000);
            } else throw new Error();
        } catch (error) {
            setIsSendingCmd(false);
            toast.error("Lỗi mạng khi gửi lệnh!");
        }
    };

    // 4. TẢI FILE
    const handleDownloadFile = async (fileId, fileName) => {
        setOpenMenuId(null);
        const toastId = toast.loading("Đang tải dữ liệu...");
        const token = localStorage.getItem("navis_token");
        try {
            const res = await fetch(`http://localhost:8000/api/files/download/${fileId}`, {
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

    // HÀM XÓA FILE HOÀN THIỆN
    const handleDeleteFile = async (fileId) => {
        setOpenMenuId(null); // Đóng menu 3 chấm
        
        if(window.confirm("CẢNH BÁO: Bạn có chắc chắn muốn xóa vĩnh viễn file dữ liệu này? Không thể khôi phục lại!")) {
            const token = localStorage.getItem("navis_token");
            try {
                const res = await fetch(`http://localhost:8000/api/files/${fileId}`, {
                    method: 'DELETE',
                    headers: { "Authorization": `Bearer ${token}` }
                });
                
                if (res.ok) {
                    toast.success("Đã xóa file thành công!");
                    // Tự động loại bỏ file vừa xóa khỏi danh sách hiện tại để UI cập nhật ngay lập tức
                    setFiles(files.filter(f => f.id !== fileId)); 
                } else {
                    toast.error("Lỗi khi xóa file từ Server!");
                }
            } catch (error) {
                toast.error("Lỗi kết nối đến Server!");
            }
        }
    };

    // Đóng dropdown khi click ra ngoài
    useEffect(() => {
        const handleClickOutside = () => {
            setOpenMenuId(null);
            setShowGuide(false);
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    return (
        <Layout>
            <ToastContainer position="top-right" theme="dark" />
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

                    {/* TAB ĐIỀU KHIỂN (2 Cột + Nút Info) */}
                    {activeTab === 'control' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                            
                            {/* Cột 1: Quick Actions */}
                            <div style={{ background: '#131517', padding: '25px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <h3 style={{ color: '#fff', marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Power size={20} color="#ef4444"/> Thao tác nhanh
                                </h3>
                                <p style={{ color: '#8b8d93', fontSize: '0.9rem', marginBottom: '20px' }}>Lệnh thực thi ngay lập tức.</p>
                                <button 
                                    onClick={() => sendCommand('reboot', {})}
                                    disabled={isSendingCmd}
                                    style={{ background: isSendingCmd ? '#4b5563' : 'rgba(239, 68, 68, 0.1)', color: isSendingCmd ? '#a3a3a3' : '#ef4444', border: '1px solid', borderColor: isSendingCmd ? 'transparent' : '#ef4444', padding: '12px 24px', borderRadius: '8px', cursor: isSendingCmd ? 'not-allowed' : 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px', width: '100%', justifyContent: 'center' }}
                                >
                                    {isSendingCmd ? <Loader2 size={18} className="spin" /> : <Power size={18} />}
                                    {isSendingCmd ? 'Đang chờ mạch phản hồi...' : 'Khởi động lại (Reboot)'}
                                </button>
                            </div>

                            {/* Cột 2: Custom Command + Nút Cẩm nang */}
                            <div style={{ background: '#131517', padding: '25px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <h3 style={{ color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Terminal size={20} color="#3b82f6"/> Gửi thông số
                                    </h3>
                                    
                                    {/* Nút Info bật Cẩm Nang */}
                                    <div style={{ position: 'relative' }}>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setShowGuide(!showGuide); }}
                                            style={{ background: 'transparent', border: 'none', color: '#10b981', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                            title="Xem cẩm nang lệnh"
                                        >
                                            <Info size={22} />
                                        </button>

                                        {/* Popup Cẩm nang (ẩn/hiện) */}
                                        {showGuide && (
                                            <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: '35px', right: '0', background: '#2a2d32', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '10px', padding: '15px', width: '280px', zIndex: 20, boxShadow: '0 10px 25px rgba(0,0,0,0.8)' }}>
                                                <h4 style={{ color: '#10b981', margin: '0 0 10px 0' }}>Cẩm nang tập lệnh</h4>
                                                <ul style={{ paddingLeft: '15px', color: '#a3a3a3', fontSize: '0.85rem', margin: 0 }}>
                                                    <li style={{ marginBottom: '8px' }}><strong style={{color:'#fff'}}>set_rate</strong><br/><code>{"{ \"interval_ms\": 5000 }"}</code></li>
                                                    <li style={{ marginBottom: '8px' }}><strong style={{color:'#fff'}}>update_fw</strong><br/><code>{"{ \"version\": \"1.0.2\" }"}</code></li>
                                                    <li><strong style={{color:'#fff'}}>set_mode</strong><br/><code>{"{ \"mode\": \"rtk\" }"}</code></li>
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div style={{ marginBottom: '15px' }}>
                                    <label style={{ color: '#8b8d93', fontSize: '0.9rem', display: 'block', marginBottom: '8px' }}>Lệnh (Command)</label>
                                    <select 
                                        value={selectedCmd}
                                        onChange={handleCmdChange}
                                        style={{ width: '100%', padding: '12px 10px', background: '#1c1e22', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', outline: 'none', cursor: 'pointer', appearance: 'none' }}
                                    >
                                        <option value="set_rate">set_rate (Chỉnh tần số gửi tọa độ)</option>
                                        <option value="update_fw">update_fw (Cập nhật Firmware)</option>
                                        <option value="set_mode">set_mode (Đổi chế độ định vị)</option>
                                    </select>
                                </div>
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ color: '#8b8d93', fontSize: '0.9rem', display: 'block', marginBottom: '8px' }}>Payload (JSON)</label>
                                    <textarea 
                                        rows="3" 
                                        value={payloadText}
                                        onChange={(e) => setPayloadText(e.target.value)}
                                        style={{ width: '100%', padding: '10px', background: '#1c1e22', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#10b981', fontFamily: 'monospace', outline: 'none' }}
                                    />
                                </div>
                                <button 
                                    onClick={() => {
                                        try { 
                                            // Lấy trực tiếp từ State thay vì dùng getElementById
                                            const payloadData = JSON.parse(payloadText); 
                                            sendCommand(selectedCmd, payloadData); 
                                        } 
                                        catch (e) { toast.error("Payload JSON không hợp lệ!"); }
                                    }}
                                    disabled={isSendingCmd}
                                    style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', cursor: isSendingCmd ? 'not-allowed' : 'pointer', fontWeight: 'bold', width: '100%' }}
                                >
                                    Bắn Lệnh Cấu Hình
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
                                        {/* Bỏ chữ Hành Động */}
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
        </Layout>
    );
};

export default DeviceDetail;