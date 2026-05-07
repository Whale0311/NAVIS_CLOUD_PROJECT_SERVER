import React, { useEffect, useState, useRef } from 'react';
import Layout from '../components/Layout';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler, RadialLinearScale, ArcElement
} from 'chart.js';
import { Line, PolarArea } from 'react-chartjs-2';

// --- CÁCH IMPORT BAO ĐẬM CHO VITE ---
import Plotly from 'plotly.js-dist';
import factory from 'react-plotly.js/factory';

const createPlotlyComponent = factory.default || factory;
const Plot = createPlotlyComponent(Plotly);

// Đăng ký các thư viện cho Chart.js
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler, RadialLinearScale, ArcElement);
ChartJS.defaults.color = '#94a3b8';
ChartJS.defaults.borderColor = 'rgba(255,255,255,0.05)';
ChartJS.defaults.font.family = "'Segoe UI', Tahoma, sans-serif";

const MAX_HISTORY = 60;

// 1. Hàm Helper (Đưa lên trên cùng để các hàm bên dưới gọi được)
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

    // 2. Hàm xử lý Telemetry Real-time
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

    // 3. Load danh sách thiết bị
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

    // 4. Quản lý luồng dữ liệu (Lịch sử + Polling)
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

                // Bắt đầu vòng lặp Real-time
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
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 2.5, fill: true, tension: 0.3, pointRadius: 0
        }]
    };

    const skyplotConfig = {
        labels: ['GPS (G)', 'GLONASS (R)', 'Galileo (E)', 'BeiDou (B)'],
        datasets: [{
            data: chartState.skyplotCounts,
            backgroundColor: ['rgba(251, 191, 36, 0.7)','rgba(239, 68, 68, 0.7)','rgba(59, 130, 246, 0.7)','rgba(16, 185, 129, 0.7)'],
            borderColor: '#141414', borderWidth: 3
        }]
    };

    let activeSats = new Set();
    chartState.historyBuffer.forEach(item => Object.keys(item.signals).forEach(prn => activeSats.add(prn)));
    let xLabels = Array.from(activeSats).sort();
    let zMatrix = chartState.historyBuffer.map(item => xLabels.map(prn => item.signals[prn] || 15));
    let yLabels = chartState.historyBuffer.map(item => item.time);

    return (
        <Layout>
            <div className="control-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', background: 'rgba(255,255,255,0.02)', padding: '15px 25px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#e2e8f0' }}>Data Analytics</div>
                    <select value={selectedDeviceId} onChange={handleDeviceChange} style={{ background: 'rgba(0,0,0,0.4)', color: '#10b981', border: '1px solid #10b981', padding: '8px 15px', borderRadius: '8px', outline: 'none' }}>
                        {devices.map(dev => (
                            <option key={dev.device_id} value={dev.device_id} style={{ background: '#1a1a1a', color: '#fff' }}>
                                {dev.device_id} ({dev.device_type || 'Unknown'})
                            </option>
                        ))}
                    </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 'bold', padding: '6px 12px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', color: isLive ? '#ef4444' : '#a3a3a3', background: isLive ? 'rgba(239, 68, 68, 0.1)' : 'transparent' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isLive ? '#ef4444' : '#a3a3a3' }}></div>
                    {isLive ? 'LIVE STREAM ACTIVE' : 'WAITING FOR DATA'}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '25px' }}>
                <div style={{ gridColumn: 'span 2', background: 'rgba(20, 20, 20, 0.6)', padding: '25px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#10b981', textAlign: 'center', marginBottom: '15px' }}>Spectrum Waterfall (Real-time)</div>
                    <Plot
                        data={[{ z: zMatrix, x: xLabels, y: yLabels, type: 'heatmap', colorscale: 'Jet', zsmooth: 'best', zmin: 15, zmax: 55, showscale: true, colorbar: { tickfont: {color: '#a3a3a3'}, thickness: 15 } }]}
                        layout={{ margin: { t: 20, r: 20, b: 40, l: 80 }, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', xaxis: { tickfont: {color: '#a3a3a3', size: 10}, gridcolor: 'rgba(0,0,0,0)', tickangle: -45 }, yaxis: { tickfont: {color: '#a3a3a3', size: 10}, gridcolor: 'rgba(0,0,0,0)', autorange: 'reversed' } }}
                        useResizeHandler={true} style={{ width: '100%', height: '400px' }} config={{ displayModeBar: false }}
                    />
                </div>

                <div style={{ background: 'rgba(20, 20, 20, 0.6)', padding: '25px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', height: '350px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '15px' }}>Average C/N₀ Trend</div>
                    <div style={{ flexGrow: 1, position: 'relative' }}>
                        <Line data={trendConfig} options={{ responsive: true, maintainAspectRatio: false, scales: { y: { min: 15, max: 60 }, x: { grid: { display: false } } }, plugins: { legend: { display: false } }, animation: { duration: 0 } }} />
                    </div>
                </div>

                <div style={{ background: 'rgba(20, 20, 20, 0.6)', padding: '25px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', height: '350px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '15px' }}>Skyplot Tracking (Constellations)</div>
                                            {/* Tìm đến phần Skyplot Radar và cập nhật thuộc tính options */}
                        <div style={{ flexGrow: 1, position: 'relative' }}>
                            <PolarArea 
                                data={skyplotConfig} 
                                options={{ 
                                    responsive: true, 
                                    maintainAspectRatio: false, 
                                    plugins: { 
                                        legend: { 
                                            position: 'right',
                                            labels: { color: '#e2e8f0' }
                                        } 
                                    }, 
                                    scales: { 
                                        r: { 
                                            // 1. Ẩn các con số (1, 2, 3...) ở trục tâm
                                            ticks: { display: false }, 
                                            // 2. Làm mờ các đường lưới vòng tròn để làm nổi bật các rẻ quạt
                                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                                            // 3. Đường kẻ phân vùng (angle lines)
                                            angleLines: { color: 'rgba(255, 255, 255, 0.1)' }
                                        } 
                                    } 
                                }} 
                            />
                        </div>
                </div>
            </div>
        </Layout>
    );
};

export default Charts;