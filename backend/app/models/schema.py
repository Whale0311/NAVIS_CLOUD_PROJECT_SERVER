# app/models/schema.py
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Boolean, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

# ==========================================
# 1. BẢNG TENANT (CÔNG TY / TỔ CHỨC) - MỚI
# ==========================================
class Tenant(Base):
    __tablename__ = "tenants"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    subscription_plan = Column(String, default="free")
    
    # NÂNG CẤP MỚI: Giới hạn số thiết bị tối đa (0 = không giới hạn)
    max_devices = Column(Integer, default=5, nullable=False) 
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    is_active = Column(Boolean, default=True)

    # Quan hệ: Một Tenant có nhiều User và nhiều Device
    users = relationship("User", back_populates="tenant", cascade="all, delete-orphan")
    devices = relationship("Device", back_populates="tenant", cascade="all, delete-orphan")


# ==========================================
# 2. BẢNG USER (NGƯỜI DÙNG) - ĐÃ CẬP NHẬT
# ==========================================
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Quyền cấp Hệ Thống (System Admin của Navis-Cloud hay User bình thường)
    role = Column(String, default="user", nullable=False) 
    
    # MULTI-TENANT: Thuộc về công ty nào & Quyền hạn trong công ty đó
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True)
    # Các quyền: "tenant_admin" (Quản lý), "operator" (Vận hành), "viewer" (Chỉ xem)
    role_in_tenant = Column(String, default="viewer", nullable=False) 
    
    tenant = relationship("Tenant", back_populates="users")
    
    # Mối quan hệ mới: Các thiết bị được phân công trực tiếp cho user này (tài xế)
    assigned_devices = relationship("Device", back_populates="assigned_user")


# ==========================================
# 3. BẢNG DEVICE (THIẾT BỊ) - ĐÃ CẬP NHẬT
# ==========================================
class Device(Base):
    __tablename__ = "devices"
    
    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    device_type = Column(String, nullable=False) 
    
    latitude = Column(Float, nullable=True)  
    longitude = Column(Float, nullable=True) 

    is_active = Column(Boolean, default=True)
    last_seen = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    site_id = Column(String, default="default_site", index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    # MULTI-TENANT: Thiết bị là TÀI SẢN CỦA CÔNG TY (Tenant)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), index=True, nullable=True)
    
    # Gán tạm thời cho một tài xế/nhân viên cụ thể (Có thể null nếu chưa gán)
    assigned_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    tenant = relationship("Tenant", back_populates="devices")
    assigned_user = relationship("User", back_populates="assigned_devices")
    
    telemetries = relationship("Telemetry", back_populates="device", cascade="all, delete-orphan")
    alarms = relationship("Alarm", back_populates="device", cascade="all, delete-orphan")
    raw_data_logs = relationship("RawDataLog", back_populates="device", cascade="all, delete-orphan")


# ==========================================
# CÁC BẢNG DỮ LIỆU LOG (GIỮ NGUYÊN)
# Bởi vì chúng đã liên kết sẵn với Device, 
# mà Device lại liên kết với Tenant nên không cần sửa gì!
# ==========================================

class Telemetry(Base):
    __tablename__ = "telemetries"
    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), index=True)
    
    event_id = Column(String, unique=True, index=True, nullable=True)
    seq = Column(Integer, nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    height_m = Column(Float, nullable=True)

    avg_cno_dbhz = Column(Float, nullable=True)
    sat_count = Column(Integer)
    pdop = Column(Float, nullable=True)
    is_spoofed = Column(Boolean, nullable=True)
    status = Column(String, nullable=True)

    signals_data = Column(JSON) 
    detectors_data = Column(JSON, nullable=True)

    device = relationship("Device", back_populates="telemetries")


class Alarm(Base):
    __tablename__ = "alarms"
    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), index=True)
    severity = Column(String, nullable=False)
    event_desc = Column(String, nullable=False)
    status = Column(String, default="Active") 
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    resolved_at = Column(DateTime, nullable=True)

    device = relationship("Device", back_populates="alarms")


class RawDataLog(Base):
    __tablename__ = "raw_data_logs"
    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), index=True)
    
    # ==========================================
    # 🕒 KHUNG THỜI GIAN (1 TIẾNG 1 FILE)
    # ==========================================
    start_time = Column(DateTime(timezone=True), index=True, nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=True)
    
    # ==========================================
    # 📂 PHÂN LOẠI & ĐÁNH DẤU
    # ==========================================
    file_type = Column(String, nullable=False) # 'ubx' hoặc 'bin'
    has_alarm = Column(Boolean, default=False, index=True) # 🚨 Cờ đánh dấu file có chứa tấn công
    
    # ==========================================
    # 💾 THÔNG TIN VẬT LÝ
    # ==========================================
    file_path = Column(String, nullable=False) 
    file_size_bytes = Column(Integer, default=0)
    
    device = relationship("Device", back_populates="raw_data_logs")