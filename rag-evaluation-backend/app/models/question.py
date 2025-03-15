from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid

from app.db.base import Base

class Question(Base):
    __tablename__ = "questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    question_text = Column(Text, nullable=False)
    standard_answer = Column(Text, nullable=False)
    category = Column(String(50))  # 分类，如"事实型"，"推理型"等
    difficulty = Column(String(20))  # 难度级别，如"简单"，"中等"，"困难"
    tags = Column(JSONB)  # 额外标签
    question_metadata = Column(JSONB)  # 元数据，用于存储问题的附加信息，重命名以避免与SQLAlchemy保留名冲突
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now()) 