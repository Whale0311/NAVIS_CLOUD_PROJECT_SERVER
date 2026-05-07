// src/pages/Dashboard.jsx
import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { Cpu, Wifi, Activity, Satellite } from 'lucide-react';
// Đăng ký các module cho ChartJS
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);
ChartJS.defaults.color = '#a3a3a3';
ChartJS.defaults.borderColor = 'rgba(255,255,255,0.05)';

const Dashboard = () => {
    // State quản lý KPI
    const [kpi, setKpi] = useState({ total: 0, conn: 0, cno: '--', sat: '--' });
    
    // State quản lý Data của Biểu đồ
    const [chartData, setChartData] = useState({
        labels: [],
        cnoData: [],
        satData: []
    });

    useEffect(() => {
        let isMounted = true; // Tránh lỗi memory leak khi chuyển trang nhanh

        const fetchDashboardData = async () => {
            const token = localStorage.getItem("navis_token");
            try {
                // 1. Fetch danh sách thiết bị
                const response = await fetch("http://127.0.0.1:8000/api/devices", {
                    method: "GET",
                    headers: { "Authorization": `Bearer ${token}` }
                });

                if (response.status === 401) {
                    localStorage.removeItem("navis_token");
                    window.location.href = '/';
                    return;
                }
                const dbDevices = await response.json();

                // Hàm helper kiểm tra Timeout (15s) ngay tại đây
                const checkIsOnline = (timestamp) => {
                    if (!timestamp) return false;
                    let rawTime = timestamp;
                    if (!rawTime.endsWith('Z') && !rawTime.includes('+')) rawTime += 'Z';
                    return (new Date().getTime() - new Date(rawTime).getTime()) < 15000;
                };

                // 2. Fetch Telemetry song song
                const telemetryPromises = dbDevices.map(async (dev) => {
                    try {
                        const telRes = await fetch(`http://127.0.0.1:8000/api/devices/${dev.device_id}/telemetry?limit=1`, {
                            headers: { "Authorization": `Bearer ${token}` }
                        });
                        
                        if (telRes.ok) {
                            const telData = await telRes.json();
                            if (telData && telData.length > 0) {
                                // Kiểm tra xem gói tin này là mới hay cũ
                                const isOnline = checkIsOnline(telData[0].timestamp);
                                
                                return {
                                    name: dev.device_id,
                                    is_active: isOnline, // Đếm thiết bị Online thực sự
                                    cno: isOnline ? (telData[0].avg_cno || 0) : 0, // Offline thì ép về 0
                                    sat: isOnline ? (telData[0].sat_count || 0) : 0  // Offline thì ép về 0
                                };
                            }
                        }
                    } catch (error) { console.error(`Lỗi tải tín hiệu ${dev.device_id}`); }
                    
                    return { name: dev.device_id, is_active: false, cno: 0, sat: 0 };
                });

                const devicesWithTelemetry = await Promise.all(telemetryPromises);
                
                // 3. Tính toán và Cập nhật State
                if (isMounted) updateDashboard(devicesWithTelemetry);

            } catch (error) { console.error("Lỗi kết nối Server:", error); }
        };

        const updateDashboard = (dataList) => {
            if (!dataList || dataList.length === 0) return;

            let totalCno = 0, totalSat = 0, activeCount = 0, validCnoDevices = 0;
            let labels = [], cnoData = [], satData = [];

            dataList.forEach(device => {
                if(device.is_active) activeCount++;
                if (device.cno > 0) {
                    totalCno += device.cno;
                    validCnoDevices++;
                }
                totalSat += device.sat;

                labels.push(device.name);
                cnoData.push(device.cno);
                satData.push(device.sat);
            });

            setKpi({
                total: dataList.length,
                conn: activeCount,
                cno: validCnoDevices > 0 ? (totalCno / validCnoDevices).toFixed(1) : "--",
                sat: dataList.length > 0 ? Math.round(totalSat / dataList.length) : "--"
            });

            setChartData({ labels, cnoData, satData });
        };

        // GỌI LẦN ĐẦU VÀ THIẾT LẬP VÒNG LẶP (5 GIÂY / LẦN)
        fetchDashboardData();
        const intervalId = setInterval(fetchDashboardData, 5000);

        // DỌN DẸP BỘ NHỚ KHI RỜI KHỎI TRANG
        return () => { 
            isMounted = false; 
            clearInterval(intervalId); 
        };
    }, []);

    // Tùy chỉnh hiển thị Biểu đồ
    const cnoChartConfig = {
        labels: chartData.labels,
        datasets: [{ label: 'CN₀ (dB-Hz)', data: chartData.cnoData, backgroundColor: '#10b981', borderRadius: 4 }]
    };
    const satChartConfig = {
        labels: chartData.labels,
        datasets: [{ label: 'Số vệ tinh', data: chartData.satData, backgroundColor: '#06b6d4', borderRadius: 4 }]
    };
    const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } };

    return (
        <Layout>
            <div className="header-title">GNSS Dashboard</div>
            
            {/* THIẾT KẾ THẺ KPI MỚI */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '25px', marginBottom: '35px' }}>
                
                {/* Thẻ 1: Tổng thiết bị */}
                <div className="kpi-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontSize: '0.9rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        <span>Tổng thiết bị</span>
                        <Cpu size={22} color="#f8fafc" />
                    </div>
                    <div style={{ fontSize: '2.6rem', fontWeight: '800', color: '#f8fafc', letterSpacing: '-1px' }}>
                        {kpi.total}
                    </div>
                </div>

                {/* Thẻ 2: Đã kết nối */}
                <div className="kpi-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontSize: '0.9rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        <span>Đã kết nối</span>
                        <Wifi size={22} color="#10b981" />
                    </div>
                    <div style={{ fontSize: '2.6rem', fontWeight: '800', color: '#10b981', letterSpacing: '-1px' }}>
                        {kpi.conn}
                    </div>
                </div>

                {/* Thẻ 3: C/N0 Trung bình */}
                <div className="kpi-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontSize: '0.9rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        <span>CN₀ TB Hệ thống</span>
                        <Activity size={22} color="#06b6d4" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <span style={{ fontSize: '2.6rem', fontWeight: '800', color: '#06b6d4', letterSpacing: '-1px' }}>{kpi.cno}</span>
                        <span style={{ fontSize: '1rem', fontWeight: '600', color: '#64748b' }}>dB-Hz</span>
                    </div>
                </div>

                {/* Thẻ 4: Vệ tinh Tracking */}
                <div className="kpi-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontSize: '0.9rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        <span>Vệ tinh Tracking</span>
                        <Satellite size={22} color="#8b5cf6" />
                    </div>
                    <div style={{ fontSize: '2.6rem', fontWeight: '800', color: '#8b5cf6', letterSpacing: '-1px' }}>
                        {kpi.sat}
                    </div>
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
                    <div className="chart-title" style={{ color: '#06b6d4' }}>Số Lượng Vệ Tinh Theo Thiết Bị</div>
                    <div className="chart-container">
                        <Bar data={satChartConfig} options={{...chartOptions, scales: { y: { beginAtZero: true, max: 40 } }}} />
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default Dashboard;