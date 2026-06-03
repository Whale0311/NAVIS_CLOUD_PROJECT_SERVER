import React, { createContext, useContext, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
    const sockets = useRef({}); // Lưu trữ các kết nối theo device_id

    const connectDevice = (deviceId) => {
        if (sockets.current[deviceId]) return;

        // 1. Lấy Token để vượt qua bức tường lửa WebSocket ở Backend
        const token = localStorage.getItem("navis_token") || localStorage.getItem("access_token");
        if (!token) {
            console.error(`🚫 [${deviceId}] Bị chặn: Không tìm thấy Token xác thực.`);
            return;
        }

        // 2. Dùng Nginx routing (Giữ nguyên logic cực mượt của bạn)
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host; 
        
        // NÂNG CẤP: Nối thêm ?token=... vào đuôi URL
        const wsUrl = `${protocol}//${host}/ws/devices/${deviceId}?token=${token}`;
        
        const ws = new WebSocket(wsUrl);
        
        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            console.log(`📡 [TRẠM TỔNG - ${deviceId}] Payload:`, msg); 

            // Cơ chế bắt báo động
            const isAlarm = 
                msg.event_type === "alarm" || 
                msg.schema === "gnss.health.v1" || 
                msg.event_type === "health" ||
                (msg.data && msg.data.event_type === "spoofing_detected") ||
                (msg.data && msg.data.severity === "Critical");

            if (isAlarm) {
                toast.error(`🚨 BÁO ĐỘNG [${deviceId}]: ${msg.data?.message || 'Tín hiệu bất thường!'}`, {
                    position: "top-right",
                    autoClose: false,
                    theme: "colored"
                });
            }
            
            window.dispatchEvent(new CustomEvent('device_update', { detail: msg }));
        };

        ws.onclose = (event) => {
            delete sockets.current[deviceId];
            
            // 3. Bắt lỗi từ chối truy cập chéo công ty từ Backend (Mã 1008)
            if (event.code === 1008) {
                console.error(`❌ WS Bị từ chối [${deviceId}]:`, event.reason);
                toast.warning(`Không có quyền truy cập luồng dữ liệu của thiết bị ${deviceId}`);
            }
        };

        sockets.current[deviceId] = ws;
    };

    const initAllDevices = async () => {
        const token = localStorage.getItem("navis_token") || localStorage.getItem("access_token");
        if (!token) return;

        try {
            // Nhờ Nginx proxy nên gọi đường dẫn tương đối là đủ
            const res = await fetch("/api/devices", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            
            if (!res.ok) throw new Error(`Lỗi API: ${res.status}`);
            
            const devices = await res.json();
            // Lặp qua danh sách xe (đã được Backend lọc sẵn theo quyền)
            devices.forEach(dev => connectDevice(dev.device_id));
        } catch (e) { 
            console.error("Không thể khởi tạo Radar", e); 
        }
    };

    useEffect(() => {
        initAllDevices();
        
        // Dọn dẹp đóng các kết nối khi đổi trang hoặc unmount
        return () => {
            Object.values(sockets.current).forEach(ws => ws.close());
        };
    }, []);

    return (
        <SocketContext.Provider value={{ connectDevice }}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => useContext(SocketContext);