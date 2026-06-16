from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List, Optional # Bổ sung Optional để cho phép trả về null

from app.models.schema import Device, Telemetry, User, Alarm
from app.schemas import TelemetryCreate, TelemetryResponse
from app.core.database import get_db

# IMPORT HÀM KIỂM TRA BẢO MẬT
from app.api.auth import get_current_user 

router = APIRouter(
    prefix="/telemetry",
    tags=["telemetry"]
)

# ==========================================
# 1. API GHI DỮ LIỆU (Dành cho Worker nội bộ)
# ==========================================
@router.post("/ingest", response_model=dict)
def ingest_telemetry(data: TelemetryCreate, db: Session = Depends(get_db)):
    """
    API endpoint để nhận dữ liệu telemetry từ devices (Thường do Worker gọi)
    """
    try:
        db_device = db.query(Device).filter(Device.device_id == data.device_id_str).first()
        
        if not db_device:
            raise HTTPException(status_code=404, detail=f"Thiết bị '{data.device_id_str}' không tồn tại")

        db_device.last_seen = data.event_time 
        db_device.is_active = True
        if data.latitude and data.longitude:
            db_device.latitude = data.latitude
            db_device.longitude = data.longitude

        signals_json = [sig.model_dump() for sig in data.signals_data] 

        new_telemetry = Telemetry(
            device_id=db_device.id,
            event_id=data.event_id,
            seq=data.seq,
            timestamp=data.event_time, 
            latitude=data.latitude,
            longitude=data.longitude,
            height_m=data.height_m,
            avg_cno_dbhz=data.avg_cno_dbhz, 
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


# ==========================================
# 2. API LẤY LỊCH SỬ DỮ LIỆU (Dành cho Dashboard/Charts)
# ==========================================
@router.get("/devices/{device_id_str}", response_model=List[TelemetryResponse])
def get_device_telemetry(
    device_id_str: str, 
    limit: int = 6, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lấy dữ liệu telemetry gần nhất của một device"""
    db_device = db.query(Device).filter(Device.device_id == device_id_str).first()
    
    # Chỉ báo 404 nếu thiết bị bị xóa hoặc nhập sai ID, không báo 404 vì thiếu dữ liệu GPS
    if not db_device:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy thiết bị '{device_id_str}'")

    if current_user.role != "admin" and db_device.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền xem dữ liệu thiết bị của tổ chức khác!")
        
    if current_user.role != "admin" and current_user.role_in_tenant != "tenant_admin":
        if db_device.assigned_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Bạn không có quyền xem tọa độ/dữ liệu của chiếc xe này!")

    telemetries = db.query(Telemetry)\
        .filter(Telemetry.device_id == db_device.id)\
        .order_by(Telemetry.timestamp.desc())\
        .limit(limit)\
        .all()
    
    # Nếu list trống, trả về [] an toàn cho Frontend
    return telemetries[::-1]


# ==========================================
# 3. API LẤY DỮ LIỆU MỚI NHẤT (Dành cho Map/Popup)
# ==========================================
# Đổi response_model thành Optional để FastApi cho phép trả về null (None) thay vì ném lỗi
@router.get("/devices/{device_id_str}/latest", response_model=Optional[TelemetryResponse])
def get_latest_telemetry(
    device_id_str: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lấy bản ghi telemetry mới nhất của một device"""
    db_device = db.query(Device).filter(Device.device_id == device_id_str).first()
    if not db_device:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy thiết bị '{device_id_str}'")

    if current_user.role != "admin" and db_device.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền xem dữ liệu thiết bị của tổ chức khác!")
        
    if current_user.role != "admin" and current_user.role_in_tenant != "tenant_admin":
        if db_device.assigned_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Bạn không có quyền xem tọa độ/dữ liệu của chiếc xe này!")

    latest = db.query(Telemetry)\
        .filter(Telemetry.device_id == db_device.id)\
        .order_by(Telemetry.timestamp.desc())\
        .first()

    if not latest:
        return None

    return latest
@router.get("/devices/{device_id_str}/latest_sdr")
def get_latest_sdr_image(device_id_str: str, db: Session = Depends(get_db)):
    # Tìm device
    device = db.query(Device).filter(Device.device_id == device_id_str).first()
    if not device:
        raise HTTPException(status_code=404)
        
    # Lấy Alarm mới nhất CÓ CHỨA ẢNH
    latest_alarm = db.query(Alarm).filter(
        Alarm.device_id == device.id,
        Alarm.detectors_data.isnot(None)
    ).order_by(Alarm.created_at.desc()).first()
    
    if not latest_alarm:
        return None
        
    return latest_alarm.detectors_data