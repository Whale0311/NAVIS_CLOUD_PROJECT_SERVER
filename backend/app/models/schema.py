from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Boolean, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    role = Column(String, default="user", nullable=False) 
    
    devices = relationship("Device", back_populates="owner")

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
    
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="devices")
    
    telemetries = relationship("Telemetry", back_populates="device", cascade="all, delete-orphan")
    alarms = relationship("Alarm", back_populates="device", cascade="all, delete-orphan")

class Telemetry(Base):
    __tablename__ = "telemetries"
    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), index=True)
    
    # --- THÊM MỚI: Truy xuất nguồn gốc từ MQTT ---
    event_id = Column(String, unique=True, index=True, nullable=True) # Dùng để dedupe
    seq = Column(Integer, nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True) # Map với event_time

    # --- THÊM MỚI: Tọa độ lịch sử (Để vẽ lại quỹ đạo nếu cần) ---
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    height_m = Column(Float, nullable=True)

    # --- CẬP NHẬT: Dữ liệu tổng hợp ---
    avg_cno_dbhz = Column(Float, nullable=True) # Đổi tên theo schema
    sat_count = Column(Integer)
    pdop = Column(Float, nullable=True)
    is_spoofed = Column(Boolean, nullable=True) # Lưu trực tiếp cờ cảnh báo
    status = Column(String, nullable=True)

    # --- CẬP NHẬT: Dữ liệu mảng JSON ---
    signals_data = Column(JSON) 
    detectors_data = Column(JSON, nullable=True) # Chứa chi tiết thuật toán sos, d3...

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