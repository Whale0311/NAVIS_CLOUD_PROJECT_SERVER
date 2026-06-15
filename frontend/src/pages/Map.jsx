import React, { useEffect, useState, useRef } from 'react';
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
const parseTelemetryPayload = (msgData, prevData = {}) => {
    // Ưu tiên lấy từ msgData, nếu không có thì "vét" lại từ prevData, cuối cùng mới gán = 0
    const rawCno = msgData.summary?.avg_cno_dbhz || msgData.avg_cno_dbhz || msgData.avg_cno || prevData.avg_cno_dbhz || 0;
    
    // Dùng ?? (Nullish coalescing) thay vì || để tránh trường hợp PDOP = 0 bị nhầm thành false
    const rawPdop = msgData.position?.pdop ?? msgData.pdop ?? prevData.pdop;
    
    const satCount = msgData.summary?.sat_count || msgData.sat_count || prevData.sat_count || 0;
    const signalsData = msgData.signals || msgData.signals_data || prevData.signals_data || [];

    return {
        ...prevData,
        ...msgData, // Nạp tọa độ và các trường khác
        timestamp: new Date().toISOString(),
        avg_cno: rawCno,
        avg_cno_dbhz: rawCno,
        cno: rawCno,
        pdop: typeof rawPdop === 'number' ? rawPdop.toFixed(2) : '--',
        sat_count: satCount,
        signals_data: signalsData
    };
};

const MapPage = () => {
    const mapRef = useRef(null);
    const [devices, setDevices] = useState([]);
    const [selectedDevice, setSelectedDevice] = useState(null);
    const [telemetryData, setTelemetryData] = useState(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [isLoadingTele, setIsLoadingTele] = useState(false);
    const [isTracking, setIsTracking] = useState(true);
    // Dùng Ref để lưu trữ trạng thái mà không bị "đóng băng" trong các callback của WebSocket
    const devicesRef = useRef([]);
    const selectedDeviceIdRef = useRef(null); 
    const wsConnectionsRef = useRef([]);

    const checkIsOnline = (timestamp) => {
        if (!timestamp) return false;
        let rawTime = timestamp;
        if (!rawTime.endsWith('Z') && !rawTime.includes('+')) rawTime += 'Z'; 
        return (new Date().getTime() - new Date(rawTime).getTime()) < 60000;
    };

    // ============================================
    // TRANG MAP.JSX - LẮNG NGHE DỮ LIỆU TỪ TRẠM TỔNG
    // ============================================
    useEffect(() => {
        let isMounted = true;
        
        // 1. LẤY VỊ TRÍ TỪ DB (Khắc phục lỗi không chịu Offline)
        const fetchDevices = async () => {
            const token = localStorage.getItem("navis_token");
            try {
                const response = await fetch("/api/devices", {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (!response.ok) return;
                const dbDevices = await response.json();
                
                // Kéo thêm nhịp tim cuối cùng cho từng xe
                const telemetryPromises = dbDevices.map(async (dev) => {
                    try {
                        // SỬA LỖI API: Đổi đường dẫn trỏ về Router Telemetry
                        const telRes = await fetch(`/api/telemetry/devices/${dev.device_id}?limit=1`, {
                            headers: { "Authorization": `Bearer ${token}` }
                        });
                        if (telRes.ok) {
                            const telData = await telRes.json();
                            if (telData && telData.length > 0) {
                                return {
                                    ...dev,
                                    latitude: telData[0].latitude || dev.latitude,
                                    longitude: telData[0].longitude || dev.longitude,
                                    last_seen: telData[0].timestamp, // Ghi nhận nhịp tim gốc
                                    is_active: checkIsOnline(telData[0].timestamp)
                                };
                            }
                        }
                    } catch (e) {}
                    return { ...dev, is_active: false, last_seen: null };
                });

                const devicesWithData = await Promise.all(telemetryPromises);

                if (isMounted) {
                    devicesRef.current = devicesWithData;
                    setDevices(devicesWithData);
                }
            } catch (error) { console.error("Lỗi tải thiết bị:", error); }
        };

        // ==========================================
        // MAP.JSX: LẮNG NGHE SỰ KIỆN TỪ RADAR TOÀN CỤC
        // ==========================================
        const handleGlobalUpdate = (event) => {
            const msg = event.detail; 
            
            // CƠ CHẾ BẮT TỌA ĐỘ
            const isPosition = 
                msg.event_type === "telemetry_update" || 
                msg.event_type === "position_update" || 
                (msg.data && msg.data.position !== undefined);

            if (isPosition) {                
                // 1. Cập nhật vị trí Marker trên bản đồ (Giữ nguyên)
                devicesRef.current = devicesRef.current.map(d => {
                    if (d.device_id === msg.device_id) {
                        return {
                            ...d,
                            is_active: true,
                            latitude: msg.data.position?.lat_deg || msg.data.lat_deg || msg.data.latitude || d.latitude,
                            longitude: msg.data.position?.lon_deg || msg.data.lon_deg || msg.data.longitude || d.longitude,
                            last_seen: new Date().toISOString() 
                        };
                    }
                    return d;
                });
                setDevices([...devicesRef.current]);

                // B. Bơm dữ liệu vào Bảng Panel
                if (selectedDeviceIdRef.current === msg.device_id) {
                    
                    // 🚨 ĐÃ SỬA: Phân luồng rõ ràng, không gán bừa bãi
                    if (msg.event_type === "telemetry_update") {
                        // Nếu là gói Telemetry (đầy đủ vệ tinh), cập nhật toàn bộ bảng
                        setTelemetryData(prev => parseTelemetryPayload(msg.data, prev));
                    } 
                    else if (msg.event_type === "position_update") {
                        // Nếu chỉ là gói Vị trí, CHỈ cập nhật lại tọa độ, giữ nguyên bảng vệ tinh
                        setTelemetryData(prev => {
                            if (!prev) return prev;
                            return {
                                ...prev,
                                latitude: msg.data.lat_deg || prev.latitude,
                                longitude: msg.data.lon_deg || prev.longitude,
                            };
                        });
                    }
                    
                    // Camera tự động bám xe
                    const lat = msg.data.position?.lat_deg || msg.data.lat_deg || msg.data.latitude;
                    const lon = msg.data.position?.lon_deg || msg.data.lon_deg || msg.data.longitude;
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

        fetchDevices();
        window.addEventListener('device_update', handleGlobalUpdate);
        
        // 3. QUÉT RÁC OFFLINE CHUẨN XÁC
        const cleanupInterval = setInterval(() => {
            const now = new Date().getTime();
            let hasChanges = false;
            
            devicesRef.current = devicesRef.current.map(d => {
                const lastTime = d.last_seen || d.timestamp || null;
                if (lastTime && d.is_active) {
                    let rawTime = lastTime;
                    if (!rawTime.endsWith('Z') && !rawTime.includes('+')) rawTime += 'Z';
                    
                    if (now - new Date(rawTime).getTime() > 15000) {
                        hasChanges = true;
                        return { ...d, is_active: false };
                    }
                }
                return d;
            });

            if (hasChanges) {
                setDevices([...devicesRef.current]);
            }
        }, 5000);
        
        return () => {
            isMounted = false;
            window.removeEventListener('device_update', handleGlobalUpdate);
            clearInterval(cleanupInterval);
        };
    }, []);


   // Thêm đoạn Effect mới này:
    useEffect(() => {
        if (!isTracking || !mapRef.current || !telemetryData) return;
        
        // Móc tọa độ từ telemetry mới nhất nếu có, không thì mặc định
        const lat = telemetryData.position?.lat_deg || telemetryData.latitude;
        const lon = telemetryData.position?.lon_deg || telemetryData.longitude;
        
        if (lat && lon) {
            const currentCenter = mapRef.current.getCenter();
            const distLat = Math.abs(currentCenter.lat - lat);
            const distLon = Math.abs(currentCenter.lng - lon);
            
            // Chỉ di chuyển cam nếu khoảng cách đủ lớn
            if (distLat > 0.00002 || distLon > 0.00002) {
                mapRef.current.flyTo([lat, lon], 17, { duration: 1.5 });
            }
        }
    }, [telemetryData, isTracking]);
    const handleSelectDevice = async (dev) => {
        selectedDeviceIdRef.current = dev.device_id;
        setSelectedDevice(dev);
        setIsPanelOpen(true);
        setIsLoadingTele(true);

        if (mapRef.current && dev.latitude && dev.longitude) {
            mapRef.current.flyTo([dev.latitude, dev.longitude], 17, { duration: 1.5 });
        }

        const token = localStorage.getItem("navis_token") || localStorage.getItem("access_token");
        try {
            // SỬA LỖI API: Đổi đường dẫn lấy 1 bản ghi Telemetry gần nhất
            const res = await fetch(`/api/telemetry/devices/${dev.device_id}?limit=1`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            
            if (!res.ok) {
                console.warn("API lỗi hoặc dính CORS, đang chờ Radar WebSocket bơm dữ liệu...");
                setTelemetryData({ timestamp: new Date().toISOString() }); // Bơm nháp nhịp tim để chờ
                return; 
            }
            
            const telData = await res.json();
            if (telData && telData.length > 0) {
                setTelemetryData(telData[0]);
            } else {
                setTelemetryData({ timestamp: new Date().toISOString() });
            }
        } catch (error) { 
            console.error("Lỗi lấy thông tin viễn trắc:", error); 
            // Giữ panel mở chờ Radar
            setTelemetryData({ timestamp: new Date().toISOString() });
        } finally {
            setIsLoadingTele(false);
        }
    };
    const currentDeviceStatus = devices.find(d => d.device_id === selectedDevice?.device_id)?.is_active || false;

    // ===============================================
    // 3. RENDER THANH TÍN HIỆU VỆ TINH (CHUẨN SCHEMA)
    // ===============================================
    const renderSignals = () => {
        if (!currentDeviceStatus || !telemetryData || !telemetryData.signals_data) {
            return { signals: null, legends: null };
        }
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
            
            // ĐIỂM SỬA QUAN TRỌNG: Cập nhật biến cno thành cno_dbhz theo đúng Schema 4.4
            const cnoValue = sig.cno_dbhz || sig.cno || 0; 
            const percent = (cnoValue / 60) * 100;
            
            return (
                <div className="signal-item" key={index}>
                    <div className="signal-header"><span>{sig.prn}</span> <span>{cnoValue} dB-Hz</span></div>
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
            <div className="map-page-wrapper">
                {/* 1. LAYER BẢN ĐỒ */}
            <MapContainer center={[21.005, 105.844]} zoom={15} zoomControl={false} style={{ height: '100%', width: '100%' }} ref={mapRef}>
                <TileLayer className="dark-map-filter" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                
                {devices.map(dev => {
                    const isOnline = checkIsOnline(dev.last_seen);
                    const isSelected = selectedDevice?.device_id === dev.device_id;

                    const lat = dev.latitude;
                    const lon = dev.longitude;

                    // 🚨 CHỐT CHẶN AN TOÀN: Nếu thiết bị mới chưa có tọa độ (bị null hoặc undefined), 
                    // bỏ qua không vẽ Marker để bảo vệ bản đồ khỏi crash.
                    if (lat == null || lon == null) {
                        return null; 
                    }

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
                        <span style={{ color: currentDeviceStatus ? '#10b981' : '#ef4444', fontSize: '0.8rem', fontWeight: 'bold' }}>
                            {currentDeviceStatus ? '● ONLINE' : '🔴 OFFLINE'}
                        </span>
                    </div>
                    <div className="detail-row">
                        <span className="detail-label tooltip-wrapper">
                            CN₀ Trung bình <span className="info-icon">ⓘ</span>
                            {/* Ô bóng kính sẽ hiện ra khi hover */}
                            <div className="tooltip-glass">
                                <b>Tỷ số dải sóng mang trên nhiễu</b> (Carrier-to-Noise density).<br/>
                                Đánh giá chất lượng tín hiệu thu được từ vệ tinh. Giá trị &gt; 40 dB-Hz là tín hiệu rất khỏe.
                            </div>
                        </span>
                        <span className="detail-value" style={{ color: '#06b6d4', fontSize: '1.6rem' }}>
                            {currentDeviceStatus 
                                ? Number(telemetryData?.avg_cno_dbhz ?? telemetryData?.avg_cno ?? 0).toFixed(1) 
                                : '--'}
                        </span>
                    </div>

                    <div className="detail-row">
                        <span className="detail-label tooltip-wrapper">
                            Vệ tinh Tracking <span className="info-icon">ⓘ</span>
                            <div className="tooltip-glass">
                                Số lượng vệ tinh hiện tại thiết bị đang bắt sóng và sử dụng để tính toán tọa độ. Càng nhiều vệ tinh, độ chính xác càng cao.
                            </div>
                        </span>
                        <span className="detail-value" style={{ color: '#10b981' }}>
                            {currentDeviceStatus ? telemetryData?.sat_count : '--'}
                        </span>
                    </div>

                    <div className="detail-row">
                        <span className="detail-label tooltip-wrapper">
                            PDOP <span className="info-icon">ⓘ</span>
                            <div className="tooltip-glass">
                                <b>Độ suy giảm độ chính xác vị trí</b> (Position Dilution of Precision).<br/>
                                Đánh giá sự phân bố hình học của các vệ tinh trên bầu trời. Giá trị &lt; 2.0 là cấu hình lý tưởng.
                            </div>
                        </span>
                        <span className="detail-value">
                            {currentDeviceStatus ? Number(telemetryData?.pdop ?? 0).toFixed(2) : '--'}
                        </span>
                    </div>

                    <div style={{ marginTop: '15px', marginBottom: '5px', color: '#a3a3a3', fontSize: '0.8rem', fontWeight: 'bold' }}>CHI TIẾT TÍN HIỆU (DB-HZ)</div>
                    <div className="scrollable-signals">
                        {!currentDeviceStatus ? <div style={{ color:'#ef4444', fontSize:'0.9rem' }}>Thiết bị mất kết nối.</div> : renderedData?.signals}
                    </div>
                    <div className="legend-block">
                        <div style={{ marginBottom: '5px' }}>PHÂN LOẠI VỆ TINH</div>
                        <div className="legend-grid">{renderedData?.legends}</div>
                    </div>
                </div>
            </div>
    );
};

export default MapPage;