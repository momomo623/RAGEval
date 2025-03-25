from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer, Float, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid
from datetime import datetime

from app.db.base import Base
from app.models.types import StringUUID

class PerformanceTest(Base):
    __tablename__ = "performance_tests"

    id = Column(StringUUID, primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    project_id = Column(StringUUID, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    dataset_id = Column(StringUUID, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=True)
    description = Column(Text)
    concurrency = Column(Integer, nullable=False)
    version = Column(String(50))
    
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    
    status = Column(String(20), default="created", nullable=False)
    config = Column(JSONB, default={}, nullable=False)
    
    total_questions = Column(Integer, default=0, nullable=False)
    processed_questions = Column(Integer, default=0, nullable=False)
    success_questions = Column(Integer, default=0, nullable=False)
    failed_questions = Column(Integer, default=0, nullable=False)
    
    summary_metrics = Column(JSONB, default={}, nullable=False) 