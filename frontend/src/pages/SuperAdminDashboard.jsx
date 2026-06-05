import React, { useEffect, useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import { Building2, HardDrive, Users, Server } from 'lucide-react';
import { toast } from 'react-toastify';

// Đăng ký thêm ArcElement cho biểu đồ tròn (Pie Chart)
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const SuperAdminDashboard = () => {
    const [stats, setStats] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            const token = localStorage.getItem("navis_token") || localStorage.getItem("access_token");
            try {
                const res = await fetch("/api/admin/dashboard-stats", {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setStats(data);
                } else {
                    toast.error("Không thể tải dữ liệu hệ thống");
                }
            } catch (error) {
                toast.error("Lỗi kết nối Server");
            } finally {
                setIsLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (isLoading) return <div style={{ color: '#8b8d93', padding: '30px' }}>Đang tải dữ liệu Command Center...</div>;
    if (!stats) return <div style={{ color: '#ef4444', padding: '30px' }}>Lỗi truy xuất dữ liệu.</div>;

    // Config Biểu đồ Tròn (Phân bổ thiết bị)
    const pieData = {
        labels: stats.charts.distribution.map(d => d.tenant_name),
        datasets: [{
            data: stats.charts.distribution.map(d => d.count),
            backgroundColor: ['#10b981', '#3b82f6', '#a855f7', '#ef4444', '#f59e0b', '#06b6d4'],
            borderWidth: 0,
            hoverOffset: 4
        }]
    };

    // Config Biểu đồ Cột (Tăng trưởng)
    const barData = {
        labels: stats.charts.monthly.map(d => d.month),
        datasets: [{
            label: 'Thiết bị kích hoạt mới',
            data: stats.charts.monthly.map(d => d.devices),
            backgroundColor: '#3b82f6',
            borderRadius: 4,
        }]
    };

    return (
        <div className="dashboard-container">
            <div className="header-section" style={{ marginBottom: '25px' }}>
                <h1 className="header-title">Command Center</h1>
                <p style={{ color: '#8b8d93', fontSize: '0.9rem', marginTop: '5px' }}>Tổng quan tình trạng hoạt động của toàn bộ Hệ thống SaaS.</p>
            </div>

            {/* 4 THẺ KPI */}
            <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                
                {/* 1. Tổ chức */}
                <div className="kpi-card" style={{ background: '#1c1e22', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8b8d93', marginBottom: '15px' }}>
                        <span style={{ fontWeight: '600' }}>Tổ chức (Tenants)</span>
                        <Building2 size={20} color="#a855f7" />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: '700', color: '#fff' }}>{stats.kpi.tenants.total}</div>
                    <div style={{ fontSize: '0.85rem', color: '#10b981', marginTop: '5px' }}>
                        {stats.kpi.tenants.active} đang hoạt động / {stats.kpi.tenants.total - stats.kpi.tenants.active} bị khóa
                    </div>
                </div>

                {/* 2. Thiết bị */}
                <div className="kpi-card" style={{ background: '#1c1e22', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8b8d93', marginBottom: '15px' }}>
                        <span style={{ fontWeight: '600' }}>Tài nguyên Thiết bị</span>
                        <HardDrive size={20} color="#3b82f6" />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: '700', color: '#fff' }}>
                        {stats.kpi.devices.used} <span style={{ fontSize: '1rem', color: '#8b8d93' }}>/ {stats.kpi.devices.capacity}</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#8b8d93', marginTop: '5px' }}>
                        Đã chiếm {((stats.kpi.devices.used / (stats.kpi.devices.capacity || 1)) * 100).toFixed(1)}% dung lượng cấp phép
                    </div>
                </div>

                {/* 3. Tài khoản */}
                <div className="kpi-card" style={{ background: '#1c1e22', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8b8d93', marginBottom: '15px' }}>
                        <span style={{ fontWeight: '600' }}>Tổng Tài khoản</span>
                        <Users size={20} color="#f59e0b" />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: '700', color: '#fff' }}>{stats.kpi.users.total}</div>
                    <div style={{ fontSize: '0.85rem', color: '#8b8d93', marginTop: '5px' }}>Toàn hệ thống</div>
                </div>

                {/* 4. Server */}
                <div className="kpi-card" style={{ background: '#1c1e22', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8b8d93', marginBottom: '15px' }}>
                        <span style={{ fontWeight: '600' }}>Trạng thái Server</span>
                        <Server size={20} color="#10b981" />
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '12px', height: '12px', background: '#10b981', borderRadius: '50%', boxShadow: '0 0 10px #10b981' }}></div>
                        {stats.kpi.server.status}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#8b8d93', marginTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>CPU: {stats.kpi.server.cpu}</span>
                        <span>RAM: {stats.kpi.server.ram}</span>
                    </div>
                </div>

            </div>

            {/* KHU VỰC BIỂU ĐỒ */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
                <div style={{ background: '#1c1e22', padding: '25px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <h3 style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '20px' }}>Thị phần theo Tổ chức</h3>
                    <div style={{ height: '280px', display: 'flex', justifyContent: 'center' }}>
                        {stats.charts.distribution.length > 0 ? (
                            <Pie data={pieData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#8b8d93' } } } }} />
                        ) : (
                            <span style={{ color: '#8b8d93', marginTop: '50px' }}>Chưa có dữ liệu</span>
                        )}
                    </div>
                </div>

                <div style={{ background: '#1c1e22', padding: '25px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <h3 style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '20px' }}>Tăng trưởng Thiết bị (6 tháng qua)</h3>
                    <div style={{ height: '280px' }}>
                        <Bar data={barData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8b8d93' } }, x: { grid: { display: false }, ticks: { color: '#8b8d93' } } } }} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SuperAdminDashboard;