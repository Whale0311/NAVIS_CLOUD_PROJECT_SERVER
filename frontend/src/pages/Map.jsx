import React, { useEffect, useState, useRef } from 'react';
import Layout from '../components/Layout';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

const GNSS_CONSTS = {
    'GPS': { color: '#fbbf24', prefix: 'G' },
    'GLONASS': { color: '#ef4444', prefix: 'R' },
    'Galileo': { color: '#3b82f6', prefix: 'E' },
    'BeiDou': { color: '#22c55e', prefix: 'B' },
    'QZSS': { color: '#ec4899', prefix: 'J' },
    'Default': { color: '#a3a3a3', prefix: 'U' }
};

const pulseIcon = L.divIcon({ className: 'pulse-marker', iconSize: [22, 22] });
const offlineIcon = L.divIcon({ className: 'offline-marker', iconSize: [22, 22] });

const MapPage = () => {
    const mapRef = useRef(null);
    const [devices, setDevices] = useState([]);
    const [selectedDevice, setSelectedDevice] = useState(null);
    const [telemetryData, setTelemetryData] = useState(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [isLoadingTele, setIsLoadingTele] = useState(false);

    const checkIsOnline = (timestamp) => {
        if (!timestamp) return false;
        let rawTime = timestamp;
        if (!rawTime.endsWith('Z') && !rawTime.includes('+')) rawTime += 'Z'; 
        return (new Date().getTime() - new Date(rawTime).getTime()) < 15000;
    };

    const isCurrentlyOnline = telemetryData ? checkIsOnline(telemetryData.timestamp) : false;

    // 1. POLLING DANH SÁCH THIẾT BỊ (Mỗi 5 giây)
    useEffect(() => {
        const fetchDevices = async () => {
            const token = localStorage.getItem("navis_token");
            try {
                const response = await fetch("http://127.0.0.1:8000/api/devices", {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (!response.ok) return;
                const dbDevices = await response.json();
                setDevices(dbDevices);
            } catch (error) { console.error("Lỗi tải thiết bị:", error); }
        };
        fetchDevices();
        const intervalId = setInterval(fetchDevices, 5000);
        return () => clearInterval(intervalId);
    }, []);

    // 2. POLLING TELEMETRY CHO THIẾT BỊ ĐANG CHỌN (Mỗi 2 giây)
    // Giúp cập nhật Online ngay khi bật Simulator mà không cần click lại
    useEffect(() => {
        if (!selectedDevice) return;

        const fetchCurrentTelemetry = async () => {
            const token = localStorage.getItem("navis_token");
            try {
                const res = await fetch(`http://127.0.0.1:8000/api/devices/${selectedDevice.device_id}/telemetry?limit=1`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                const telData = await res.json();
                if (telData && telData.length > 0) {
                    const latest = telData[0];
                    setTelemetryData(latest);

                    // CHỐNG RUNG BẢN ĐỒ: Chỉ flyTo nếu vị trí dịch chuyển đáng kể (> 0.00001 độ ~ 1 mét)
                    if (mapRef.current && latest.lat && latest.lon) {
                        const currentCenter = mapRef.current.getCenter();
                        const distLat = Math.abs(currentCenter.lat - latest.lat);
                        const distLon = Math.abs(currentCenter.lng - latest.lon);
                        
                        if (distLat > 0.00002 || distLon > 0.00002) {
                            mapRef.current.flyTo([latest.lat, latest.lon], 17, { duration: 1.5 });
                        }
                    }
                }
            } catch (error) { console.error("Lỗi cập nhật tín hiệu:", error); }
        };

        fetchCurrentTelemetry();
        const intervalId = setInterval(fetchCurrentTelemetry, 2000); 
        return () => clearInterval(intervalId);
    }, [selectedDevice]);

    const handleSelectDevice = (dev) => {
        // 1. Reset dữ liệu viễn trắc của thiết bị cũ ngay lập tức
        setTelemetryData(null); 
        
        // XOÁ HOẶC COMMENT DÒNG DƯỚI ĐÂY:
        // setIsLive(false); <--- Xoá dòng này vì Map.jsx không có biến này
        
        // 2. Cập nhật thiết bị đang chọn
        setSelectedDevice(dev);
        setIsPanelOpen(true);
        setIsLoadingTele(true);

        // Giữ nguyên logic flyTo...
        if (mapRef.current) {
            const targetLatLng = L.latLng(dev.latitude || 21.005, dev.longitude || 105.844);
            mapRef.current.flyTo(targetLatLng, 17, { duration: 1.5 });
        }
    };

    const renderSignals = () => {
        if (!isCurrentlyOnline || !telemetryData || !telemetryData.signals_data) return null;
        let activeConstellations = new Set();
        const signals = telemetryData.signals_data.map((sig, index) => {
            let constName = 'Default';
            if(sig.prn.startsWith('G')) constName = 'GPS';
            else if(sig.prn.startsWith('R')) constName = 'GLONASS';
            else if(sig.prn.startsWith('E')) constName = 'Galileo';
            else if(sig.prn.startsWith('B')) constName = 'BeiDou';
            else if(sig.prn.startsWith('J')) constName = 'QZSS';
            activeConstellations.add(constName);
            const config = GNSS_CONSTS[constName] || GNSS_CONSTS['Default'];
            const percent = (sig.cno / 60) * 100;
            return (
                <div className="signal-item" key={index}>
                    <div className="signal-header"><span>{sig.prn}</span> <span>{sig.cno} dB-Hz</span></div>
                    <div className="progress-bg"><div className="progress-bar" style={{ width: `${percent}%`, backgroundColor: config.color }}></div></div>
                </div>
            );
        });
        const legends = Array.from(activeConstellations).map(cName => {
            const config = GNSS_CONSTS[cName];
            return (
                <div className="legend-item" key={cName}>
                    <div className="color-dot" style={{ background: config.color }}></div>
                    <span>{cName} ({config.prefix})</span>
                </div>
            );
        });
        return { signals, legends };
    };

    const renderedData = renderSignals();

    return (
        <Layout>
            <div className="map-page-wrapper">
                {/* 1. LAYER BẢN ĐỒ */}
            <MapContainer center={[21.005, 105.844]} zoom={15} zoomControl={false} style={{ height: '100%', width: '100%' }} ref={mapRef}>
                <TileLayer className="dark-map-filter" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                
                {devices.map(dev => {
                    const isOnline = checkIsOnline(dev.last_seen);
                    const isSelected = selectedDevice?.device_id === dev.device_id;

                    // LOGIC QUAN TRỌNG: 
                    // Nếu là thiết bị đang chọn, ưu tiên lấy tọa độ từ telemetryData (vừa fetch mới nhất)
                    // Nếu không, lấy từ dữ liệu dev mặc định
                    const lat = (isSelected && telemetryData?.lat) ? telemetryData.lat : (dev.latitude || 21.005);
                    const lon = (isSelected && telemetryData?.lon) ? telemetryData.lon : (dev.longitude || 105.844);

                    return (
                        <Marker 
                            key={dev.device_id}
                            position={[lat, lon]} 
                            icon={isOnline ? pulseIcon : offlineIcon}
                            eventHandlers={{ click: () => handleSelectDevice(dev) }}
                        >
                            <Popup>
                                <div style={{ color: '#000' }}>
                                    <b>{dev.device_id}</b><br/>
                                    Trạng thái: {isOnline ? "🟢 Online" : "🔴 Offline"}
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}
            </MapContainer>

                <div className="floating-panel panel-left">
                    <div className="panel-header">GNSS DEVICES</div>
                    <div id="deviceList" style={{ overflowY: 'auto' }}>
                        {devices.map(dev => (
                            <div key={dev.device_id} className={`device-item ${selectedDevice?.device_id === dev.device_id ? 'active' : ''}`} onClick={() => handleSelectDevice(dev)}>
                                <span>{dev.device_id}</span> 
                                <span className={`device-badge ${dev.device_type === 'UBX' ? 'badge-ubx' : 'badge-rtcm'}`}>{dev.device_type}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className={`floating-panel panel-right ${isPanelOpen ? 'show' : ''}`}>
                    <div className="panel-header" style={{ color: '#ffffff', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{selectedDevice?.device_id || '--'}</span>
                        <span style={{ color: isCurrentlyOnline ? '#10b981' : '#a3a3a3', fontSize: '0.8rem' }}>
                            {isCurrentlyOnline ? '● Online' : '🔴 Mất kết nối'}
                        </span>
                    </div>
                    {/* ... (Các phần detail-row giữ nguyên) ... */}
                    <div className="detail-row">
                        <span className="detail-label">CN₀ Trung bình</span>
                        <span className="detail-value" style={{ color: '#06b6d4', fontSize: '1.6rem' }}>
                            {isCurrentlyOnline ? telemetryData?.avg_cno?.toFixed(1) : '--'}
                        </span>
                    </div>
                    <div className="detail-row">
                        <span className="detail-label">Vệ tinh Tracking</span>
                        <span className="detail-value" style={{ color: '#10b981' }}>{isCurrentlyOnline ? telemetryData?.sat_count : '--'}</span>
                    </div>
                    <div className="detail-row">
                        <span className="detail-label">PDOP</span>
                        <span className="detail-value">{isCurrentlyOnline ? telemetryData?.pdop : '--'}</span>
                    </div>

                    <div style={{ marginTop: '15px', marginBottom: '5px', color: '#a3a3a3', fontSize: '0.8rem', fontWeight: 'bold' }}>CHI TIẾT TÍN HIỆU (DB-HZ)</div>
                    <div className="scrollable-signals">
                        {!isCurrentlyOnline ? <div style={{ color:'#ef4444', fontSize:'0.9rem' }}>Thiết bị mất kết nối.</div> : renderedData?.signals}
                    </div>
                    <div className="legend-block">
                        <div style={{ marginBottom: '5px' }}>PHÂN LOẠI VỆ TINH</div>
                        <div className="legend-grid">{renderedData?.legends}</div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default MapPage;