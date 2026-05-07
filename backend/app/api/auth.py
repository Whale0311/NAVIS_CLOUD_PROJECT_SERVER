from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.schema import User
from app.core.security import get_password_hash, verify_password, create_access_token, SECRET_KEY, ALGORITHM
from app.schemas import UserCreate, UserLogin, ForgotPassword 
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from pydantic import BaseModel
from typing import List
router = APIRouter()

@router.post("/api/register")
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    # 1. KIỂM TRA MÃ XÁC NHẬN TẠI BACKEND (Bảo mật tuyệt đối)
    if user.invitation_code != "123456":
        raise HTTPException(status_code=400, detail="Mã xác nhận không hợp lệ hoặc đã hết hạn!")

    # 2. Kiểm tra email trùng
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email này đã được đăng ký!")

    hashed_password = get_password_hash(user.password)
    
    # NÂNG CẤP: Gán mặc định role="user" cho những người đăng ký mới
    new_user = User(email=user.email, hashed_password=hashed_password, role="user")
    
    db.add(new_user)
    db.commit()
    return {"message": "Đăng ký thành công!"}

@router.post("/api/login")
def login_user(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không chính xác!")
    
    # NÂNG CẤP: Đưa thêm "role" vào trong payload của JWT Token
    access_token = create_access_token(data={
        "sub": db_user.email,
        "role": db_user.role 
    })
    return {"message": "Đăng nhập thành công!", "access_token": access_token, "token_type": "bearer"}

# 3. API QUÊN MẬT KHẨU
@router.post("/api/forgot-password")
def forgot_password(req: ForgotPassword, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == req.email).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Email không tồn tại trong hệ thống!")
    
    # Thực tế ở đây sẽ dùng SMTPLib gửi email chứa Token reset. Tạm thời trả về OK.
    return {"message": "Một đường link khôi phục mật khẩu đã được gửi tới email của bạn!"}
# 1. Khung dữ liệu Pydantic cho Quản lý User
class UserResponse(BaseModel):
    id: int
    email: str
    role: str
    
    class Config:
        from_attributes = True

class AdminCreateUser(BaseModel):
    email: str
    password: str
    role: str = "user" # Có thể chọn 'admin' hoặc 'user'

class AdminUpdatePassword(BaseModel):
    new_password: str

# 2. Hàm kiểm tra quyền Admin
security = HTTPBearer()
def get_current_admin(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        role: str = payload.get("role")
        if not email or role != "admin":
            raise HTTPException(status_code=403, detail="Chỉ Admin mới có quyền truy cập!")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token không hợp lệ")
    
    user = db.query(User).filter(User.email == email).first()
    return user

# 3. CÁC API QUẢN LÝ (CHỈ ADMIN MỚI GỌI ĐƯỢC)
@router.get("/api/users", response_model=List[UserResponse])
def get_all_users(admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    return db.query(User).all()

@router.post("/api/users", response_model=UserResponse)
def admin_create_user(user_data: AdminCreateUser, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email đã tồn tại!")
    
    hashed_pw = get_password_hash(user_data.password)
    new_user = User(email=user_data.email, hashed_password=hashed_pw, role=user_data.role)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.delete("/api/users/{user_id}")
def admin_delete_user(user_id: int, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    if target_user.id == admin.id:
        raise HTTPException(status_code=400, detail="Bạn không thể tự xóa chính mình!")
        
    db.delete(target_user)
    db.commit()
    return {"message": "Đã xóa tài khoản"}

@router.put("/api/users/{user_id}/password")
def admin_change_password(user_id: int, data: AdminUpdatePassword, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
        
    target_user.hashed_password = get_password_hash(data.new_password)
    db.commit()
    return {"message": "Đã đổi mật khẩu thành công"}