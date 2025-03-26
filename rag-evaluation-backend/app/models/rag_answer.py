from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer, Float, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime

from app.db.base import Base
from app.models.types import StringUUID

class RagAnswer(Base):
    __tablename__ = "rag_answers"

    id = Column(StringUUID, primary_key=True, default=uuid.uuid4)
    question_id = Column(StringUUID, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    answer = Column(Text, nullable=False)
    collection_method = Column(String(20), nullable=False)  # api, manual

    sequence_number = Column(Integer, nullable=True)  # 序号
    
    # 性能相关字段
    first_response_time = Column(Float)  # 首次响应时间(秒)，使用numeric(10,3)
    total_response_time = Column(Float)  # 总响应时间(秒)，使用numeric(10,3)
    character_count = Column(Integer)  # 字符数
    characters_per_second = Column(Float)  # 生成速度(字符/秒)，使用numeric(10,2)
    
    raw_response = Column(JSONB)  # 原始API响应
    # 删除不存在的字段
    # answer_metadata = Column(JSONB)
    
    version = Column(String(50), nullable=True)  # 版本信息
    
    created_at = Column(DateTime, default=datetime.utcnow)
    # 数据库中可能没有updated_at字段，如果确实没有，需要删除这行
    # updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    performance_test_id = Column(StringUUID, ForeignKey("performance_tests.id", ondelete="CASCADE"), nullable=True)
    
    # 关系
    question = relationship("Question", back_populates="rag_answers")
    
    # 添加复合唯一约束
    __table_args__ = (
        UniqueConstraint('question_id', 'version', name='unique_question_version'),
    )

class ApiConfig(Base):
    __tablename__ = "api_configs"

    id = Column(StringUUID, primary_key=True, default=uuid.uuid4)
    project_id = Column(StringUUID, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    endpoint_url = Column(String(255), nullable=False)
    auth_type = Column(String(20), default="none")  # none, api_key, basic, oauth
    auth_config = Column(JSONB)  # 认证配置
    request_template = Column(JSONB)  # 请求模板
    headers = Column(JSONB)  # 请求头
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now()) 