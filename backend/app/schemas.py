# app/schemas.py
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

# ==========================================
# 1. SCHEMAS CHO TENANT (CÔNG TY / TỔ CHỨC)
# ==========================================
class TenantBase(BaseModel):
    name: str
    subscription_plan: str = "free"
    max_devices: int = 5 # NÂNG CẤP

class TenantCreate(TenantBase):
    pass

class TenantResponse(TenantBase):
    id: int
    created_at: datetime
    is_active: bool
    current_device_count: Optional[int] = 0 
    
    class Config:
        from_attributes = True


# ==========================================
# 2. SCHEMAS CHO USER (ĐÃ CẬP NHẬT MULTI-TENANT)
# ==========================================
class UserCreate(BaseModel):
    email: EmailStr 
    password: str
    invitation_code: str # Vẫn giữ lại để kiểm soát đăng ký tự do

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class ForgotPassword(BaseModel):
    email: EmailStr

# Schema trả về thông tin User cho ReactJS
class UserResponse(BaseModel):
    id: int
    email: EmailStr
    role: str
    tenant_id: Optional[int] = None
    role_in_tenant: str
    created_at: datetime

    class Config:
        from_attributes = True


# ==========================================
# 3. SCHEMAS CHO DEVICE (THIẾT BỊ) - ĐÃ ĐỔI OWNER THÀNH TENANT
# ==========================================
class DeviceBase(BaseModel):
    device_id: str
    name: str
    device_type: str
    site_id: str = "default_site"
    latitude: float | None = None
    longitude: float | None = None
    is_active: bool = True
    # Thêm trường để gán tài xế/người dùng
    assigned_user_id: Optional[int] = None

class DeviceCreate(DeviceBase):
    pass

class DeviceResponse(DeviceBase):
    id: int
    last_seen: Optional[datetime] = None
    
    # THAY ĐỔI LỚN NHẤT: Bỏ owner_id, thay bằng tenant_id
    tenant_id: Optional[int] = None
    
    class Config:
        from_attributes = True


# ==========================================
# 4. SCHEMAS CHO FILE LOG & TELEMETRY (GIỮ NGUYÊN)
# ==========================================
class RawFileResponse(BaseModel):
    id: int
    device_id: int
    timestamp: datetime
    seq: int
    data_type: str
    file_name: str 
    file_size_bytes: int

    class Config:
        from_attributes = True


class SignalDetail(BaseModel):
    prn: str
    svid: Optional[int] = None
    gnss: Optional[str] = "UNKNOWN"
    signal: Optional[str] = None
    cno: Optional[float] = None      
    cno_dbhz: Optional[float] = None 
    used_in_fix: Optional[bool] = None
    receiver_ids: List[str] = []

class TelemetryCreate(BaseModel):
    event_id: str
    seq: int
    device_id_str: str 
    event_time: datetime
    
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    height_m: Optional[float] = None
    
    sat_count: int
    avg_cno_dbhz: Optional[float] = None
    pdop: Optional[float] = None
    is_spoofed: Optional[bool] = None
    status: str
    
    signals_data: List[SignalDetail]
    detectors_data: Optional[Dict[str, Any]] = None

class TelemetryResponse(BaseModel):
    id: int
    timestamp: datetime
    
    latitude: Optional[float]
    longitude: Optional[float]
    sat_count: int
    avg_cno_dbhz: Optional[float]
    pdop: Optional[float]
    is_spoofed: Optional[bool]
    status: Optional[str]
    
    signals_data: List[SignalDetail]

    class Config:
        from_attributes = True