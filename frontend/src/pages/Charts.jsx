// src/pages/Charts.jsx
import React, { useEffect, useState, useRef } from 'react';
import Layout from '../components/Layout';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler, RadialLinearScale, ArcElement
} from 'chart.js';
import { Line, PolarArea } from 'react-chartjs-2';

// --- IMPORT CHO PLOTLY ---
import Plotly from 'plotly.js-dist';
import factory from 'react-plotly.js/factory';

const createPlotlyComponent = factory.default || factory;
const Plot = createPlotlyComponent(Plotly);

// Đăng ký các thư viện cho Chart.js và cấu hình màu Dark Mode đồng bộ
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler, RadialLinearScale, ArcElement);
ChartJS.defaults.color = '#8b8d93'; // Màu chữ xám nhạt
ChartJS.defaults.borderColor = 'rgba(255, 255, 255, 0.04)'; // Đường lưới mờ
ChartJS.defaults.font.family = "'Inter', system-ui, sans-serif";

const MAX_HISTORY = 60;

const calculateSkyplot = (signals) => {
    let counts = [0, 0, 0, 0];
    (signals || []).forEach(s => {
        if (s.prn.startsWith('G')) counts[0]++;
        else if (s.prn.startsWith('R')) counts[1]++;
        else if (s.prn.startsWith('E')) counts[2]++;
        else if (s.prn.startsWith('B')) counts[3]++;
    });
    return counts;
};

const Charts = () => {
    const [devices, setDevices] = useState([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState('');
    const [isLive, setIsLive] = useState(false);
    const lastTelemetryIdRef = useRef(null);

    const [chartState, setChartState] = useState({
        trendLabels: Array(MAX_HISTORY).fill('--:--'),
        trendData: Array(MAX_HISTORY).fill(null),
        skyplotCounts: [0, 0, 0, 0],
        historyBuffer: Array(MAX_HISTORY).fill({ time: '', signals: {} })
    });

    const processNewTelemetry = (apiData) => {
        let rawTime = apiData.timestamp;
        if (!rawTime.endsWith('Z') && !rawTime.includes('+')) rawTime += 'Z';
        const timeStr = new Date(rawTime).toLocaleTimeString('vi-VN');
        const signals = apiData.signals_data || [];

        setChartState(prevState => {
            const newLabels = [...prevState.trendLabels.slice(1), timeStr];
            const newData = [...prevState.trendData.slice(1), apiData.avg_cno];
            let sigMap = {};
            signals.forEach(s => sigMap[s.prn] = s.cno);
            const newBuffer = [{ time: timeStr, signals: sigMap }, ...prevState.historyBuffer.slice(0, -1)];

            return {
                trendLabels: newLabels,
                trendData: newData,
                skyplotCounts: calculateSkyplot(signals),
                historyBuffer: newBuffer
            };
        });
    };

    useEffect(() => {
        const loadDevices = async () => {
            const token = localStorage.getItem("navis_token");
            try {
                const res = await fetch("http://127.0.0.1:8000/api/devices", {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (!res.ok) return;
                const dbDevices = await res.json();
                setDevices(dbDevices);
                if (dbDevices.length > 0) setSelectedDeviceId(dbDevices[0].device_id);
            } catch (e) { console.error("Lỗi lấy thiết bị", e); }
        };
        loadDevices();
    }, []);

    useEffect(() => {
        if (!selectedDeviceId) return;

        let intervalId;
        const token = localStorage.getItem("navis_token");

        const loadHistoryAndStartLive = async () => {
            try {
                const res = await fetch(`http://127.0.0.1:8000/api/devices/${selectedDeviceId}/telemetry?limit=${MAX_HISTORY}`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                const dataArray = await res.json();

                if (dataArray && dataArray.length > 0) {
                    const history = [...dataArray].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                    const labels = [];
                    const dataPoints = [];
                    const buffer = [];

                    history.forEach(item => {
                        let rawTime = item.timestamp;
                        if (!rawTime.endsWith('Z') && !rawTime.includes('+')) rawTime += 'Z';
                        const timeStr = new Date(rawTime).toLocaleTimeString('vi-VN');
                        labels.push(timeStr);
                        dataPoints.push(item.avg_cno);
                        let sigMap = {};
                        (item.signals_data || []).forEach(s => sigMap[s.prn] = s.cno);
                        buffer.unshift({ time: timeStr, signals: sigMap });
                    });

                    while (labels.length < MAX_HISTORY) labels.unshift('--:--');
                    while (dataPoints.length < MAX_HISTORY) dataPoints.unshift(null);
                    while (buffer.length < MAX_HISTORY) buffer.push({ time: '', signals: {} });

                    setChartState({
                        trendLabels: labels,
                        trendData: dataPoints,
                        skyplotCounts: calculateSkyplot(history[history.length - 1].signals_data),
                        historyBuffer: buffer
                    });
                    lastTelemetryIdRef.current = history[history.length - 1].id;
                }

                intervalId = setInterval(async () => {
                    try {
                        const liveRes = await fetch(`http://127.0.0.1:8000/api/devices/${selectedDeviceId}/telemetry?limit=1`, {
                            headers: { "Authorization": `Bearer ${token}` }
                        });
                        const liveData = await liveRes.json();
                        if (liveData && liveData.length > 0) {
                            const latest = liveData[0];
                            let rTime = latest.timestamp;
                            if (!rTime.endsWith('Z') && !rTime.includes('+')) rTime += 'Z';
                            setIsLive((new Date().getTime() - new Date(rTime).getTime()) < 15000);

                            if (latest.id !== lastTelemetryIdRef.current) {
                                lastTelemetryIdRef.current = latest.id;
                                processNewTelemetry(latest);
                            }
                        }
                    } catch (err) { setIsLive(false); }
                }, 1000);
            } catch (e) { console.error("Lỗi nạp dữ liệu", e); }
        };

        loadHistoryAndStartLive();
        return () => { if (intervalId) clearInterval(intervalId); };
    }, [selectedDeviceId]);

    const handleDeviceChange = (e) => {
        setSelectedDeviceId(e.target.value);
        lastTelemetryIdRef.current = null;
        setIsLive(false);
        setChartState({
            trendLabels: Array(MAX_HISTORY).fill('--:--'),
            trendData: Array(MAX_HISTORY).fill(null),
            skyplotCounts: [0, 0, 0, 0],
            historyBuffer: Array(MAX_HISTORY).fill({ time: '', signals: {} })
        });
    };

    // --- Biểu đồ Config ---
    const trendConfig = {
        labels: chartState.trendLabels,
        datasets: [{
            label: 'Avg C/N₀',
            data: chartState.trendData,
            borderColor: '#10b981', // Màu xanh ngọc dạ quang
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 2.5, fill: true, tension: 0.3, pointRadius: 0
        }]
    };

    const skyplotConfig = {
        labels: ['GPS (G)', 'GLONASS (R)', 'Galileo (E)', 'BeiDou (B)'],
        datasets: [{
            data: chartState.skyplotCounts,
            // Các màu vệ tinh tùy chỉnh, thêm viền đậm cùng màu nền card (#1c1e22) để tạo độ sắc nét
            backgroundColor: ['rgba(251, 191, 36, 0.8)','rgba(239, 68, 68, 0.8)','rgba(59, 130, 246, 0.8)','rgba(16, 185, 129, 0.8)'],
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
        <Layout>
            <div className="dashboard-container">
                {/* Tiêu đề trang */}
                <div className="header-section">
                    <h1 className="header-title">Data Analytics</h1>
                </div>

                {/* Thanh Control Bar */}
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

                {/* Grid chứa Biểu đồ */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                    
                    {/* Plotly Heatmap (Chiếm 3 cột nếu muốn tràn ngang, hoặc 2 cột tùy ý) */}
                    <div className="chart-card" style={{ gridColumn: 'span 3', height: '450px', display: 'flex', flexDirection: 'column' }}>
                        <div className="chart-title">Spectrum Waterfall (Real-time)</div>
                        <div style={{ flexGrow: 1, position: 'relative' }}>
                            <Plot
                                data={[{ z: zMatrix, x: xLabels, y: yLabels, type: 'heatmap', colorscale: 'Jet', zsmooth: 'best', zmin: 15, zmax: 55, showscale: true, colorbar: { tickfont: {color: '#8b8d93'}, thickness: 15 } }]}
                                layout={{ margin: { t: 10, r: 20, b: 40, l: 60 }, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', xaxis: { tickfont: {color: '#8b8d93', size: 11}, gridcolor: 'rgba(255,255,255,0.03)', tickangle: -45 }, yaxis: { tickfont: {color: '#8b8d93', size: 11}, gridcolor: 'rgba(255,255,255,0.03)', autorange: 'reversed' } }}
                                useResizeHandler={true} style={{ width: '100%', height: '100%' }} config={{ displayModeBar: false }}
                            />
                        </div>
                    </div>

                    {/* Biểu đồ Line */}
                    <div className="chart-card" style={{ gridColumn: 'span 2', height: '350px', display: 'flex', flexDirection: 'column' }}>
                        <div className="chart-title">Average C/N₀ Trend</div>
                        <div style={{ flexGrow: 1, position: 'relative' }}>
                            <Line data={trendConfig} options={{ responsive: true, maintainAspectRatio: false, scales: { y: { min: 15, max: 60 }, x: { grid: { display: false } } }, plugins: { legend: { display: false } }, animation: { duration: 0 } }} />
                        </div>
                    </div>

                    {/* Biểu đồ Radar/Polar Area */}
                    <div className="chart-card" style={{ gridColumn: 'span 1', height: '350px', display: 'flex', flexDirection: 'column' }}>
                        <div className="chart-title">Skyplot Tracking</div>
                        <div style={{ flexGrow: 1, position: 'relative' }}>
                            <PolarArea 
                                data={skyplotConfig} 
                                options={{ 
                                    responsive: true, 
                                    maintainAspectRatio: false, 
                                    plugins: { 
                                        legend: { 
                                            position: 'bottom', // Đưa legend xuống dưới cho gọn trên màn nhỏ
                                            labels: { color: '#e2e8f0', padding: 15, usePointStyle: true }
                                        } 
                                    }, 
                                    scales: { 
                                        r: { 
                                            ticks: { display: false }, 
                                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                                            angleLines: { color: 'rgba(255, 255, 255, 0.05)' }
                                        } 
                                    } 
                                }} 
                            />
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default Charts;