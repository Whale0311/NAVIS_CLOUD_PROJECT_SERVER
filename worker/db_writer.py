"""
Database writer helper module
Các utility functions để ghi dữ liệu vào database
"""
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from backend.app.models.schema import Telemetry, Device


def save_telemetry(db: Session, device_id: int, avg_cno: float, sat_count: int, 
                   pdop: float = None, signals_data: list = None) -> Telemetry:
    """
    Lưu telemetry data vào database
    
    Args:
        db: Database session
        device_id: ID của device trong database
        avg_cno: Average C/N0 value
        sat_count: Số lượng satellites
        pdop: Position Dilution of Precision
        signals_data: List of signal details
        
    Returns:
        Telemetry object đã tạo
    """
    telemetry = Telemetry(
        device_id=device_id,
        timestamp=datetime.now(timezone.utc),
        avg_cno=avg_cno,
        sat_count=sat_count,
        pdop=pdop,
        signals_data=signals_data or []
    )
    
    db.add(telemetry)
    db.commit()
    db.refresh(telemetry)
    
    return telemetry


def get_or_create_device(db: Session, device_id: str, name: str = None, 
                         device_type: str = "GNSS", owner_id: int = 1) -> Device:
    """
    Tìm hoặc tạo mới device
    
    Args:
        db: Database session
        device_id: Unique device ID
        name: Display name
        device_type: Loại device
        owner_id: User ID chủ sở hữu
        
    Returns:
        Device object
    """
    device = db.query(Device).filter(Device.device_id == device_id).first()
    
    if not device:
        device = Device(
            device_id=device_id,
            name=name or f"Device {device_id}",
            device_type=device_type,
            owner_id=owner_id
        )
        db.add(device)
        db.commit()
        db.refresh(device)
    
    return device


def update_device_location(db: Session, device_id: str, latitude: float, 
                           longitude: float) -> Device:
    """
    Cập nhật vị trí của device
    
    Args:
        db: Database session
        device_id: Unique device ID
        latitude: Latitude
        longitude: Longitude
        
    Returns:
        Updated Device object
    """
    device = db.query(Device).filter(Device.device_id == device_id).first()
    
    if device:
        device.latitude = latitude
        device.longitude = longitude
        device.last_seen = datetime.now(timezone.utc)
        db.commit()
        db.refresh(device)
    
    return device
