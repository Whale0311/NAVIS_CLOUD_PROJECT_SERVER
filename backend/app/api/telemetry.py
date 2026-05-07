from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List
from app.models.schema import Device, Telemetry
from app.schemas import TelemetryCreate, TelemetryResponse
from app.core.database import get_db

router = APIRouter(
    prefix="/telemetry",
    tags=["telemetry"]
)


@router.post("/ingest", response_model=dict)
def ingest_telemetry(data: TelemetryCreate, db: Session = Depends(get_db)):
    """
    API endpoint để nhận dữ liệu telemetry từ devices
    """
    try:
        # 1. Tìm xem thiết bị có tồn tại không
        db_device = db.query(Device).filter(Device.device_id == data.device_id_str).first()
        
        if not db_device:
            raise HTTPException(status_code=404, detail=f"Thiết bị '{data.device_id_str}' không tồn tại")

        # 2. Cập nhật trạng thái "Last Seen" và Tọa độ hiện tại cho thiết bị
        db_device.last_seen = data.event_time # Cập nhật theo thời gian thực tế của sự kiện
        db_device.is_active = True
        if data.latitude and data.longitude:
            db_device.latitude = data.latitude
            db_device.longitude = data.longitude

        # 3. Ép kiểu danh sách tín hiệu thành mảng dict (JSON)
        signals_json = [sig.dict() for sig in data.signals_data]

        # 4. Lưu dòng lịch sử mới với ĐẦY ĐỦ các trường từ MQTT Schema
        new_telemetry = Telemetry(
            device_id=db_device.id,
            event_id=data.event_id,
            seq=data.seq,
            timestamp=data.event_time, # Map event_time từ schema vào timestamp của DB
            latitude=data.latitude,
            longitude=data.longitude,
            height_m=data.height_m,
            avg_cno_dbhz=data.avg_cno_dbhz, # Dùng tên mới
            sat_count=data.sat_count,
            pdop=data.pdop,
            is_spoofed=data.is_spoofed,
            status=data.status,
            signals_data=signals_json,
            detectors_data=data.detectors_data
        )
        
        db.add(new_telemetry)
        db.commit()
        
        return {
            "status": "success",
            "message": "Đã lưu dữ liệu GNSS",
            "telemetry_id": new_telemetry.id,
            "device_id": data.device_id_str
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi: {str(e)}")


@router.get("/devices/{device_id_str}", response_model=List[TelemetryResponse])
def get_device_telemetry(device_id_str: str, limit: int = 60, db: Session = Depends(get_db)):
    """
    Lấy dữ liệu telemetry gần nhất của một device
    
    Args:
        device_id_str: ID của device (ví dụ: 'b1_hust_ubx')
        limit: Số lượng bản ghi muốn lấy (mặc định: 60)
        
    Returns:
        List[TelemetryResponse] - Danh sách telemetry records
    """
    # Lấy ID thực của thiết bị từ mã string
    db_device = db.query(Device).filter(Device.device_id == device_id_str).first()
    if not db_device:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy thiết bị '{device_id_str}'")

    # Lấy N bản ghi gần nhất, sắp xếp theo thời gian giảm dần
    telemetries = db.query(Telemetry)\
        .filter(Telemetry.device_id == db_device.id)\
        .order_by(Telemetry.timestamp.desc())\
        .limit(limit)\
        .all()
    
    # Đảo ngược lại mảng để dữ liệu trả về theo chiều thời gian tiến tới (cho dễ vẽ biểu đồ Line)
    return telemetries[::-1]


@router.get("/devices/{device_id_str}/latest", response_model=TelemetryResponse)
def get_latest_telemetry(device_id_str: str, db: Session = Depends(get_db)):
    """
    Lấy bản ghi telemetry mới nhất của một device
    
    Args:
        device_id_str: ID của device
        
    Returns:
        TelemetryResponse - Telemetry record mới nhất
    """
    # Lấy ID thực của thiết bị từ mã string
    db_device = db.query(Device).filter(Device.device_id == device_id_str).first()
    if not db_device:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy thiết bị '{device_id_str}'")

    # Lấy bản ghi mới nhất
    latest = db.query(Telemetry)\
        .filter(Telemetry.device_id == db_device.id)\
        .order_by(Telemetry.timestamp.desc())\
        .first()

    if not latest:
        raise HTTPException(status_code=404, detail=f"Chưa có dữ liệu telemetry cho '{device_id_str}'")

    return latest