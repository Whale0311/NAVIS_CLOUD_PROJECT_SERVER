import React, { createContext, useContext, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
    const sockets = useRef({}); // Lưu trữ các kết nối theo device_id

    const connectDevice = (deviceId) => {
        if (sockets.current[deviceId]) return;

        const ws = new WebSocket(`ws://localhost:8000/ws/devices/${deviceId}`);
        
        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            // Xử lý Alarms toàn cục
            if (msg.event_type === "alarm" || msg.event_type === "spoofing_detected") {
                toast.error(`🚨 BÁO ĐỘNG [${deviceId}]: ${msg.data.message || 'Tín hiệu lạ!'}`, {
                    position: "top-right",
                    autoClose: false,
                    theme: "colored"
                });
            }
            // Phát sự kiện để các trang con (Map, Chart) có thể nghe thấy
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
            const res = await fetch("http://localhost:8000/api/devices", {
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