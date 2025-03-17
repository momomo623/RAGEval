from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid

from app.db.base import Base
from app.models.types import StringUUID


class Report(Base):
    __tablename__ = "reports"
    
    id = Column(StringUUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(StringUUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(StringUUID, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    report_type = Column(String(50), nullable=False)  # evaluation, performance, comparison
    public = Column(Boolean, default=False)
    config = Column(JSONB)  # 报告配置
    content = Column(JSONB)  # 报告内容
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now()) 