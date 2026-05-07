from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Chuỗi kết nối Postgres: postgresql://<user>:<password>@<host>:<port>/<db_name>
SQLALCHEMY_DATABASE_URL = "postgresql://navis_admin:navis_password_123@localhost:5432/navis_cloud"

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