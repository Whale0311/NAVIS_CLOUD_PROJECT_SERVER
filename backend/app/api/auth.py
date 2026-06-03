import os
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.schema import User, Tenant
from app.core.security import get_password_hash, verify_password, create_access_token, SECRET_KEY, ALGORITHM
from app.schemas import UserCreate, UserLogin, ForgotPassword 
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from pydantic import BaseModel
from typing import List, Optional

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

    company_name = f"Company of {user.email.split('@')[0]}"
    new_tenant = Tenant(name=company_name, subscription_plan="free")
    db.add(new_tenant)
    db.flush() 

    hashed_password = get_password_hash(user.password)
    
    new_user = User(
        email=user.email, 
        hashed_password=hashed_password, 
        role="user", 
        tenant_id=new_tenant.id, 
        role_in_tenant="tenant_admin" 
    )
    
    db.add(new_user)
    db.commit()
    return {"message": "Đăng ký thành công! Không gian làm việc của bạn đã sẵn sàng."}

# ==========================================
# 2. ĐĂNG NHẬP & QUÊN MẬT KHẨU
# ==========================================
@router.post("/api/login")
def login_user(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không chính xác!")
    
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
# 3. PHÂN QUYỀN MULTI-TENANT & SCHEMAS
# ==========================================
class UserResponse(BaseModel):
    id: int
    email: str
    role: str
    tenant_id: int | None
    role_in_tenant: str
    tenant_name: Optional[str] = None 
    
    class Config:
        from_attributes = True

class AdminCreateUser(BaseModel):
    email: str
    password: str
    role: str = "user"
    role_in_tenant: str = "viewer" 
    tenant_name: Optional[str] = None
    max_devices: Optional[int] = 5

class AdminUpdatePassword(BaseModel):
    new_password: str

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
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
    if current_user.role != "admin" and current_user.role_in_tenant != "tenant_admin":
        raise HTTPException(status_code=403, detail="Chỉ Quản trị viên (Admin) của tổ chức mới có quyền này!")
    return current_user

# ==========================================
# 4. API QUẢN LÝ NHÂN VIÊN
# ==========================================
@router.get("/api/users")
def get_users(admin: User = Depends(require_tenant_admin), db: Session = Depends(get_db)):
    if admin.role == "admin": 
        results = db.query(User, Tenant).outerjoin(Tenant, User.tenant_id == Tenant.id).all()
    else:
        results = db.query(User, Tenant).outerjoin(Tenant, User.tenant_id == Tenant.id).filter(User.tenant_id == admin.tenant_id).all()
    
    final_list = []
    for u, t in results:
        user_dict = {
            "id": u.id,
            "email": u.email,
            "role": u.role,
            "tenant_id": u.tenant_id,
            "role_in_tenant": u.role_in_tenant,
            "tenant_name": t.name if t else "Hệ thống (System)"
        }
        final_list.append(user_dict)
    return final_list

@router.post("/api/users")
def create_tenant_user(user_data: AdminCreateUser, admin: User = Depends(require_tenant_admin), db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email đã tồn tại!")
    
    hashed_pw = get_password_hash(user_data.password)
    tenant_name_response = None

    if admin.role == "admin" and user_data.role_in_tenant == "tenant_admin":
        if not user_data.tenant_name:
            raise HTTPException(status_code=400, detail="Vui lòng cung cấp tên Công ty (Tenant Name)!")
        
        new_tenant = Tenant(name=user_data.tenant_name, max_devices=user_data.max_devices)
        db.add(new_tenant)
        db.flush() 
        
        new_user = User(
            email=user_data.email, 
            hashed_password=hashed_pw, 
            role="user",
            tenant_id=new_tenant.id,
            role_in_tenant="tenant_admin"
        )
        tenant_name_response = new_tenant.name

    elif admin.role == "admin" and user_data.role_in_tenant == "admin":
        new_user = User(
            email=user_data.email, 
            hashed_password=hashed_pw, 
            role="admin",
            tenant_id=admin.tenant_id,
            role_in_tenant="admin"
        )
        tenant_name_response = "Hệ thống (System)"

    elif admin.role_in_tenant == "tenant_admin":
        if user_data.role_in_tenant in ["admin", "tenant_admin"]:
            raise HTTPException(status_code=403, detail="Bạn không có quyền tạo cấp bậc này!")
            
        new_user = User(
            email=user_data.email, 
            hashed_password=hashed_pw, 
            role="user",
            tenant_id=admin.tenant_id,
            role_in_tenant=user_data.role_in_tenant
        )
        t = db.query(Tenant).filter(Tenant.id == admin.tenant_id).first()
        tenant_name_response = t.name if t else None
    else:
        raise HTTPException(status_code=403, detail="Bạn không có quyền tạo tài khoản!")

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {
        "id": new_user.id,
        "email": new_user.email,
        "role": new_user.role,
        "tenant_id": new_user.tenant_id,
        "role_in_tenant": new_user.role_in_tenant,
        "tenant_name": tenant_name_response
    }

@router.delete("/api/users/{user_id}")
def delete_tenant_user(user_id: int, admin: User = Depends(require_tenant_admin), db: Session = Depends(get_db)):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    
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
        
    if admin.role != "admin" and target_user.tenant_id != admin.tenant_id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền thay đổi thông tin của tổ chức khác!")
        
    target_user.hashed_password = get_password_hash(data.new_password)
    db.commit()
    return {"message": "Đã đổi mật khẩu thành công"}