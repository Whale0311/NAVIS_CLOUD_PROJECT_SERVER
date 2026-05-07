from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import jwt
from app.core.database import get_db
from app.core.security import SECRET_KEY, ALGORITHM
# Đã import thêm Alarm
from app.models.schema import Device, User, Telemetry, Alarm
from app.schemas import DeviceCreate, DeviceResponse, TelemetryCreate, TelemetryResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone 

router = APIRouter()
security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Token không hợp lệ")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token không hợp lệ hoặc đã hết hạn")
    
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise HTTPException(status_code=401, detail="Không tìm thấy người dùng")
    return user


# ==========================================
# 1. CREATE - THÊM THIẾT BỊ MỚI
# ==========================================
@router.post("/api/devices", response_model=DeviceResponse)
def create_device(device: DeviceCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_device = db.query(Device).filter(Device.device_id == device.device_id).first()
    if db_device:
        raise HTTPException(status_code=400, detail="Mã thiết bị này đã tồn tại trong hệ thống!")
    
    new_device = Device(**device.dict(), owner_id=current_user.id)
    db.add(new_device)
    db.commit()
    db.refresh(new_device)
    return new_device


# ==========================================
# 2. READ ALL - LẤY DANH SÁCH THIẾT BỊ
# ==========================================
@router.get("/api/devices", response_model=List[DeviceResponse])
def get_devices(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == "admin":
        devices = db.query(Device).all()
    else:
        devices = db.query(Device).filter(Device.owner_id == current_user.id).all()
    
    result = []
    for dev in devices:
        dev_dict = dev.__dict__.copy()
        dev_dict["owner_email"] = dev.owner.email if dev.owner else "N/A"
        result.append(dev_dict)
        
    return result


# ==========================================
# 3. READ ONE - LẤY CHI TIẾT 1 THIẾT BỊ
# ==========================================
@router.get("/api/devices/{device_id}", response_model=DeviceResponse)
def get_device_by_id(device_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == "admin":
        db_device = db.query(Device).filter(Device.id == device_id).first()
    else:
        db_device = db.query(Device).filter(Device.id == device_id, Device.owner_id == current_user.id).first()
        
    if not db_device:
        raise HTTPException(status_code=404, detail="Không tìm thấy thiết bị hoặc bạn không có quyền truy cập!")
    return db_device


# ==========================================
# 4. UPDATE - CẬP NHẬT THÔNG TIN THIẾT BỊ
# ==========================================
@router.put("/api/devices/{device_id}", response_model=DeviceResponse)
def update_device(device_id: int, device_update: DeviceCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == "admin":
        db_device = db.query(Device).filter(Device.id == device_id).first()
    else:
        db_device = db.query(Device).filter(Device.id == device_id, Device.owner_id == current_user.id).first()

    if not db_device:
        raise HTTPException(status_code=404, detail="Không tìm thấy thiết bị hoặc bạn không có quyền chỉnh sửa!")
    
    update_data = device_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_device, key, value)
        
    db.commit()
    db.refresh(db_device)
    return db_device


# ==========================================
# 5. DELETE - XÓA THIẾT BỊ
# ==========================================
@router.delete("/api/devices/{device_id}")
def delete_device(device_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == "admin":
        db_device = db.query(Device).filter(Device.id == device_id).first()
    else:
        db_device = db.query(Device).filter(Device.id == device_id, Device.owner_id == current_user.id).first()

    if not db_device:
        raise HTTPException(status_code=404, detail="Không tìm thấy thiết bị hoặc bạn không có quyền xóa!")
    
    db.delete(db_device)
    db.commit()
    return {"message": f"Đã xóa thành công thiết bị mang ID {device_id}!"}


# ==========================================
# 6. INGEST TELEMETRY & TỰ ĐỘNG BẮT ALARM
# ==========================================
@router.post("/api/telemetry", response_model=dict)
def ingest_telemetry(data: TelemetryCreate, db: Session = Depends(get_db)):
    db_device = db.query(Device).filter(Device.device_id == data.device_id_str).first()
    if not db_device:
        raise HTTPException(status_code=404, detail="Thiết bị không tồn tại")

    db_device.last_seen = datetime.now(timezone.utc)
    db_device.is_active = True

    signals_json = [sig.dict() for sig in data.signals_data]

    new_telemetry = Telemetry(
        device_id=db_device.id,
        avg_cno=data.avg_cno,
        sat_count=data.sat_count,
        pdop=data.pdop,
        signals_data=signals_json
    )
    
    db.add(new_telemetry)
    db.commit()
    
    # --- LOGIC TẠO CẢNH BÁO TỰ ĐỘNG ---
    # Nếu CNo trung bình giảm xuống dưới 30 dB-Hz -> Báo động đỏ (Nghi ngờ Jamming)
    if 0 < data.avg_cno < 30.0:
        # Kiểm tra xem có cảnh báo nào đang "Active" chưa để tránh spam DB mỗi giây
        existing_alarm = db.query(Alarm).filter(
            Alarm.device_id == db_device.id,
            Alarm.status == "Active"
        ).first()

        if not existing_alarm:
            new_alarm = Alarm(
                device_id=db_device.id,
                severity="Critical",
                event_desc="C/N0 trung bình giảm cực thấp (<30 dB-Hz). Nguy cơ bị phá sóng (Jamming)!"
            )
            db.add(new_alarm)
            db.commit()
    
    return {"status": "success", "message": "Đã lưu dữ liệu GNSS"}


# ==========================================
# 7. LẤY DỮ LIỆU ĐỂ VẼ BIỂU ĐỒ
# ==========================================
@router.get("/api/devices/{device_id_str}/telemetry", response_model=List[TelemetryResponse])
def get_device_telemetry(device_id_str: str, limit: int = 60, db: Session = Depends(get_db)):
    db_device = db.query(Device).filter(Device.device_id == device_id_str).first()
    if not db_device:
        raise HTTPException(status_code=404, detail="Không tìm thấy thiết bị")

    telemetries = db.query(Telemetry)\
        .filter(Telemetry.device_id == db_device.id)\
        .order_by(Telemetry.timestamp.desc())\
        .limit(limit)\
        .all()
    
    return telemetries[::-1]


# ==========================================
# 8. LẤY DANH SÁCH CẢNH BÁO
# ==========================================
@router.get("/api/alarms")
def get_alarms(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == "admin":
        alarms = db.query(Alarm).order_by(Alarm.created_at.desc()).all()
    else:
        alarms = db.query(Alarm).join(Device).filter(Device.owner_id == current_user.id).order_by(Alarm.created_at.desc()).all()
    
    return [{
        "id": a.id,
        "device_id": a.device.device_id,
        "severity": a.severity,
        "event": a.event_desc,
        "status": a.status,
        "time": a.created_at
    } for a in alarms]


# ==========================================
# 9. ĐÁNH DẤU ĐÃ XỬ LÝ CẢNH BÁO
# ==========================================
@router.put("/api/alarms/{alarm_id}/resolve")
def resolve_alarm(alarm_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Đảm bảo người dùng chỉ sửa được cảnh báo của thiết bị họ quản lý (hoặc là admin)
    if current_user.role == "admin":
        alarm = db.query(Alarm).filter(Alarm.id == alarm_id).first()
    else:
        alarm = db.query(Alarm).join(Device).filter(Alarm.id == alarm_id, Device.owner_id == current_user.id).first()
        
    if not alarm:
        raise HTTPException(status_code=404, detail="Không tìm thấy cảnh báo")
    
    alarm.status = "Resolved"
    alarm.resolved_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Đã xử lý cảnh báo"}