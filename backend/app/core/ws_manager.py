# File: backend/app/core/ws_manager.py
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # Lưu trữ các kết nối đang active: { "device_test1": [websocket1, websocket2] }
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, device_id: str):
        await websocket.accept()
        if device_id not in self.active_connections:
            self.active_connections[device_id] = []
        self.active_connections[device_id].append(websocket)
        print(f"🔗 Bật kết nối WebSocket cho thiết bị: {device_id}")

    def disconnect(self, websocket: WebSocket, device_id: str):
        if device_id in self.active_connections:
            self.active_connections[device_id].remove(websocket)
            if not self.active_connections[device_id]:
                del self.active_connections[device_id]
        print(f"❌ Ngắt kết nối WebSocket thiết bị: {device_id}")

    async def broadcast_to_device(self, device_id: str, message: dict):
        """Bắn dữ liệu cho tất cả user đang xem màn hình của thiết bị này"""
        if device_id in self.active_connections:
            for connection in self.active_connections[device_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    print(f"Lỗi gửi WS: {e}")

# Khởi tạo một biến toàn cục để dùng chung
manager = ConnectionManager()