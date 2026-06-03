"""
Database writer helper module
Các utility functions để ghi dữ liệu vào database
"""
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.schema import Telemetry, Device # Xóa chữ 'backend.' ở đầu nếu gây lỗi import


def save_telemetry(db: Session, device_id: int, avg_cno_dbhz: float, sat_count: int, 
                   pdop: float = None, signals_data: list = None) -> Telemetry:
    """Lưu telemetry data vào database"""
    telemetry = Telemetry(
        device_id=device_id,
        timestamp=datetime.now(timezone.utc),
        avg_cno_dbhz=avg_cno_dbhz, # Đã đổi tên trường
        sat_count=sat_count,
        pdop=pdop,
        signals_data=signals_data or []
    )
    
    db.add(telemetry)
    db.commit()
    db.refresh(telemetry)
    
    return telemetry


def get_or_create_device(db: Session, device_id: str, name: str = None, 
                         device_type: str = "GNSS", tenant_id: int = None) -> Device:
    """Tìm hoặc tạo mới device (Hỗ trợ Multi-Tenant)"""
    device = db.query(Device).filter(Device.device_id == device_id).first()
    
    if not device:
        # LƯU Ý: Thiết bị tạo tự động sẽ có tenant_id = None (Chưa thuộc công ty nào)
        device = Device(
            device_id=device_id,
            name=name or f"Device {device_id}",
            device_type=device_type,
            tenant_id=tenant_id # Đổi owner_id thành tenant_id
        )
        db.add(device)
        db.commit()
        db.refresh(device)
    
    return device


def update_device_location(db: Session, device_id: str, latitude: float, 
                           longitude: float) -> Device:
    """Cập nhật vị trí của device"""
    device = db.query(Device).filter(Device.device_id == device_id).first()
    
    if device:
        device.latitude = latitude
        device.longitude = longitude
        device.last_seen = datetime.now(timezone.utc)
        db.commit()
        db.refresh(device)
    
    return device