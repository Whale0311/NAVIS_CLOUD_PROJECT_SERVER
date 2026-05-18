import React, { createContext, useContext, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
    const sockets = useRef({}); // Lưu trữ các kết nối theo device_id

    const connectDevice = (deviceId) => {
        if (sockets.current[deviceId]) return;

        // Tự động nhận diện giao thức (HTTP -> ws, HTTPS -> wss)
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
// Lấy đúng tên miền hoặc IP hiện tại của người dùng (bao gồm cả port nếu chạy local)
const host = window.location.host; 

// Ghép lại thành URL động
const ws = new WebSocket(`${protocol}//${host}/ws/devices/${deviceId}`);
        
        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            console.log("📡 [TRẠM TỔNG] Payload:", msg); // Để ông dễ soi data

            // CƠ CHẾ BẮT BÁO ĐỘNG SIÊU NHẠY:
            // Check cả schema, event_type, và check luôn lõi bên trong data
            const isAlarm = 
                msg.event_type === "alarm" || 
                msg.schema === "gnss.health.v1" || 
                msg.event_type === "health" ||
                (msg.data && msg.data.event_type === "spoofing_detected") ||
                (msg.data && msg.data.severity === "Critical");

            if (isAlarm) {
                toast.error(`🚨 BÁO ĐỘNG [${deviceId}]: ${msg.data.message || 'Tín hiệu bất thường!'}`, {
                    position: "top-right",
                    autoClose: false,
                    theme: "colored"
                });
            }
            
            window.dispatchEvent(new CustomEvent('device_update', { detail: msg }));
        };

        ws.onclose = () => {
            delete sockets.current[deviceId];
            // Có thể thêm logic tự động reconnect ở đây
        };

        sockets.current[deviceId] = ws;
    };

    // Khi đăng nhập xong và có danh sách thiết bị, hãy gọi hàm này
    const initAllDevices = async () => {
        const token = localStorage.getItem("navis_token");
        try {
            const res = await fetch("/api/devices", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const devices = await res.json();
            devices.forEach(dev => connectDevice(dev.device_id));
        } catch (e) { console.error("Không thể khởi tạo Radar toàn cầu", e); }
    };

    useEffect(() => {
        const token = localStorage.getItem("navis_token");
        if (token) initAllDevices();
    }, []);

    return (
        <SocketContext.Provider value={{ connectDevice }}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => useContext(SocketContext);