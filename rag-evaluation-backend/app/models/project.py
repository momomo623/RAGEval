from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid

from app.db.base import Base

from app.models.types import StringUUID
class Project(Base):
    __tablename__ = "projects"

    id = Column(StringUUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(StringUUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    status = Column(String(20), default="created", nullable=False)
    scoring_scale = Column(String(20), default="1-5", nullable=False)
    evaluation_method = Column(String(20), default="auto", nullable=False)
    settings = Column(JSONB, default={})
    public = Column(Boolean, default=False)
    # 新增评测维度字段，默认包含四个常见维度
    evaluation_dimensions = Column(JSONB, default=[
        {"name": "accuracy", "weight": 1.0, "description": "评估回答的事实准确性", "enabled": True},
        {"name": "relevance", "weight": 1.0, "description": "评估回答与问题的相关程度", "enabled": True},
        {"name": "completeness", "weight": 1.0, "description": "评估回答信息的完整性", "enabled": True},
        {"name": "conciseness", "weight": 1.0, "description": "评估回答是否简洁无冗余", "enabled": False}
    ])
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class EvaluationDimension(Base):
    __tablename__ = "evaluation_dimensions"

    id = Column(StringUUID, primary_key=True, default=uuid.uuid4)
    project_id = Column(StringUUID, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(50), nullable=False)
    display_name = Column(String(100), nullable=False)
    description = Column(Text)
    weight = Column(String(10), default="1.0")
    created_at = Column(DateTime(timezone=True), server_default=func.now()) 