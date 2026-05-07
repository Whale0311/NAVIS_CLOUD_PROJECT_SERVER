import asyncio
from datetime import datetime, timedelta, timezone
from contextlib import asynccontextmanager  # <-- Thêm thư viện này
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, SessionLocal 
from app.models import schema
from app.api import auth, devices, telemetry
from app.models.schema import Telemetry, User
from app.core.security import get_password_hash
schema.Base.metadata.create_all(bind=engine)

# Vẫn giữ nguyên hàm dọn rác
async def cleanup_old_telemetry_task():
    while True:
        db = SessionLocal()
        try:
            cutoff_time = datetime.now(timezone.utc) - timedelta(hours=1)
            deleted_count = db.query(Telemetry).filter(Telemetry.timestamp < cutoff_time).delete()
            db.commit()
            if deleted_count > 0:
                print(f"[Cleanup Task] Đã dọn dẹp {deleted_count} bản ghi GNSS cũ hơn 1 giờ.")
        except Exception as e:
            print(f"[Cleanup Error] Lỗi khi dọn dẹp Database: {e}")
            db.rollback()
        finally:
            db.close()
        await asyncio.sleep(300)

# =======================================================
# MỚI: QUẢN LÝ VÒNG ĐỜI (LIFESPAN) THAY CHO ON_EVENT
# =======================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Khởi tạo tài khoản Admin mặc định nếu chưa có
    db = SessionLocal()
    try:
        admin_email = "admin1@navis.com"
        existing_admin = db.query(User).filter(User.email == admin_email).first()
        if not existing_admin:
            print("⚙️ Đang khởi tạo tài khoản Admin mặc định...")
            hashed_pw = get_password_hash("123456") # Mật khẩu mặc định
            new_admin = User(email=admin_email, hashed_password=hashed_pw, role="admin")
            db.add(new_admin)
            db.commit()
            print("✅ Đã tạo tài khoản Admin (admin@navis.com / admin123)")
    finally:
        db.close()
    # Những gì viết trên 'yield' sẽ chạy lúc khởi động server
    task = asyncio.create_task(cleanup_old_telemetry_task())
    print("🚀 Background Task: Auto-cleanup Telemetry đã khởi động!")
    yield 
    task.cancel()

# Gắn lifespan vào lúc khởi tạo FastAPI
app = FastAPI(title="Navis-Cloud API Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(devices.router)
app.include_router(telemetry.router)

@app.get("/")
def read_root():
    return {"message": "Backend sẵn sàng!"}