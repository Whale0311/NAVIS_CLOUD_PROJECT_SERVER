// src/pages/Charts.jsx
import React, { useEffect, useState, useRef } from 'react';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler, RadialLinearScale, ArcElement
} from 'chart.js';
import { Line, PolarArea } from 'react-chartjs-2';
import Plotly from 'plotly.js-dist';
import factory from 'react-plotly.js/factory';

const createPlotlyComponent = factory.default || factory;
const Plot = createPlotlyComponent(Plotly);

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler, RadialLinearScale, ArcElement);
ChartJS.defaults.color = '#8b8d93'; 
ChartJS.defaults.borderColor = 'rgba(255, 255, 255, 0.04)'; 
ChartJS.defaults.font.family = "'Inter', system-ui, sans-serif";

const MAX_HISTORY = 60;

const calculateSkyplot = (signals) => {
    // Tăng từ 4 lên 6 phần tử (cho 6 hệ vệ tinh)
    let counts = [0, 0, 0, 0, 0, 0]; 
    (signals || []).forEach(s => {
        if (s.prn.startsWith('G')) counts[0]++;
        else if (s.prn.startsWith('R')) counts[1]++;
        else if (s.prn.startsWith('E')) counts[2]++;
        else if (s.prn.startsWith('B') || s.prn.startsWith('C')) counts[3]++;
        else if (s.prn.startsWith('J')) counts[4]++; // Thêm QZSS (Nhật Bản)
        else if (s.prn.startsWith('S')) counts[5]++; // Thêm SBAS (Sửa lỗi)
    });
    return counts;
};

const Charts = () => {
    const [devices, setDevices] = useState([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState('');
    const [isLive, setIsLive] = useState(false);
    
    // MỚI: State lưu trữ hình ảnh phổ SDR và kết quả AI
    const [sdrData, setSdrData] = useState(null);
    
    const chartStateRef = useRef({
        trendLabels: Array(MAX_HISTORY).fill('--:--'),
        trendData: Array(MAX_HISTORY).fill(null),
        skyplotCounts: [0, 0, 0, 0, 0, 0], 
        historyBuffer: Array(MAX_HISTORY).fill({ time: '', signals: {} }),
        lastMsgTime: 0 // 🚨 THÊM BIẾN NÀY: Lưu lại thời gian của gói tin mới nhất
    });
    
    const [chartState, setChartState] = useState(chartStateRef.current);

    // ==========================================
    // HÀM XỬ LÝ DATA REALTIME TỪ WEBSOCKET
    // ==========================================
    const processNewTelemetry = (apiData) => {
        let rawTime = apiData.timestamp || apiData.event_time || new Date().toISOString();
        if (!rawTime.endsWith('Z') && !rawTime.includes('+')) rawTime += 'Z';
        
        const msgTimestamp = new Date(rawTime).getTime(); // Lấy Timestamp dạng số mili-giây
        const timeStr = new Date(rawTime).toLocaleTimeString('vi-VN');

        const curr = chartStateRef.current;

        // 🚨 CHỐNG "XUYÊN KHÔNG": Nếu gói tin này sinh ra trước gói tin mới nhất trên biểu đồ -> BỎ QUA!
        if (msgTimestamp < curr.lastMsgTime) {
            console.warn(`⏳ Bỏ qua gói tin cũ bị trễ mạng: ${timeStr}`);
            return; 
        }

        const signals = apiData.signals || apiData.signals_data || [];
        const currentCno = apiData.summary?.avg_cno_dbhz ?? apiData.avg_cno_dbhz ?? apiData.avg_cno ?? 0;

        const newLabels = [...curr.trendLabels.slice(1), timeStr];
        const newData = [...curr.trendData.slice(1), currentCno]; 
        
        let sigMap = {};
        signals.forEach(s => {
            sigMap[s.prn] = s.cno_dbhz ?? s.cno ?? 0; 
        });
        const newBuffer = [{ time: timeStr, signals: sigMap }, ...curr.historyBuffer.slice(0, -1)];

        chartStateRef.current = {
            trendLabels: newLabels,
            trendData: newData,
            skyplotCounts: calculateSkyplot(signals),
            historyBuffer: newBuffer,
            lastMsgTime: msgTimestamp // 🚨 Cập nhật lại kỷ lục thời gian mới nhất
        };

        setChartState({ ...chartStateRef.current });
        setIsLive(true); 
    };
    // ==========================================
    // 1. LẤY DANH SÁCH THIẾT BỊ LÚC LOAD TRANG
    // ==========================================
    useEffect(() => {
        let isMounted = true;
        const loadDevices = async () => {
            const token = localStorage.getItem("navis_token") || localStorage.getItem("access_token");
            try {
                const res = await fetch("/api/devices", {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (!res.ok) return;
                const dbDevices = await res.json();
                
                if (isMounted) {
                    setDevices(dbDevices);
                    if (dbDevices.length > 0) setSelectedDeviceId(dbDevices[0].device_id);
                }
            } catch (e) { console.error("Lỗi lấy thiết bị", e); }
        };
        loadDevices();
        return () => { isMounted = false; };
    }, []);

    // ==========================================
    // 2. LOAD LỊCH SỬ & LẮNG NGHE RADAR
    // ==========================================
    useEffect(() => {
        if (!selectedDeviceId) return;
        let isMounted = true; 
        // Reset state khi đổi thiết bị
        chartStateRef.current = {
            trendLabels: Array(MAX_HISTORY).fill('--:--'),
            trendData: Array(MAX_HISTORY).fill(null),
            skyplotCounts: [0, 0, 0, 0],
            historyBuffer: Array(MAX_HISTORY).fill({ time: '', signals: {} })
        };
        setChartState(chartStateRef.current);
        setIsLive(false);
        setSdrData(null); // Reset lại ảnh SDR

        const loadHistory = async () => {
            const token = localStorage.getItem("navis_token") || localStorage.getItem("access_token");
            try {
                const res = await fetch(`/api/telemetry/devices/${selectedDeviceId}?limit=${MAX_HISTORY}`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                
                if (!res.ok) throw new Error("Không thể tải lịch sử dữ liệu");
                const dataArray = await res.json();
                console.log("🔍 API Lịch sử trả về:", dataArray); // Thêm dòng này
                if (!isMounted) return;

                if (dataArray && dataArray.length > 0) {
                    
                    // ==========================================
                    // 1. TÌM ẢNH SDR TRONG TOÀN BỘ LỊCH SỬ
                    // ==========================================
                    const latestSdr = [...dataArray].reverse().find(
                        item => item.detectors_data && item.detectors_data.spectrum_image_base64
                    );

                    if (latestSdr) {
                        setSdrData({
                            image: latestSdr.detectors_data.spectrum_image_base64,
                            threatClass: latestSdr.detectors_data.class || latestSdr.status || "Unknown",
                            confidence: latestSdr.detectors_data.confidence || 0,
                            time: latestSdr.timestamp
                        });
                    } else {
                        setSdrData(null);
                    }

                    // ==========================================
                    // 2. 🚨 SỬA LỖI MẤT DÒNG: LỌC BỎ CÁC BẢN GHI SDR AI KHỎI BIỂU ĐỒ
                    // Chỉ giữ lại các bản ghi GNSS thực sự có chứa tín hiệu vệ tinh
                    // ==========================================
                    const gnssDataOnly = dataArray.filter(item => !item.detectors_data && item.signals_data && item.signals_data.length > 0);

                    if (gnssDataOnly.length > 0) {
                        const history = gnssDataOnly.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                        const labels = [];
                        const dataPoints = [];
                        const buffer = [];

                        history.forEach(item => {
                            let rawTime = item.timestamp;
                            if (!rawTime.endsWith('Z') && !rawTime.includes('+')) rawTime += 'Z';
                            const timeStr = new Date(rawTime).toLocaleTimeString('vi-VN');
                            labels.push(timeStr);
                            
                            dataPoints.push(item.avg_cno_dbhz ?? item.avg_cno ?? 0);
                            
                            let sigMap = {};
                            (item.signals_data || []).forEach(s => {
                                sigMap[s.prn] = s.cno_dbhz ?? s.cno ?? 0;
                            });
                            buffer.unshift({ time: timeStr, signals: sigMap });
                        });

                        while (labels.length < MAX_HISTORY) labels.unshift('--:--');
                        while (dataPoints.length < MAX_HISTORY) dataPoints.unshift(null);
                        while (buffer.length < MAX_HISTORY) buffer.push({ time: '', signals: {} });

                        let maxTimeMs = 0;
                        let lastRaw = history[history.length - 1].timestamp;
                        if (!lastRaw.endsWith('Z') && !lastRaw.includes('+')) lastRaw += 'Z';
                        maxTimeMs = new Date(lastRaw).getTime();

                        chartStateRef.current = {
                            trendLabels: labels,
                            trendData: dataPoints,
                            skyplotCounts: calculateSkyplot(history[history.length - 1].signals_data),
                            historyBuffer: buffer,
                            lastMsgTime: maxTimeMs
                        };
                        setChartState({ ...chartStateRef.current });
                    }
                }
            } catch (e) { console.error("Lỗi nạp dữ liệu lịch sử", e); }
        };
        const handleGlobalUpdate = (event) => {
            const msg = event.detail; 
            
            // 🚨 ĐÃ SỬA: CHỈ gọi hàm vẽ biểu đồ khi nhận đúng gói tin CHỨA VỆ TINH
            if (msg.event_type === "telemetry_update" && msg.device_id === selectedDeviceId) {
                processNewTelemetry(msg.data); 
            }

            // Xử lý dữ liệu cảnh báo SDR (Có chứa ảnh) - Giữ nguyên
            if (msg.event_type === "sdr_detect" && msg.device_id === selectedDeviceId) {
                if (msg.data && msg.data.spectrum_image_base64) {
                    setSdrData({
                        image: msg.data.spectrum_image_base64,
                        threatClass: msg.data.class || "Unknown",
                        confidence: msg.data.confidence || 0,
                        time: msg.data.event_time || new Date().toISOString()
                    });
                }
            }
        };

        loadHistory();
        window.addEventListener('device_update', handleGlobalUpdate);

        return () => {
            isMounted = false; 
            window.removeEventListener('device_update', handleGlobalUpdate);
        };
    }, [selectedDeviceId]);

    const handleDeviceChange = (e) => {
        setSelectedDeviceId(e.target.value);
    };

    // --- Biểu đồ Config ---
    const trendConfig = {
        labels: chartState.trendLabels,
        datasets: [{
            label: 'Avg C/N₀',
            data: chartState.trendData,
            borderColor: '#10b981', 
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 2.5, fill: true, tension: 0.3, pointRadius: 0
        }]
    };

    const skyplotConfig = {
        // Thêm nhãn cho QZSS và SBAS
        labels: ['GPS (G)', 'GLONASS (R)', 'Galileo (E)', 'BeiDou (C)', 'QZSS (J)', 'SBAS (S)'],
        datasets: [{
            data: chartState.skyplotCounts,
            backgroundColor: [
                'rgba(251, 191, 36, 0.8)',   // Vàng (GPS)
                'rgba(239, 68, 68, 0.8)',    // Đỏ (GLONASS)
                'rgba(59, 130, 246, 0.8)',   // Xanh dương (Galileo)
                'rgba(16, 185, 129, 0.8)',   // Xanh lá (BeiDou)
                'rgba(168, 85, 247, 0.8)',   // Tím (QZSS)
                'rgba(236, 72, 153, 0.8)'    // Hồng (SBAS)
            ],
            borderColor: '#1c1e22', 
            borderWidth: 3
        }]
    };

    let activeSats = new Set();
    chartState.historyBuffer.forEach(item => Object.keys(item.signals).forEach(prn => activeSats.add(prn)));
    let xLabels = Array.from(activeSats).sort();
    let zMatrix = chartState.historyBuffer.map(item => xLabels.map(prn => item.signals[prn] || 15));
    let yLabels = chartState.historyBuffer.map(item => item.time);

    return (
            <div className="dashboard-container">
                <div className="header-section">
                    <h1 className="header-title">Data Analytics</h1>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', backgroundColor: '#1c1e22', padding: '16px 24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <span style={{ fontSize: '1rem', fontWeight: '500', color: '#8b8d93' }}>Select Device:</span>
                        <select 
                            value={selectedDeviceId} 
                            onChange={handleDeviceChange} 
                            style={{ backgroundColor: '#131517', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.5)', padding: '10px 16px', borderRadius: '10px', outline: 'none', fontWeight: '600', cursor: 'pointer' }}
                        >
                            {devices.map(dev => (
                                <option key={dev.device_id} value={dev.device_id} style={{ backgroundColor: '#1c1e22', color: '#fff' }}>
                                    {dev.device_id} ({dev.device_type || 'Unknown'})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: '700', padding: '8px 16px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', color: isLive ? '#ef4444' : '#8b8d93', backgroundColor: isLive ? 'rgba(239, 68, 68, 0.1)' : 'transparent' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isLive ? '#ef4444' : '#8b8d93' }}></div>
                        {isLive ? 'LIVE STREAM ACTIVE' : 'WAITING FOR DATA'}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                    
                    {/* BẢN ĐỒ NHIỆT (WATERFALL) */}
                    <div className="chart-card" style={{ gridColumn: 'span 3', height: '450px', display: 'flex', flexDirection: 'column' }}>
                        <div className="chart-title tooltip-wrapper">
                            Spectrum Waterfall (Real-time) <span className="info-icon">ⓘ</span>
                            <div className="tooltip-glass">Bản đồ nhiệt thể hiện sự thay đổi cường độ tín hiệu C/N0 của các vệ tinh.</div>
                        </div>
                        <div style={{ flexGrow: 1, position: 'relative' }}>
                            <Plot
                                data={[{ z: zMatrix, x: xLabels, y: yLabels, type: 'heatmap', colorscale: 'Jet', zsmooth: 'best', zmin: 15, zmax: 55, showscale: true, colorbar: { tickfont: {color: '#8b8d93'}, thickness: 15 } }]}
                                layout={{ margin: { t: 10, r: 20, b: 40, l: 60 }, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', xaxis: { tickfont: {color: '#8b8d93', size: 11}, gridcolor: 'rgba(255,255,255,0.03)', tickangle: -45 }, yaxis: { tickfont: {color: '#8b8d93', size: 11}, gridcolor: 'rgba(255,255,255,0.03)', autorange: 'reversed' } }}
                                useResizeHandler={true} style={{ width: '100%', height: '100%' }} config={{ displayModeBar: false }}
                            />
                        </div>
                    </div>

                    {/* MỚI: KHU VỰC HIỂN THỊ ẢNH PHỔ SDR KHI CÓ CẢNH BÁO */}
                    <div className="chart-card" style={{ gridColumn: 'span 3', minHeight: '150px', display: 'flex', flexDirection: 'column', border: sdrData ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255,255,255,0.03)' }}>
                        <div className="chart-title tooltip-wrapper">
                            SDR Spectrum Analysis (AI Detect) <span className="info-icon">ⓘ</span>
                            <div className="tooltip-glass">Phân tích phổ bằng SDR và AI. Ảnh chỉ hiện khi phát hiện nhiễu sóng (Jamming/Spoofing).</div>
                        </div>
                        
                        <div style={{ flexGrow: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#131517', borderRadius: '10px', marginTop: '15px', padding: '15px' }}>
                            {sdrData && sdrData.image ? (
                                <div style={{ width: '100%', textAlign: 'center' }}>
                                    <div style={{ marginBottom: '15px', display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                        <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '1.1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '4px 12px', borderRadius: '6px' }}>
                                            ⚠️ Phát hiện: {sdrData.threatClass}
                                        </span>
                                        <span style={{ color: '#f59e0b', fontSize: '1.1rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '4px 12px', borderRadius: '6px' }}>
                                            Độ tự tin (AI): {(sdrData.confidence <= 1.0 ? sdrData.confidence * 100 : sdrData.confidence).toFixed(1)}%
                                        </span>
                                        <span style={{ color: '#8b8d93', fontSize: '1.1rem', backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: '4px 12px', borderRadius: '6px' }}>
                                            {(() => {
                                                let rawTime = sdrData.time;
                                                if (!rawTime.endsWith('Z') && !rawTime.includes('+')) rawTime += 'Z';
                                                return new Date(rawTime).toLocaleString('vi-VN');
                                            })()}
                                        </span>
                                    </div>
                                    {/* Khúc render chuỗi Base64 thành ảnh */}
                                    <img 
                                        src={`data:image/png;base64,${sdrData.image}`} 
                                        alt="SDR Spectrum Jamming" 
                                        style={{ maxWidth: '100%', maxHeight: '450px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', boxShadow: '0 10px 25px rgba(239, 68, 68, 0.15)' }} 
                                    />
                                </div>
                            ) : (
                                <span style={{ color: '#8b8d93', fontStyle: 'italic' }}>
                                    🟢 Hệ thống vô tuyến đang trong trạng thái bình thường. Chưa ghi nhận tín hiệu gây nhiễu.
                                </span>
                            )}
                        </div>
                    </div>

                    {/* BIỂU ĐỒ C/N0 */}
                    <div className="chart-card" style={{ gridColumn: 'span 2', height: '350px', display: 'flex', flexDirection: 'column' }}>
                        <div className="chart-title tooltip-wrapper">
                            Average C/N₀ Trend <span className="info-icon">ⓘ</span>
                            <div className="tooltip-glass">Biểu đồ thể hiện xu hướng thay đổi giá trị C/N₀ theo thời gian.</div>
                        </div>
                        <div style={{ flexGrow: 1, position: 'relative' }}>
                            <Line data={trendConfig} options={{ responsive: true, maintainAspectRatio: false, scales: { y: { min: 15, max: 60 }, x: { grid: { display: false } } }, plugins: { legend: { display: false } }, animation: { duration: 0 } }} />
                        </div>
                    </div>

                    {/* BẢN ĐỒ VỆ TINH (SKYPLOT) */}
                    <div className="chart-card" style={{ gridColumn: 'span 1', height: '350px', display: 'flex', flexDirection: 'column' }}>
                        <div className="chart-title tooltip-wrapper">
                            Skyplot Tracking <span className="info-icon">ⓘ</span>
                            <div className="tooltip-glass">Thống kê số lượng vệ tinh đang bắt được của từng hệ thống.</div>
                        </div>
                        <div style={{ flexGrow: 1, position: 'relative' }}>
                            <PolarArea 
                                data={skyplotConfig} 
                                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#e2e8f0', padding: 15, usePointStyle: true } } }, scales: { r: { ticks: { display: false }, grid: { color: 'rgba(255, 255, 255, 0.05)' }, angleLines: { color: 'rgba(255, 255, 255, 0.05)' } } } }} 
                            />
                        </div>
                    </div>
                </div>
            </div>
    );
};

export default Charts;