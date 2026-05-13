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

    // Dùng Ref để lưu trữ trạng thái mà không bị "đóng băng" trong các callback của WebSocket
    const devicesRef = useRef([]);
    const selectedDeviceIdRef = useRef(null); 
    const wsConnectionsRef = useRef([]);

    const checkIsOnline = (timestamp) => {
        if (!timestamp) return false;
        let rawTime = timestamp;
        if (!rawTime.endsWith('Z') && !rawTime.includes('+')) rawTime += 'Z'; 
        return (new Date().getTime() - new Date(rawTime).getTime()) < 15000;
    };

    const isCurrentlyOnline = telemetryData ? checkIsOnline(telemetryData.timestamp) : false;

    // 1. LẤY DANH SÁCH & BẬT RADAR WEBSOCKET CHO TOÀN BỘ BẢN ĐỒ
    useEffect(() => {
        let isMounted = true;
        
        const fetchDevicesAndSetupWS = async () => {
            const token = localStorage.getItem("navis_token");
            try {
                // Lấy vị trí tĩnh 1 lần khi load trang
                const response = await fetch("http://127.0.0.1:8000/api/devices", {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (!response.ok) return;
                const dbDevices = await response.json();
                
                if (isMounted) {
                    devicesRef.current = dbDevices;
                    setDevices(dbDevices);
                    setupWebSockets(dbDevices);
                }
            } catch (error) { console.error("Lỗi tải thiết bị:", error); }
        };

        const setupWebSockets = (deviceList) => {
            // Dọn dẹp ống nước cũ trước khi nối ống mới
            wsConnectionsRef.current.forEach(ws => ws.close());
            wsConnectionsRef.current = [];

            deviceList.forEach(dev => {
                const ws = new WebSocket(`ws://localhost:8000/ws/devices/${dev.device_id}`);
                
                ws.onmessage = (event) => {
                    const msg = JSON.parse(event.data);
                    
                    // KHI CÓ TỌA ĐỘ MỚI TỪ BẤT KỲ XE NÀO
                    if (msg.event_type === "position_update" || msg.event_type === "telemetry_update") {
                        
                        // 1. Cập nhật vị trí Marker của xe đó trên bản đồ
                        devicesRef.current = devicesRef.current.map(d => {
                            if (d.device_id === msg.device_id) {
                                return {
                                    ...d,
                                    latitude: msg.data.lat_deg || msg.data.lat || d.latitude,
                                    longitude: msg.data.lon_deg || msg.data.lon || d.longitude,
                                    last_seen: new Date().toISOString() // Đánh dấu xe vừa online
                                };
                            }
                            return d;
                        });
                        setDevices([...devicesRef.current]);

                        // 2. NẾU XE NÀY ĐANG ĐƯỢC NGƯỜI DÙNG CLICK XEM CHI TIẾT
                        if (selectedDeviceIdRef.current === msg.device_id) {
                            
                            // Cập nhật CNO/SAT vào bảng Panel bên phải
                            setTelemetryData(prev => ({
                                ...prev,
                                ...msg.data,
                                timestamp: new Date().toISOString()
                            }));

                            // Camera tự động bám theo xe (Chống rung bản đồ)
                            const lat = msg.data.lat_deg || msg.data.lat;
                            const lon = msg.data.lon_deg || msg.data.lon;
                            if (mapRef.current && lat && lon) {
                                const currentCenter = mapRef.current.getCenter();
                                const distLat = Math.abs(currentCenter.lat - lat);
                                const distLon = Math.abs(currentCenter.lng - lon);
                                
                                if (distLat > 0.00002 || distLon > 0.00002) {
                                    mapRef.current.flyTo([lat, lon], 17, { duration: 1.5 });
                                }
                            }
                        }
                    }
                };
                wsConnectionsRef.current.push(ws);
            });
        };

        fetchDevicesAndSetupWS();

        return () => {
            isMounted = false;
            wsConnectionsRef.current.forEach(ws => ws.close());
        };
    }, []);


    // 2. XỬ LÝ KHI CLICK VÀO 1 XE TRÊN BẢN ĐỒ
    const handleSelectDevice = async (dev) => {
        // Cập nhật ID để WebSocket biết xe nào đang được ưu tiên
        selectedDeviceIdRef.current = dev.device_id;
        
        setSelectedDevice(dev);
        setIsPanelOpen(true);
        setIsLoadingTele(true);

        // FlyTo ngay lập tức tới vị trí cuối cùng đã biết
        if (mapRef.current && dev.latitude && dev.longitude) {
            mapRef.current.flyTo([dev.latitude, dev.longitude], 17, { duration: 1.5 });
        }

        // Gọi API 1 lần duy nhất để lấy lịch sử sóng CNO/SAT cũ điền vào bảng
        // Sau đó WebSocket sẽ tự động bơm data mới vào (không cần setInterval nữa)
        const token = localStorage.getItem("navis_token");
        try {
            const res = await fetch(`http://127.0.0.1:8000/api/devices/${dev.device_id}/telemetry?limit=1`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const telData = await res.json();
            if (telData && telData.length > 0) {
                setTelemetryData(telData[0]);
            } else {
                setTelemetryData(null);
            }
        } catch (error) { 
            console.error("Lỗi lấy thông tin viễn trắc:", error); 
        } finally {
            setIsLoadingTele(false);
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