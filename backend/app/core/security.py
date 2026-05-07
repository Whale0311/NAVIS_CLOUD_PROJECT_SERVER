from passlib.context import CryptContext
import jwt
from datetime import datetime, timedelta
# Sử dụng thuật toán bcrypt 
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    """Băm mật khẩu trước khi lưu vào DB"""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """So sánh mật khẩu người dùng nhập với mã băm trong DB"""
    return pwd_context.verify(plain_password, hashed_password)
# Key Token
SECRET_KEY = "SamsungR&DVietNam"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # Thẻ có hạn 1 ngày (24h)

def create_access_token(data: dict):
    """Hàm tạo thẻ JWT"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt