from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid

from app.db.base import Base
from app.models.types import StringUUID

class Dataset(Base):
    """数据集模型"""
    __tablename__ = "datasets"

    id = Column(StringUUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(StringUUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    is_public = Column(Boolean, default=False)
    tags = Column(JSONB, default=list)
    dataset_metadata = Column(JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class ProjectDataset(Base):
    """项目-数据集关联模型"""
    __tablename__ = "project_datasets"

    id = Column(StringUUID, primary_key=True, default=uuid.uuid4)
    project_id = Column(StringUUID, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    dataset_id = Column(StringUUID, ForeignKey("datasets.id", ondelete="RESTRICT"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now()) 