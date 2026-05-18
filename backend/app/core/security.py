import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
import os
from dotenv import load_dotenv

# Load các biến từ file .env
load_dotenv()

def get_password_hash(password: str) -> str:
    """Băm mật khẩu trực tiếp bằng thư viện bcrypt chuẩn"""
    salt = bcrypt.gensalt()
    hashed_bytes = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed_bytes.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """So sánh mật khẩu người dùng nhập với mã băm trong DB"""
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

# ==========================================
# CẤU HÌNH TOKEN MỚI (AN TOÀN HƠN)
# ==========================================

# Lấy Key từ file .env
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("LỖI NGHIÊM TRỌNG: Không tìm thấy SECRET_KEY trong file .env!")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # Thẻ có hạn 1 ngày (24h)

def create_access_token(data: dict):
    """Hàm tạo thẻ JWT"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt