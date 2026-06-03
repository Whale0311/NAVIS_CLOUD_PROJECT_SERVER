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
from app.models.schema import Telemetry, User, RawDataLog
from app.core.security import get_password_hash

schema.Base.metadata.create_all(bind=engine)
load_dotenv()

# ==========================================
# AUTO CLEANUP (TELEMETRY + RAW FILES)
# ==========================================
async def cleanup_old_telemetry_task():
    # 1. Xác định đường dẫn gốc chứa các file log (Backend/storage/raw_logs)
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    raw_logs_dir = os.path.join(base_dir, "storage", "raw_logs")

    while True:
        db = SessionLocal()
        try:
            cutoff_time = datetime.now(timezone.utc) - timedelta(days=30)
            
            # 2. Dọn dẹp bản ghi Telemetry
            deleted_telemetry = db.query(Telemetry).filter(Telemetry.timestamp < cutoff_time).delete()
            
            # 3. Dọn dẹp các file vật lý & bản ghi RawDataLog
            old_logs = db.query(RawDataLog).filter(RawDataLog.timestamp < cutoff_time).all()
            file_deleted = 0
            
            for log in old_logs:
                # Xóa file thật trên ổ cứng
                if log.file_path and os.path.exists(log.file_path):
                    try:
                        os.remove(log.file_path)
                        file_deleted += 1
                    except Exception as e:
                        print(f"[Cleanup Error] Không thể xóa file vật lý {log.file_path}: {e}")
                        
            # Xóa bản ghi trong Database sau khi dọn file vật lý xong
            db.query(RawDataLog).filter(RawDataLog.timestamp < cutoff_time).delete()
            db.commit()

            # 4. QUÉT VÀ NUỐT CHỬNG THƯ MỤC TRỐNG
            dirs_deleted = 0
            if os.path.exists(raw_logs_dir):
                for dir_name in os.listdir(raw_logs_dir):
                    dir_path = os.path.join(raw_logs_dir, dir_name)
                    
                    # Kiểm tra xem nó có phải là thư mục không (bỏ qua file linh tinh nếu có)
                    if os.path.isdir(dir_path):
                        # Nếu thư mục không chứa bất kỳ file nào (rỗng)
                        if not os.listdir(dir_path): 
                            try:
                                os.rmdir(dir_path) # Lệnh này chỉ xóa thư mục rỗng, rất an toàn
                                dirs_deleted += 1
                            except Exception as e:
                                print(f"[Cleanup Error] Không thể xóa thư mục rỗng {dir_path}: {e}")
            
            # 5. Báo cáo kết quả
            if deleted_telemetry > 0 or file_deleted > 0 or dirs_deleted > 0:
                print(f"[Cleanup Task] Đã dọn dẹp {deleted_telemetry} Telemetry, {file_deleted} file RAW, và {dirs_deleted} thư mục trống.")
                
        except Exception as e:
            print(f"[Cleanup Error] Lỗi khi dọn dẹp hệ thống: {e}")
            db.rollback()
        finally:
            db.close()
            
        # Chạy kiểm tra 1 ngày 1 lần (24 giờ = 86400 giây)
        await asyncio.sleep(86400)

@asynccontextmanager
async def lifespan(app: FastAPI):
    db = SessionLocal()
    try:
        admin_email = os.getenv("DEFAULT_ADMIN_EMAIL")
        admin_pw = os.getenv("DEFAULT_ADMIN_PASSWORD")

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
        
    task = asyncio.create_task(cleanup_old_telemetry_task())
    print("🚀 Background Task: Auto-cleanup Telemetry đã khởi động!")
    
    yield 
    
    task.cancel()

# ==========================================
# CẬP NHẬT: DỜI TÀI LIỆU SANG /api/docs
# ==========================================
app = FastAPI(
    title="Navis-Cloud API Backend", 
    lifespan=lifespan,
    docs_url="/api/docs",        # Chuyển Swagger UI sang đây
    openapi_url="/api/openapi.json"
)

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

# Dành riêng cho kiểm tra sức khỏe
@app.get("/api")
def read_root():
    return {"message": "Backend sẵn sàng!"}