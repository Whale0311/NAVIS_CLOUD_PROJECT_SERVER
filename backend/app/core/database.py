import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
load_dotenv()
# Lấy URL từ biến môi trường, nếu không thấy thì dùng giá trị mặc định (tùy chọn)
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

if not SQLALCHEMY_DATABASE_URL:
    raise ValueError("DATABASE_URL không được tìm thấy trong file .env")

# Tạo động cơ kết nối
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# Tạo phiên làm việc (Session)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class để các file models kế thừa
Base = declarative_base()

# Hàm tạo DB session cho mỗi request (Dependency)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()