from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from app.core.ws_manager import manager
from sqlalchemy.orm import Session
from pydantic import BaseModel
import paho.mqtt.publish as mqtt_publish
import uuid
import json
import os
from typing import List
import jwt
from app.core.database import get_db
from app.core.security import SECRET_KEY, ALGORITHM
from app.models.schema import Device, User, Telemetry, Alarm, RawDataLog
from app.schemas import DeviceCreate, DeviceResponse, TelemetryCreate, TelemetryResponse, RawFileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse
from datetime import datetime, timezone 
from app.core.mqtt_config import MQTTConfig

router = APIRouter()
security = HTTPBearer()
class CommandPayload(BaseModel):
    payload: dict = {}  # Cho phép truyền data tùy ý theo từng loại lệnh
# ==========================================
# CỔNG WEBSOCKET CHO FRONTEND REACT NỐI VÀO
# ==========================================
@router.websocket("/ws/devices/{device_id}")
async def websocket_device_endpoint(websocket: WebSocket, device_id: str):
    """React sẽ kết nối vào đây: ws://localhost:8000/ws/devices/device_test1"""
    await manager.connect(websocket, device_id)
    try:
        while True:
            # Lắng nghe nếu React có gửi ping/pong lên (giữ kết nối)
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, device_id)


# ==========================================
# WEBHOOK NỘI BỘ DÀNH RIÊNG CHO WORKER GỌI
# ==========================================
class BroadcastPayload(BaseModel):
    event_type: str  # Ví dụ: "position_update", "command_ack", "alarm"
    data: dict

@router.post("/api/internal/broadcast/{device_id}")
async def internal_broadcast(device_id: str, payload: BroadcastPayload):
    """
    Worker khi hứng được MQTT sẽ gọi API này để nhờ FastAPI đẩy qua WebSocket.
    Lưu ý: Thực tế nên có token bảo mật nội bộ, nhưng dev thì tạm mở để dễ test.
    """
    # Gọi Manager bắn thẳng data lên React đang mở trang của device_id này
    await manager.broadcast_to_device(device_id, {
        "event_type": payload.event_type,
        "device_id": device_id,
        "data": payload.data
    })
    return {"status": "broadcasted"}
    
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
@router.post("/api/devices/{device_id}/command/{command_type}")
def send_device_command(
    device_id: str, 
    command_type: str, 
    command_data: CommandPayload, 
    current_user: User = Depends(get_current_user),  # <-- 1. BỔ SUNG AUTHENTICATION (Bắt buộc có Token)
    db: Session = Depends(get_db)
):
    """
    API để Frontend gọi khi muốn bắn lệnh cấu hình xuống mạch phần cứng.
    Ví dụ: command_type = 'reboot', 'set_rate', 'update_firmware'...
    """
    # 1. Tìm thiết bị trong DB để lấy đúng site_id
    device = db.query(Device).filter(Device.device_id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Không tìm thấy thiết bị trong Database!")

    # 2. BỔ SUNG AUTHORIZATION: Kiểm tra quyền sở hữu
    # Nếu không phải chủ sở hữu và cũng không phải admin thì cấm gửi lệnh
    if device.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Bạn không có quyền điều khiển thiết bị này!")

    site_id = device.site_id

    # 3. Tạo Topic chuẩn theo Schema (Server -> Client)
    topic = f"gnss/{site_id}/{device_id}/cmd/{command_type}/v1"

    # 4. Đóng gói Envelope JSON cực chuẩn
    envelope = {
        "schema": f"gnss.cmd.{command_type}.v1",
        "event_id": f"server-{uuid.uuid4()}",
        "seq": 1, # Tương lai có thể nâng cấp bộ đếm tăng dần
        "device_id": device_id,
        "site_id": site_id,
        "frontend": "ublox", 
        "source": "server",  # Nguồn gốc là từ Backend
        "event_time": None,  # Lệnh từ server nên không có event_time của GNSS
        "ingest_time": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "data": command_data.payload
    }

    # 5. Bắn gói tin lên MQTT Broker
    try:
        mqtt_publish.single(
            topic=topic,
            payload=json.dumps(envelope),
            qos=1,             
            retain=False,      
            hostname=MQTTConfig.BROKER_HOST,
            port=MQTTConfig.BROKER_PORT,
            auth={'username': MQTTConfig.BROKER_USERNAME, 'password': MQTTConfig.BROKER_PASSWORD}
        )
        return {
            "status": "success", 
            "message": f"Đã đẩy lệnh '{command_type}' xuống EMQX Broker!",
            "topic": topic
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi kết nối MQTT: {str(e)}")

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
@router.delete("/api/alarms/{alarm_id}")
async def delete_alarm(
    alarm_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Xóa một cảnh báo. 
    Bảo mật: Phải JOIN với bảng Device để đảm bảo user hiện tại là chủ sở hữu thiết bị.
    """
    # Tìm cảnh báo và xác thực quyền sở hữu trong 1 truy vấn duy nhất
    alarm = db.query(Alarm).join(Device).filter(
        Alarm.id == alarm_id,
        Device.owner_id == current_user.id  # <-- Chặn đứng việc xóa data chéo tài khoản
    ).first()

    if not alarm:
        raise HTTPException(
            status_code=404, 
            detail="Không tìm thấy cảnh báo hoặc bạn không có quyền xóa dữ liệu này!"
        )

    try:
        db.delete(alarm)
        db.commit()
        return {"status": "success", "message": "Đã xóa cảnh báo thành công"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi database: {str(e)}")
# ==========================================
# 1. LẤY DANH SÁCH FILE CỦA THIẾT BỊ
# ==========================================
@router.get("/api/devices/{device_id}/files", response_model=List[RawFileResponse])
def get_device_files(
    device_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Tìm thiết bị và kiểm tra quyền sở hữu
    device = db.query(Device).filter(Device.device_id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Thiết bị không tồn tại")
    
    if device.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Bạn không có quyền truy cập file của thiết bị này")

    # Lấy danh sách file log, sắp xếp mới nhất lên đầu
    logs = db.query(RawDataLog).filter(RawDataLog.device_id == device.id)\
             .order_by(RawDataLog.timestamp.desc()).all()
    
    # Chỉnh sửa lại kết quả để lấy tên file từ đường dẫn tuyệt đối
    for log in logs:
        log.file_name = os.path.basename(log.file_path)
        
    return logs

# ==========================================
# 2. TẢI FILE VẬT LÝ VỀ MÁY
# ==========================================
@router.get("/api/files/download/{file_id}")
def download_raw_file(
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Lấy thông tin file từ DB
    log = db.query(RawDataLog).filter(RawDataLog.id == file_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Không tìm thấy bản ghi file")

    # Kiểm tra quyền sở hữu thiết bị chứa file này
    device = db.query(Device).filter(Device.id == log.device_id).first()
    if device.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Bạn không có quyền tải file này")

    # Kiểm tra file có thực sự tồn tại trên ổ cứng server không
    if not os.path.exists(log.file_path):
        raise HTTPException(status_code=404, detail="File vật lý đã bị xóa hoặc không tìm thấy trên server")

    # Trả về file cho trình duyệt tải về
    file_name = os.path.basename(log.file_path)
    return FileResponse(
        path=log.file_path, 
        filename=file_name,
        media_type='application/octet-stream'
    )
# ==========================================
# 3. XÓA FILE (DATABASE & Ổ CỨNG)
# ==========================================
@router.delete("/api/files/{file_id}")
def delete_raw_file(
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Tìm bản ghi file trong DB
    log = db.query(RawDataLog).filter(RawDataLog.id == file_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Không tìm thấy file trong hệ thống!")

    # 2. Kiểm tra quyền sở hữu thiết bị chứa file này
    device = db.query(Device).filter(Device.id == log.device_id).first()
    if device.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Bạn không có quyền xóa file này!")

    # 3. Xóa tận gốc file vật lý trên ổ cứng (nếu file còn tồn tại)
    if os.path.exists(log.file_path):
        try:
            os.remove(log.file_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Không thể xóa file vật lý: {str(e)}")

    # 4. Xóa bản ghi trong Database
    db.delete(log)
    db.commit()

    return {"status": "success", "message": "Đã xóa file vĩnh viễn!"}