from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Float
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid

from app.db.base import Base

class Evaluation(Base):
    __tablename__ = "evaluations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    rag_answer_id = Column(UUID(as_uuid=True), ForeignKey("rag_answers.id", ondelete="CASCADE"), nullable=False)
    dimension_id = Column(UUID(as_uuid=True), ForeignKey("evaluation_dimensions.id", ondelete="CASCADE"), nullable=False)
    score = Column(Float, nullable=False)
    evaluation_method = Column(String(20), nullable=False)  # auto, manual
    evaluator_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    model_name = Column(String(50))
    explanation = Column(Text)
    raw_model_response = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now()) 