// src/pages/Dashboard.jsx
import React, { useEffect, useState, useRef } from 'react';
import Layout from '../components/Layout';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { Cpu, Wifi, Activity, Satellite } from 'lucide-react';

// Cập nhật màu sắc ChartJS theo tone Dark Mode mới
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);
ChartJS.defaults.color = '#8b8d93'; // Màu chữ xám nhạt
ChartJS.defaults.borderColor = 'rgba(255, 255, 255, 0.04)'; // Đường kẻ mờ
ChartJS.defaults.font.family = "'Inter', sans-serif";

const Dashboard = () => {
    // State quản lý KPI
    const [kpi, setKpi] = useState({ total: 0, conn: 0, cno: '--', sat: '--' });
    
    // State quản lý Data của Biểu đồ
    const [chartData, setChartData] = useState({
        labels: [],
        cnoData: [],
        satData: []
    });

    // BỘ NHỚ ĐỆM (Ref) ĐỂ LƯU DATA REALTIME
    const devicesRef = useRef([]); 

    useEffect(() => {
        let isMounted = true; 

        // 1. HÀM GỌI API LẤY DATA KHỞI TẠO
        const fetchDashboardData = async () => {
            const token = localStorage.getItem("navis_token");
            try {
                const response = await fetch("/api/devices", {
                    method: "GET",
                    headers: { "Authorization": `Bearer ${token}` }
                });

                if (response.status === 401) {
                    localStorage.removeItem("navis_token");
                    window.location.href = '/';
                    return;
                }
                const dbDevices = await response.json();

                const checkIsOnline = (timestamp) => {
                    if (!timestamp) return false;
                    let rawTime = timestamp;
                    if (!rawTime.endsWith('Z') && !rawTime.includes('+')) rawTime += 'Z';
                    return (new Date().getTime() - new Date(rawTime).getTime()) < 15000;
                };

                const telemetryPromises = dbDevices.map(async (dev) => {
                    try {
                        const telRes = await fetch(`/api/devices/${dev.device_id}/telemetry?limit=1`, {
                            headers: { "Authorization": `Bearer ${token}` }
                        });
                        
                        if (telRes.ok) {
                            const telData = await telRes.json();
                            if (telData && telData.length > 0) {
                                const isOnline = checkIsOnline(telData[0].timestamp);
                                return {
                                    name: dev.device_id,
                                    is_active: isOnline, 
                                    // ÉP NÓ TÌM ĐÚNG BIẾN CHUẨN MỚI TỪ API
                                    cno: isOnline ? (telData[0].avg_cno_dbhz ?? telData[0].avg_cno ?? 0) : 0, 
                                    sat: isOnline ? (telData[0].sat_count ?? 0) : 0,
                                    last_seen: telData[0].timestamp 
                                };
                            }
                        }
                    } catch (error) { console.error(`Lỗi tải tín hiệu ${dev.device_id}`); }
                    
                    return { name: dev.device_id, is_active: false, cno: 0, sat: 0, last_seen: null };
                });

                const devicesWithTelemetry = await Promise.all(telemetryPromises);
                
                if (isMounted) {
                    devicesRef.current = devicesWithTelemetry; 
                    updateDashboard(devicesWithTelemetry);     
                }

            } catch (error) { console.error("Lỗi kết nối Server:", error); }
        };

        // 2. HÀM TÍNH TOÁN LẠI BIỂU ĐỒ VÀ KPI (ĐÃ FIX CHỈ TÍNH XE ONLINE)
        const updateDashboard = (dataList) => {
            if (!dataList || dataList.length === 0) return;

            let totalCno = 0, totalSat = 0, activeCount = 0, validCnoDevices = 0;
            let labels = [], cnoData = [], satData = [];

            dataList.forEach(device => {
                // CHỈ CỘNG VỆ TINH & CNO NẾU XE ĐANG ONLINE
                if(device.is_active) {
                    activeCount++;
                    totalSat += device.sat;
                    if (device.cno > 0) {
                        totalCno += device.cno;
                        validCnoDevices++;
                    }
                }

                labels.push(device.name);
                cnoData.push(device.cno);
                satData.push(device.sat);
            });

            setKpi({
                total: dataList.length,
                conn: activeCount,
                cno: validCnoDevices > 0 ? (totalCno / validCnoDevices).toFixed(1) : "--",
                // CHIA CHO SỐ XE ONLINE THAY VÌ TỔNG SỐ XE
                sat: activeCount > 0 ? Math.round(totalSat / activeCount) : "--" 
            });

            setChartData({ labels, cnoData, satData });
        };

        // 3. LẮNG NGHE SỰ KIỆN TỪ SOCKET CONTEXT TOÀN CỤC
        // 3. LẮNG NGHE SỰ KIỆN TỪ SOCKET CONTEXT TOÀN CỤC
        // ===============================================
        // DASHBOARD.JSX: LẮNG NGHE SỰ KIỆN TỪ SOCKET
        // ===============================================
        const handleGlobalUpdate = (event) => {
            const msg = event.detail; 
            
            // CƠ CHẾ BẮT TỌA ĐỘ: Check theo chuẩn mới (có nhánh summary)
            const isPosition = 
                msg.event_type === "telemetry_update" || 
                msg.event_type === "position_update" || 
                (msg.data && msg.data.summary !== undefined);

            if (isPosition) {
                devicesRef.current = devicesRef.current.map(d => {
                    // Chú ý: Ở Dashboard biến ID xe có thể lưu dưới dạng d.name
                    if (d.name === msg.device_id || d.device_id === msg.device_id) {
                        return { 
                            ...d, 
                            is_active: true, 
                            // Móc dữ liệu từ nhánh summary
                            cno: msg.data.summary?.avg_cno_dbhz || d.cno,
                            sat: msg.data.summary?.sat_count || d.sat,
                            last_seen: new Date().toISOString() 
                        };
                    }
                    return d;
                });
                
                // Cập nhật lại UI Dashboard
                updateDashboard([...devicesRef.current]);
            }
        };

        window.addEventListener('device_update', handleGlobalUpdate);
        
        fetchDashboardData();

        // 4. HÀM QUÉT DỌN THIẾT BỊ OFFLINE
        const cleanupInterval = setInterval(() => {
            const now = new Date().getTime();
            let hasChanges = false;
            
            devicesRef.current = devicesRef.current.map(d => {
                if (d.last_seen && d.is_active) {
                    let rawTime = d.last_seen;
                    if (!rawTime.endsWith('Z') && !rawTime.includes('+')) rawTime += 'Z';
                    
                    const timeDiff = now - new Date(rawTime).getTime();
                    
                    if (timeDiff > 15000) {
                        hasChanges = true;
                        return { ...d, is_active: false, cno: 0, sat: 0 };
                    }
                }
                return d;
            });

            if (hasChanges) {
                updateDashboard([...devicesRef.current]); 
            }
        }, 5000);

        // 5. TẮT TAI NGHE KHI CHUYỂN TRANG
        return () => { 
            isMounted = false; 
            window.removeEventListener('device_update', handleGlobalUpdate);
            clearInterval(cleanupInterval);
        };
    }, []);

    // Tùy chỉnh màu biểu đồ sang Xanh Lime Neon
    const cnoChartConfig = {
        labels: chartData.labels,
        datasets: [{ 
            label: 'CN₀ (dB-Hz)', 
            data: chartData.cnoData, 
            backgroundColor: '#10b981', // <--- Sửa ở đây
            borderRadius: 6,
            barThickness: 24
        }]
    };
    
    const satChartConfig = {
        labels: chartData.labels,
        datasets: [{ 
            label: 'Số vệ tinh', 
            data: chartData.satData, 
            backgroundColor: '#3b3f46', 
            hoverBackgroundColor: '#10b981', // <--- Sửa hiệu ứng hover ở đây
            borderRadius: 6,
            barThickness: 24
        }]
    };
    
    const chartOptions = { 
        responsive: true, 
        maintainAspectRatio: false, 
        plugins: { legend: { display: false } } 
    };

    return (
        <Layout>
            <div className="dashboard-container">
                <div className="header-section">
                    <h1 className="header-title">Overview</h1>
                </div>
                
                {/* THIẾT KẾ THẺ KPI MỚI */}
                <div className="kpi-grid">
                    
                    {/* Thẻ 1: Tổng thiết bị */}
                    <div className="kpi-card">
                        <div className="kpi-header">
                            <span>Tổng thiết bị</span>
                            <Cpu size={18} color="#8b8d93" />
                        </div>
                        <div className="kpi-value">{kpi.total}</div>
                    </div>

                    {/* Thẻ 2: Đã kết nối */}
                    <div className="kpi-card">
                        <div className="kpi-header">
                            <span>Đã kết nối</span>
                            <Wifi size={18} color="#10b981" /> 
                        </div>
                        <div className="kpi-value highlight">{kpi.conn}</div>
                    </div>

                    {/* Thẻ 3 */}
                    <div className="kpi-card">
                        <div className="kpi-header">
                            <span>CN₀ TB Hệ thống</span>
                            <Activity size={18} color="#8b8d93" />
                        </div>
                        <div className="kpi-value-group">
                            <span className="kpi-value">{kpi.cno}</span>
                            <span className="kpi-unit">dB-Hz</span>
                        </div>
                    </div>

                    {/* Thẻ 4 */}
                    <div className="kpi-card">
                        <div className="kpi-header">
                            <span>Vệ tinh Tracking</span>
                            <Satellite size={18} color="#8b8d93" />
                        </div>
                        <div className="kpi-value">{kpi.sat}</div>
                    </div>
                </div>

                <div className="chart-grid">
                    <div className="chart-card">
                        <div className="chart-title">CN₀ Trung Bình Theo Thiết Bị</div>
                        <div className="chart-container">
                            <Bar data={cnoChartConfig} options={{...chartOptions, scales: { y: { beginAtZero: true, max: 60 } }}} />
                        </div>
                    </div>
                    <div className="chart-card">
                        <div className="chart-title">Số Lượng Vệ Tinh Theo Thiết Bị</div>
                        <div className="chart-container">
                            <Bar data={satChartConfig} options={{...chartOptions, scales: { y: { beginAtZero: true, max: 40 } }}} />
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default Dashboard;