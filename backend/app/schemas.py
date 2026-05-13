from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

# --- QUẢN LÝ USER & DEVICE CHUNG (Giữ nguyên của bạn) ---
class UserCreate(BaseModel):
    email: EmailStr 
    password: str
    invitation_code: str 

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class ForgotPassword(BaseModel):
    email: EmailStr

class DeviceBase(BaseModel):
    device_id: str
    name: str
    device_type: str
    site_id: str = "default_site"
    latitude: float | None = None
    longitude: float | None = None
    is_active: bool = True
class RawFileResponse(BaseModel):
    id: int
    device_id: int
    timestamp: datetime
    seq: int
    data_type: str
    file_name: str # Chúng ta sẽ bóc tách từ file_path
    file_size_bytes: int

    class Config:
        from_attributes = True
class DeviceCreate(DeviceBase):
    pass

class DeviceResponse(DeviceBase):
    id: int
    last_seen: Optional[datetime] = None
    owner_id: int
    owner_email: Optional[str] = None

    class Config:
        from_attributes = True

# ==========================================
# CẬP NHẬT: SCHEMAS CHO VIỄN TRẮC (MQTT DATA)
# ==========================================

# Định nghĩa cấu trúc cho 1 vệ tinh dựa theo MQTT schema
class SignalDetail(BaseModel):
    gnss: str
    svid: int
    signal: Optional[str] = None
    prn: str
    cno_dbhz: Optional[float] = None
    used_in_fix: Optional[bool] = None
    receiver_ids: List[str] = []

# Khung dữ liệu Worker sẽ dùng để chèn vào Database
class TelemetryCreate(BaseModel):
    # Metadata từ MQTT
    event_id: str
    seq: int
    device_id_str: str # Map từ 'device_id' trong envelope
    event_time: datetime
    
    # Position
    latitude: Optional[float] = None  # Map từ data.position.lat_deg
    longitude: Optional[float] = None # Map từ data.position.lon_deg
    height_m: Optional[float] = None  # Map từ data.position.height_m
    
    # Summary
    sat_count: int                    # Map từ data.summary.sat_count
    avg_cno_dbhz: Optional[float] = None # Map từ data.summary.avg_cno_dbhz
    pdop: Optional[float] = None      # Map từ data.position.pdop
    is_spoofed: Optional[bool] = None # Map từ data.summary.spoofing
    status: str                       # Map từ data.summary.status
    
    # Arrays
    signals_data: List[SignalDetail]
    detectors_data: Optional[Dict[str, Any]] = None # Chứa mảng thuật toán

# Khung dữ liệu Server trả về cho Frontend (ReactJS)
class TelemetryResponse(BaseModel):
    id: int
    timestamp: datetime
    
    # Chú ý: Trả về Frontend tên gì thì cấu hình tại đây
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