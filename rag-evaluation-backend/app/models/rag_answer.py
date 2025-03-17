from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer, Float
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid

from app.db.base import Base
from app.models.types import StringUUID

class RagAnswer(Base):
    __tablename__ = "rag_answers"

    id = Column(StringUUID, primary_key=True, default=uuid.uuid4)
    question_id = Column(StringUUID, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    answer_text = Column(Text, nullable=False)
    collection_method = Column(String(20), nullable=False)  # api, manual
    source_system = Column(String(100))  # RAG系统标识
    api_config_id = Column(StringUUID, ForeignKey("api_configs.id", ondelete="SET NULL"))
    
    # 性能相关字段
    first_response_time = Column(Integer)  # 首次响应时间(毫秒)
    total_response_time = Column(Integer)  # 总响应时间(毫秒)
    character_count = Column(Integer)  # 字符数
    characters_per_second = Column(Float)  # 生成速度(字符/秒)
    
    raw_response = Column(JSONB)  # 原始API响应
    answer_metadata = Column(JSONB)  # 将 metadata 重命名为 answer_metadata
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

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