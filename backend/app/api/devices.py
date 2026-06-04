from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query, status
from app.core.ws_manager import manager
from sqlalchemy.orm import Session
from sqlalchemy.orm import load_only
from pydantic import BaseModel
import paho.mqtt.publish as mqtt_publish
import uuid
import json
import os
from typing import List
import jwt
from app.core.database import get_db
from app.core.security import SECRET_KEY, ALGORITHM
from app.models.schema import Device, User, Telemetry, Alarm, RawDataLog, Tenant
from app.schemas import DeviceCreate, DeviceResponse, TelemetryCreate, TelemetryResponse, RawFileResponse, TenantUpdate
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
async def websocket_device_endpoint(
    websocket: WebSocket, 
    device_id: str,
    token: str = Query(None), # Bắt token từ URL: ?token=abc...
    db: Session = Depends(get_db)
):
    """Cổng kết nối thời gian thực đã bọc bảo mật Multi-Tenant"""
    # 1. Kiểm tra Token có tồn tại không
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Missing Token")
        return

    try:
        # 2. Giải mã Token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        role: str = payload.get("role")
        role_in_tenant: str = payload.get("role_in_tenant")
        
        user = db.query(User).filter(User.email == email).first()
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="User not found")
            return

        # 3. Tìm thiết bị đang yêu cầu kết nối
        device = db.query(Device).filter(Device.device_id == device_id).first()
        if not device:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Device not found")
            return
            
        # 4. BỨC TƯỜNG LỬA MULTI-TENANT 
        if role != "admin":
            # Chặn nếu xem xe của Công ty khác
            if device.tenant_id != user.tenant_id:
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Unauthorized Tenant")
                return
            # Chặn nếu Tài xế (Viewer) xem xe không được giao
            if role_in_tenant != "tenant_admin" and device.assigned_user_id != user.id:
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Unauthorized Device Assignment")
                return

    except jwt.PyJWTError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid Token")
        return
    except Exception as e:
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR, reason=str(e))
        return

    # Vượt qua tất cả bảo mật -> Mở cửa cho phép kết nối nhận tọa độ Live
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
        # Nâng cấp lấy thêm thông tin tenant từ Token
        tenant_id: int = payload.get("tenant_id") 
        if email is None:
            raise HTTPException(status_code=401, detail="Token không hợp lệ")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token không hợp lệ hoặc đã hết hạn")
    
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise HTTPException(status_code=401, detail="Không tìm thấy người dùng")
    
    # Gắn tạm tenant_id vào object user để các hàm bên dưới gọi nhanh
    user.tenant_id = tenant_id 
    return user
import uuid
from datetime import datetime, timezone
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
# Giả sử bạn đã import các dependencies cần thiết như get_db, get_current_user, Device, MQTTConfig, mqtt_publish

@router.post("/api/devices/{device_id}/command/{command_type}")
def send_device_command(
    device_id: str, 
    command_type: str, 
    command_data: dict, # Đổi thành dict để nhận thẳng tham số động từ Frontend
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    API để Frontend gọi khi muốn bắn lệnh UBLOX xuống mạch phần cứng.
    Hỗ trợ: start, stop, restart, status, configure.
    """
    # 1. Tìm thiết bị trong DB để lấy đúng site_id
    device = db.query(Device).filter(Device.device_id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Không tìm thấy thiết bị trong Database!")

    # 2. MULTI-TENANT AUTHORIZATION: Chỉ được điều khiển thiết bị của cùng Công ty
    if current_user.role != "admin" and device.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền điều khiển thiết bị của tổ chức khác!")

    site_id = device.site_id or "default_site" # Backup nếu site_id rỗng

    # 3. Tạo Topic chuẩn theo Schema (Server -> Client) (Mục 9.5)
    # Thêm chữ "ublox" vào Topic
    topic = f"gnss/{site_id}/{device_id}/cmd/ublox/{command_type}/v1"

    # 4. Đóng gói Envelope JSON chuẩn IoT
    now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    unique_event_id = f"server-cmd-{uuid.uuid4().hex[:12]}"

    envelope = {
        "schema": f"gnss.cmd.ublox.{command_type}.v1",
        "event_id": unique_event_id,
        "seq": 1, 
        "device_id": device_id,
        "site_id": site_id,
        "frontend": "ublox", 
        "source": "server", 
        "event_time": now_iso, 
        "ingest_time": now_iso,
        "data": {
            "command_id": unique_event_id,
            "command_type": command_type,
            "params": command_data  # Payload từ Web truyền lên sẽ nằm gọn trong "params"
        }
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
            "message": f"Đã đẩy lệnh '{command_type}' xuống thiết bị!",
            "event_id": unique_event_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi kết nối MQTT: {str(e)}")
# ==========================================
# 1. CREATE - THÊM THIẾT BỊ MỚI
# ==========================================
@router.post("/api/devices", response_model=DeviceResponse)
def create_device(device: DeviceCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # 1. Kiểm tra giới hạn thiết bị
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    
    if tenant and tenant.max_devices > 0:
        current_count = db.query(Device).filter(Device.tenant_id == current_user.tenant_id).count()
        if current_count >= tenant.max_devices:
            raise HTTPException(
                status_code=403, 
                detail=f"Tổ chức của bạn đã đạt giới hạn tối đa ({tenant.max_devices} thiết bị). Vui lòng nâng cấp gói cước!"
            )
            
    # 2. Kiểm tra trùng lặp
    db_device = db.query(Device).filter(Device.device_id == device.device_id).first()
    if db_device:
        raise HTTPException(status_code=400, detail="Mã thiết bị này đã tồn tại trong hệ thống!")
    
    # 3. Tạo mới
    new_device = Device(**device.model_dump(), tenant_id=current_user.tenant_id)
    db.add(new_device)
    db.commit()
    db.refresh(new_device)
    
    # ĐIỂM SỬA QUAN TRỌNG: Gắn thêm tenant_name ngay lúc trả về để React cập nhật State trơn tru
    dev_dict = new_device.__dict__.copy()
    dev_dict["tenant_name"] = tenant.name if tenant else "N/A"
    
    return dev_dict

@router.put("/api/tenants/{tenant_id}")
def update_tenant_status(
    tenant_id: int, 
    data: TenantUpdate, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    # 1. Chỉ Super Admin mới có đặc quyền này
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Chỉ Super Admin mới có quyền cập nhật thông tin Tổ chức!")
    
    # 2. Tìm tổ chức trong DB
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Không tìm thấy Tổ chức (Tenant) này!")
    
    # 3. Cập nhật dữ liệu
    tenant.max_devices = data.max_devices
    tenant.is_active = data.is_active
    db.commit()
    
    return {
        "message": "Cập nhật Tổ chức thành công",
        "tenant_id": tenant.id,
        "max_devices": tenant.max_devices,
        "is_active": tenant.is_active
    }
# ==========================================
# 2. READ ALL - LẤY DANH SÁCH THIẾT BỊ
# ==========================================
@router.get("/api/devices", response_model=List[DeviceResponse])
def get_devices(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == "admin":
        devices = [] # ĐIỂM SỬA: Super Admin không quản lý thiết bị
    elif current_user.role_in_tenant == "tenant_admin":
        # Giám đốc: Thấy mọi xe của cty
        devices = db.query(Device).filter(Device.tenant_id == current_user.tenant_id).all() 
    else:
        # Nhân viên/Manager: Chỉ thấy xe được giao
        devices = db.query(Device).filter(
            Device.tenant_id == current_user.tenant_id,
            Device.assigned_user_id == current_user.id
        ).all()
    
    result = []
    for dev in devices:
        dev_dict = dev.__dict__.copy()
        dev_dict["tenant_name"] = dev.tenant.name if dev.tenant else "N/A"
        result.append(dev_dict)
        
    return result

# ==========================================
# 3. READ ONE - LẤY CHI TIẾT 1 THIẾT BỊ
# ==========================================
@router.get("/api/devices/{device_id}", response_model=DeviceResponse)
def get_device_by_id(device_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == "admin":
        raise HTTPException(status_code=403, detail="Super Admin không quản lý thiết bị!")
    elif current_user.role_in_tenant == "tenant_admin":
        db_device = db.query(Device).filter(Device.id == device_id, Device.tenant_id == current_user.tenant_id).first()
    else:
        # Nhân sự chỉ xem được xe của mình
        db_device = db.query(Device).filter(
            Device.id == device_id, 
            Device.tenant_id == current_user.tenant_id,
            Device.assigned_user_id == current_user.id
        ).first()
        
    if not db_device:
        raise HTTPException(status_code=404, detail="Không tìm thấy thiết bị hoặc bạn không có quyền truy cập!")
        
    # ĐIỂM SỬA: Đóng gói lại thành Dictionary giống API GET All
    dev_dict = db_device.__dict__.copy()
    dev_dict["tenant_name"] = db_device.tenant.name if db_device.tenant else "N/A"
    
    return dev_dict

# ==========================================
# 4. UPDATE - CẬP NHẬT THÔNG TIN THIẾT BỊ
# ==========================================
@router.put("/api/devices/{device_id}", response_model=DeviceResponse)
def update_device(device_id: int, device_update: DeviceCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # CHẶN TÀI XẾ SỬA XE
    if current_user.role != "admin" and current_user.role_in_tenant != "tenant_admin":
        raise HTTPException(status_code=403, detail="Chỉ Quản lý mới được phép thay đổi thông tin thiết bị!")

    if current_user.role == "admin":
        db_device = db.query(Device).filter(Device.id == device_id).first()
    else:
        db_device = db.query(Device).filter(Device.id == device_id, Device.tenant_id == current_user.tenant_id).first()

    if not db_device:
        raise HTTPException(status_code=404, detail="Không tìm thấy thiết bị!")
    
    update_data = device_update.model_dump(exclude_unset=True) # Dùng model_dump cho Pydantic v2
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
        # MỚI: Lọc thiết bị theo Công ty (Tenant)
        db_device = db.query(Device).filter(Device.id == device_id, Device.tenant_id == current_user.tenant_id).first()
        # Dành cho get_devices: devices = db.query(Device).filter(Device.tenant_id == current_user.tenant_id).all()

    if not db_device:
        raise HTTPException(status_code=404, detail="Không tìm thấy thiết bị hoặc bạn không có quyền xóa!")
    
    db.delete(db_device)
    db.commit()
    return {"message": f"Đã xóa thành công thiết bị mang ID {device_id}!"}


# ==========================================
# 5.5. ASSIGN - GIAO XE CHO TÀI XẾ (Chỉ Admin Công ty)
# ==========================================
class DeviceAssign(BaseModel):
    user_id: int | None = None # Gửi ID tài xế để giao xe, gửi null để thu hồi

@router.put("/api/devices/{device_id}/assign")
def assign_device(device_id: int, assign_data: DeviceAssign, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # 1. Bảo mật: Chỉ Quản trị viên (Super Admin hoặc Tenant Admin) mới được giao xe
    if current_user.role != "admin" and current_user.role_in_tenant != "tenant_admin":
        raise HTTPException(status_code=403, detail="Chỉ Quản lý mới có quyền phân công thiết bị!")

    # 2. Tìm xe 
    if current_user.role == "admin":
        db_device = db.query(Device).filter(Device.id == device_id).first()
    else:
        db_device = db.query(Device).filter(Device.id == device_id, Device.tenant_id == current_user.tenant_id).first()
        
    if not db_device:
        raise HTTPException(status_code=404, detail="Không tìm thấy thiết bị!")

    # 3. Kiểm tra nhân viên được giao có hợp lệ không (Cùng công ty)
    if assign_data.user_id is not None:
        target_user = db.query(User).filter(User.id == assign_data.user_id).first()
        if not target_user or (current_user.role != "admin" and target_user.tenant_id != current_user.tenant_id):
            raise HTTPException(status_code=400, detail="Nhân viên không hợp lệ hoặc không thuộc tổ chức của bạn!")
            
    # 4. Lưu phân công
    db_device.assigned_user_id = assign_data.user_id
    db.commit()
    
    return {"message": "Đã giao xe thành công" if assign_data.user_id else "Đã thu hồi xe về kho"}

# ==========================================
# 8. LẤY DANH SÁCH CẢNH BÁO
# ==========================================
@router.get("/api/alarms")
def get_alarms(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == "admin":
        alarms = [] # ĐIỂM SỬA: Super Admin không xem cảnh báo của khách
    else:
        alarms = db.query(Alarm).join(Device)\
            .filter(Device.tenant_id == current_user.tenant_id)\
            .order_by(Alarm.created_at.desc()).all()
    
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
        alarm = db.query(Alarm).join(Device).filter(Alarm.id == alarm_id, Device.tenant_id == current_user.tenant_id).first()
        
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
        Device.tenant_id == current_user.tenant_id  # <-- Chặn đứng việc xóa data chéo tài khoản
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
    limit: int = 100, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    device = db.query(Device).filter(Device.device_id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Thiết bị không tồn tại")
    
    # ĐIỂM SỬA QUAN TRỌNG: Xóa bỏ điều kiện ưu tiên (current_user.role != "admin")
    # Giờ đây, nếu ID công ty không khớp, sẽ lập tức bị chặn.
    if device.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền truy cập file của thiết bị này")

    logs = db.query(RawDataLog)\
             .filter(RawDataLog.device_id == device.id)\
             .options(load_only(RawDataLog.id, RawDataLog.timestamp, RawDataLog.file_path))\
             .order_by(RawDataLog.timestamp.desc())\
             .limit(limit)\
             .all()
    
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
    if device.tenant_id != current_user.tenant_id and current_user.role != "admin":
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
    if device.tenant_id != current_user.tenant_id and current_user.role != "admin":
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