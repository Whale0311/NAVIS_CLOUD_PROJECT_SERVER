import asyncio
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone
from contextlib import asynccontextmanager 
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, SessionLocal 
from app.models import schema
from app.api import auth, devices, telemetry
from app.models.schema import Telemetry, User
from app.core.security import get_password_hash
schema.Base.metadata.create_all(bind=engine)
load_dotenv()
# Vẫn giữ nguyên hàm dọn rác
async def cleanup_old_telemetry_task():
    while True:
        db = SessionLocal()
        try:
            cutoff_time = datetime.now(timezone.utc) - timedelta(days=1)
            deleted_count = db.query(Telemetry).filter(Telemetry.timestamp < cutoff_time).delete()
            db.commit()
            if deleted_count > 0:
                print(f"[Cleanup Task] Đã dọn dẹp {deleted_count} bản ghi GNSS cũ hơn 1 ngày.")
        except Exception as e:
            print(f"[Cleanup Error] Lỗi khi dọn dẹp Database: {e}")
            db.rollback()
        finally:
            db.close()
        await asyncio.sleep(600)

# =======================================================
# MỚI: QUẢN LÝ VÒNG ĐỜI (LIFESPAN) THAY CHO ON_EVENT
# =======================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    db = SessionLocal()
    try:
        # Lấy email và password từ file .env
        admin_email = os.getenv("DEFAULT_ADMIN_EMAIL")
        admin_pw = os.getenv("DEFAULT_ADMIN_PASSWORD")

        # Đảm bảo các biến môi trường này có tồn tại trước khi tạo
        if admin_email and admin_pw:
            existing_admin = db.query(User).filter(User.email == admin_email).first()
            if not existing_admin:
                print(f"⚙️ Đang khởi tạo tài khoản Admin mặc định ({admin_email})...")
                hashed_pw = get_password_hash(admin_pw) 
                new_admin = User(email=admin_email, hashed_password=hashed_pw, role="admin")
                db.add(new_admin)
                db.commit()
                print(f"✅ Đã tạo tài khoản Admin thành công: {admin_email}")
        else:
            print("⚠️ Bỏ qua tạo Admin: Không tìm thấy biến môi trường cho Admin.")
    finally:
        db.close()
        
    # Những gì viết trên 'yield' sẽ chạy lúc khởi động server
    task = asyncio.create_task(cleanup_old_telemetry_task())
    print("🚀 Background Task: Auto-cleanup Telemetry đã khởi động!")
    
    yield 
    
    # Chạy khi server tắt
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