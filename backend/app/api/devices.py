from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query, status
from app.core.ws_manager import manager
from sqlalchemy.orm import Session
from sqlalchemy.orm import load_only
from pydantic import BaseModel
import paho.mqtt.publish as mqtt_publish
import uuid
import json
import os
import io
import zipfile
import psutil
import urllib.parse
from sqlalchemy import func
from typing import List, Optional
import jwt
from app.core.database import get_db
from app.core.security import SECRET_KEY, ALGORITHM
from app.models.schema import Device, User, Telemetry, Alarm, RawDataLog, Tenant
from app.schemas import DeviceCreate, DeviceResponse, TelemetryCreate, TelemetryResponse, RawFileResponse, TenantUpdate
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse, StreamingResponse
from datetime import datetime, timezone, timedelta
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

@router.get("/api/admin/dashboard-stats")
def get_superadmin_stats(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Chỉ Super Admin mới có quyền xem thông tin này!")

    # ==========================================
    # 1. THỐNG KÊ KPI TỪ DATABASE THẬT
    # ==========================================
    tenants = db.query(Tenant).all()
    total_tenants = len(tenants)
    active_tenants = sum(1 for t in tenants if t.is_active)
    
    # Xử lý an toàn: Nếu tenant.max_devices bị None thì coi như 0
    max_devices_system = sum((t.max_devices or 0) for t in tenants)
    
    total_devices = db.query(Device).count()
    total_users = db.query(User).count()

    # ==========================================
    # 2. ĐỌC THÔNG SỐ SERVER THẬT (RAM & CPU)
    # ==========================================
    vm = psutil.virtual_memory()
    ram_total = round(vm.total / (1024 ** 3), 1)
    ram_used = round(vm.used / (1024 ** 3), 1)
    ram_string = f"{ram_used}GB / {ram_total}GB"

    cpu_usage = psutil.cpu_percent(interval=None)
    cpu_string = f"{cpu_usage}%"

    # ==========================================
    # 3. DỮ LIỆU BIỂU ĐỒ TRÒN (PHÂN BỔ THIẾT BỊ)
    # ==========================================
    distribution = []
    for t in tenants:
        dev_count = db.query(Device).filter(Device.tenant_id == t.id).count()
        if dev_count > 0:
            distribution.append({
                "tenant_name": t.name,
                "count": dev_count
            })

    # ==========================================
    # 4. DỮ LIỆU BIỂU ĐỒ CỘT (TĂNG TRƯỞNG THỰC TẾ 6 THÁNG QUA)
    # ==========================================
    now = datetime.now()
    monthly_data = {}
    months_order = []

    # Thuật toán tạo khung 6 tháng gần nhất theo thời gian thực (vd: "T1/2026")
    for i in range(5, -1, -1):
        m = now.month - i
        y = now.year
        if m <= 0:
            m += 12
            y -= 1
        label = f"T{m}/{y}"
        months_order.append(label)
        monthly_data[label] = 0

    # Lấy thời gian tạo của tất cả thiết bị để phân loại vào từng tháng
    all_devices = db.query(Device.created_at).all()
    for dev in all_devices:
        if dev.created_at: # Đề phòng data cũ không có thời gian tạo
            m_label = f"T{dev.created_at.month}/{dev.created_at.year}"
            # Chỉ cộng dồn nếu tháng đó nằm trong khung 6 tháng gần nhất
            if m_label in monthly_data:
                monthly_data[m_label] += 1

    # Đóng gói dữ liệu để gửi xuống React
    monthly_growth = [{"month": label, "devices": monthly_data[label]} for label in months_order]

    return {
        "kpi": {
            "tenants": {"total": total_tenants, "active": active_tenants},
            "devices": {"used": total_devices, "capacity": max_devices_system},
            "users": {"total": total_users},
            "server": {"status": "Online", "cpu": cpu_string, "ram": ram_string}
        },
        "charts": {
            "distribution": distribution,
            "monthly": monthly_growth
        }
    }
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
# 1. LẤY DANH SÁCH FILE CỦA THIẾT BỊ (HỖ TRỢ LỌC)
# ==========================================
@router.get("/api/devices/{device_id}/files")
def get_device_files(
    device_id: str,
    file_type: Optional[str] = Query(None, description="Lọc theo loại: ubx hoặc bin"),
    has_alarm: Optional[bool] = Query(None, description="True nếu chỉ muốn lấy file có tấn công"),
    date_str: Optional[str] = Query(None, description="Lọc theo ngày: YYYY-MM-DD"),
    limit: int = 100, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    device = db.query(Device).filter(Device.device_id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Thiết bị không tồn tại")
    
    # Kiểm tra quyền sở hữu
    if device.tenant_id != current_user.tenant_id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Bạn không có quyền truy cập file của thiết bị này")

    # Xây dựng Query Động (Dynamic Query)
    query = db.query(RawDataLog).filter(RawDataLog.device_id == device.id)
    
    if file_type:
        query = query.filter(RawDataLog.file_type == file_type)
    if has_alarm is not None:
        query = query.filter(RawDataLog.has_alarm == has_alarm)
    # 🚨 ĐÃ SỬA: XỬ LÝ LỆCH MÚI GIỜ (TIMEZONE UTC+7)
    if date_str:
        try:
            # 1. Biến chuỗi "2026-06-14" thành object datetime
            local_date = datetime.strptime(date_str, "%Y-%m-%d")
            
            # 2. Bắt đầu ngày ở VN (00:00 14/06) lùi về UTC -> 17:00 13/06
            utc_start = local_date - timedelta(hours=7)
            
            # 3. Kết thúc ngày ở VN (23:59:59 14/06) -> 16:59:59 14/06 (UTC)
            utc_end = utc_start + timedelta(days=1, seconds=-1)
            
            # 4. Lọc theo khoảng thời gian chuẩn xác
            query = query.filter(
                RawDataLog.start_time >= utc_start,
                RawDataLog.start_time <= utc_end
            )
        except Exception as e:
            pass

    logs = query.order_by(RawDataLog.start_time.desc()).limit(limit).all()
    # Đóng gói dữ liệu trả về cho Frontend
    result = []
    for log in logs:
        result.append({
            "id": log.id,
            "file_name": os.path.basename(log.file_path),
            "start_time": log.start_time,
            "end_time": log.end_time,
            "file_type": log.file_type,
            "has_alarm": log.has_alarm,
            "file_size_bytes": log.file_size_bytes
        })
        
    return result

# ==========================================
# 2. TẢI FILE DƯỚI DẠNG NÉN (.ZIP) IN-MEMORY
# ==========================================
@router.get("/api/files/download/{file_id}")
def download_raw_file(
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    log = db.query(RawDataLog).filter(RawDataLog.id == file_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Không tìm thấy bản ghi file")

    device = db.query(Device).filter(Device.id == log.device_id).first()
    if device.tenant_id != current_user.tenant_id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Bạn không có quyền tải file này")

    if not os.path.exists(log.file_path):
        raise HTTPException(status_code=404, detail="File vật lý đã bị xóa hoặc không tìm thấy trên server")

    file_name = os.path.basename(log.file_path)
    zip_filename = f"{file_name}.zip"

    # 🚀 Nén file vào RAM (Không ghi ra ổ cứng)
    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Đưa file vật lý vào trong gói zip
        zf.write(log.file_path, arcname=file_name)
    
    # Đưa con trỏ bộ nhớ về đầu để bắt đầu gửi
    memory_file.seek(0)
    encoded_filename = urllib.parse.quote(zip_filename)
    
    return StreamingResponse(
        memory_file,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename*=utf-8''{encoded_filename}"
        }
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
    log = db.query(RawDataLog).filter(RawDataLog.id == file_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Không tìm thấy file trong hệ thống!")

    device = db.query(Device).filter(Device.id == log.device_id).first()
    if device.tenant_id != current_user.tenant_id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Bạn không có quyền xóa file này!")

    if os.path.exists(log.file_path):
        try:
            os.remove(log.file_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Không thể xóa file vật lý: {str(e)}")

    db.delete(log)
    db.commit()

    return {"status": "success", "message": "Đã xóa file vĩnh viễn!"}