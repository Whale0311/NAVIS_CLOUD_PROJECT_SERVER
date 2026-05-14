// src/pages/Charts.jsx
import React, { useEffect, useState, useRef } from 'react';
import Layout from '../components/Layout';
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
    
    const chartStateRef = useRef({
        trendLabels: Array(MAX_HISTORY).fill('--:--'),
        trendData: Array(MAX_HISTORY).fill(null),
        skyplotCounts: [0, 0, 0, 0],
        historyBuffer: Array(MAX_HISTORY).fill({ time: '', signals: {} })
    });
    
    const [chartState, setChartState] = useState(chartStateRef.current);

    // ==========================================
    // HÀM XỬ LÝ DATA REALTIME TỪ WEBSOCKET
    // ==========================================
    const processNewTelemetry = (apiData) => {
        let rawTime = apiData.timestamp || apiData.event_time || new Date().toISOString();
        if (!rawTime.endsWith('Z') && !rawTime.includes('+')) rawTime += 'Z';
        const timeStr = new Date(rawTime).toLocaleTimeString('vi-VN');
        
        const signals = apiData.signals || apiData.signals_data || [];
        const currentCno = apiData.summary?.avg_cno_dbhz ?? apiData.avg_cno_dbhz ?? apiData.avg_cno ?? 0;

        const curr = chartStateRef.current;
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
            historyBuffer: newBuffer
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
            const token = localStorage.getItem("navis_token");
            try {
                const res = await fetch("http://127.0.0.1:8000/api/devices", {
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
        
        chartStateRef.current = {
            trendLabels: Array(MAX_HISTORY).fill('--:--'),
            trendData: Array(MAX_HISTORY).fill(null),
            skyplotCounts: [0, 0, 0, 0],
            historyBuffer: Array(MAX_HISTORY).fill({ time: '', signals: {} })
        };
        setChartState(chartStateRef.current);
        setIsLive(false);

        const loadHistory = async () => {
            const token = localStorage.getItem("navis_token");
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

                    chartStateRef.current = {
                        trendLabels: labels,
                        trendData: dataPoints,
                        skyplotCounts: calculateSkyplot(history[history.length - 1].signals_data),
                        historyBuffer: buffer
                    };
                    setChartState({ ...chartStateRef.current });
                }
            } catch (e) { console.error("Lỗi nạp dữ liệu lịch sử", e); }
        };

        const handleGlobalUpdate = (event) => {
            const msg = event.detail; 
            
            const isPosition = 
                msg.event_type === "telemetry_update" || 
                msg.event_type === "position_update" || 
                msg.event_type === "epoch" ||
                msg.schema === "gnss.detect.epoch.v1" ||
                (msg.data && msg.data.position !== undefined);

            // Cập nhật biểu đồ nếu data thuộc về đúng chiếc xe đang xem!
            if (isPosition && msg.device_id === selectedDeviceId) {
                processNewTelemetry(msg.data); 
            }
        };

        loadHistory();
        window.addEventListener('device_update', handleGlobalUpdate);

        return () => {
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
        labels: ['GPS (G)', 'GLONASS (R)', 'Galileo (E)', 'BeiDou (B)'],
        datasets: [{
            data: chartState.skyplotCounts,
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
                    <div className="chart-card" style={{ gridColumn: 'span 3', height: '450px', display: 'flex', flexDirection: 'column' }}>
                        <div className="chart-title tooltip-wrapper">
                            Spectrum Waterfall (Real-time) <span className="info-icon">ⓘ</span>
                            <div className="tooltip-glass">Bản đồ nhiệt thể hiện sự thay đổi cường độ tín hiệu...</div>
                        </div>
                        <div style={{ flexGrow: 1, position: 'relative' }}>
                            <Plot
                                data={[{ z: zMatrix, x: xLabels, y: yLabels, type: 'heatmap', colorscale: 'Jet', zsmooth: 'best', zmin: 15, zmax: 55, showscale: true, colorbar: { tickfont: {color: '#8b8d93'}, thickness: 15 } }]}
                                layout={{ margin: { t: 10, r: 20, b: 40, l: 60 }, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', xaxis: { tickfont: {color: '#8b8d93', size: 11}, gridcolor: 'rgba(255,255,255,0.03)', tickangle: -45 }, yaxis: { tickfont: {color: '#8b8d93', size: 11}, gridcolor: 'rgba(255,255,255,0.03)', autorange: 'reversed' } }}
                                useResizeHandler={true} style={{ width: '100%', height: '100%' }} config={{ displayModeBar: false }}
                            />
                        </div>
                    </div>

                    <div className="chart-card" style={{ gridColumn: 'span 2', height: '350px', display: 'flex', flexDirection: 'column' }}>
                        <div className="chart-title tooltip-wrapper">
                            Average C/N₀ Trend <span className="info-icon">ⓘ</span>
                            <div className="tooltip-glass">Biểu đồ thể hiện xu hướng thay đổi giá trị C/N₀ theo thời gian...</div>
                        </div>
                        <div style={{ flexGrow: 1, position: 'relative' }}>
                            <Line data={trendConfig} options={{ responsive: true, maintainAspectRatio: false, scales: { y: { min: 15, max: 60 }, x: { grid: { display: false } } }, plugins: { legend: { display: false } }, animation: { duration: 0 } }} />
                        </div>
                    </div>

                    <div className="chart-card" style={{ gridColumn: 'span 1', height: '350px', display: 'flex', flexDirection: 'column' }}>
                        <div className="chart-title tooltip-wrapper">
                            Skyplot Tracking <span className="info-icon">ⓘ</span>
                            <div className="tooltip-glass">Bản đồ thể hiện vị trí và trạng thái của các vệ tinh...</div>
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
        </Layout>
    );
};

export default Charts;