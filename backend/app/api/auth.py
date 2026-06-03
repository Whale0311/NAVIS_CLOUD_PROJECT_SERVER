import os
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.schema import User, Tenant # <--- THÊM TENANT VÀO ĐÂY
from app.core.security import get_password_hash, verify_password, create_access_token, SECRET_KEY, ALGORITHM
from app.schemas import UserCreate, UserLogin, ForgotPassword 
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from pydantic import BaseModel
from typing import List

load_dotenv()
router = APIRouter()

# ==========================================
# 1. ĐĂNG KÝ & TẠO TENANT (CÔNG TY MỚI)
# ==========================================
@router.post("/api/register")
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    correct_code = os.getenv("INVITATION_CODE")
    if user.invitation_code != correct_code:
        raise HTTPException(status_code=400, detail="Mã xác nhận không hợp lệ hoặc đã hết hạn!")

    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email này đã được đăng ký!")

    # TẠO TENANT (CÔNG TY) MỚI CHO TÀI KHOẢN NÀY
    company_name = f"Company of {user.email.split('@')[0]}"
    new_tenant = Tenant(name=company_name, subscription_plan="free")
    db.add(new_tenant)
    db.flush() # Lấy ID của Tenant vừa tạo mà chưa cần commit

    hashed_password = get_password_hash(user.password)
    
    # Gán User mới vào Tenant vừa tạo, cấp quyền cao nhất trong nội bộ Công ty
    new_user = User(
        email=user.email, 
        hashed_password=hashed_password, 
        role="user", # Quyền cấp hệ thống vẫn là user thường
        tenant_id=new_tenant.id, 
        role_in_tenant="tenant_admin" # Quyền cấp Công ty là Admin
    )
    
    db.add(new_user)
    db.commit()
    return {"message": "Đăng ký thành công! Không gian làm việc của bạn đã sẵn sàng."}


# ==========================================
# 2. ĐĂNG NHẬP & NHÚNG THÔNG TIN VÀO TOKEN
# ==========================================
@router.post("/api/login")
def login_user(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không chính xác!")
    
    # NÂNG CẤP JWT: Nhúng tenant_id và role_in_tenant vào payload
    access_token = create_access_token(data={
        "sub": db_user.email,
        "role": db_user.role,
        "tenant_id": db_user.tenant_id,
        "role_in_tenant": db_user.role_in_tenant
    })
    return {"message": "Đăng nhập thành công!", "access_token": access_token, "token_type": "bearer"}


@router.post("/api/forgot-password")
def forgot_password(req: ForgotPassword, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == req.email).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Email không tồn tại trong hệ thống!")
    return {"message": "Một đường link khôi phục mật khẩu đã được gửi tới email của bạn!"}


# ==========================================
# 3. PHÂN QUYỀN VÀ BẢO MẬT MULTI-TENANT
# ==========================================
class UserResponse(BaseModel):
    id: int
    email: str
    role: str
    tenant_id: int | None
    role_in_tenant: str
    class Config:
        from_attributes = True

class AdminCreateUser(BaseModel):
    email: str
    password: str
    role_in_tenant: str = "viewer" # Phân quyền: viewer, operator, tenant_admin

class AdminUpdatePassword(BaseModel):
    new_password: str

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    """Hàm giải mã Token và lấy thông tin người dùng đang gọi API"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Token không hợp lệ")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token đã hết hạn hoặc không hợp lệ")
    
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Tài khoản không còn tồn tại")
    return user

def require_tenant_admin(current_user: User = Depends(get_current_user)):
    """Lớp bảo vệ chặn các user không phải là Admin của Công ty"""
    # Nếu là System Admin thì cho qua hết, nếu không phải thì phải là tenant_admin
    if current_user.role != "admin" and current_user.role_in_tenant != "tenant_admin":
        raise HTTPException(status_code=403, detail="Chỉ Quản trị viên (Admin) của tổ chức mới có quyền này!")
    return current_user


# ==========================================
# 4. API QUẢN LÝ NHÂN VIÊN THEO CÔNG TY
# ==========================================
@router.get("/api/users", response_model=List[UserResponse])
def get_users(admin: User = Depends(require_tenant_admin), db: Session = Depends(get_db)):
    # Bức tường lửa: Chỉ lấy user thuộc cùng Công ty với Admin đang đăng nhập
    if admin.role == "admin": 
        return db.query(User).all() # System admin thấy tất cả
    return db.query(User).filter(User.tenant_id == admin.tenant_id).all()

@router.post("/api/users", response_model=UserResponse)
def create_tenant_user(user_data: AdminCreateUser, admin: User = Depends(require_tenant_admin), db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email đã tồn tại!")
    
    hashed_pw = get_password_hash(user_data.password)
    # Tự động gán nhân viên mới vào Công ty của người tạo
    new_user = User(
        email=user_data.email, 
        hashed_password=hashed_pw, 
        role="user",
        tenant_id=admin.tenant_id,
        role_in_tenant=user_data.role_in_tenant
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.delete("/api/users/{user_id}")
def delete_tenant_user(user_id: int, admin: User = Depends(require_tenant_admin), db: Session = Depends(get_db)):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    
    # Bức tường lửa: Chống xóa user của công ty khác
    if admin.role != "admin" and target_user.tenant_id != admin.tenant_id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền xóa nhân sự của tổ chức khác!")
        
    if target_user.id == admin.id:
        raise HTTPException(status_code=400, detail="Bạn không thể tự xóa chính mình!")
        
    db.delete(target_user)
    db.commit()
    return {"message": "Đã xóa tài khoản"}

@router.put("/api/users/{user_id}/password")
def change_tenant_user_password(user_id: int, data: AdminUpdatePassword, admin: User = Depends(require_tenant_admin), db: Session = Depends(get_db)):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
        
    # Bức tường lửa: Chống đổi pass của user công ty khác
    if admin.role != "admin" and target_user.tenant_id != admin.tenant_id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền thay đổi thông tin của tổ chức khác!")
        
    target_user.hashed_password = get_password_hash(data.new_password)
    db.commit()
    return {"message": "Đã đổi mật khẩu thành công"}