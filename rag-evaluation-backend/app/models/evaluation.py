from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Float
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid
from app.models.types import StringUUID

from app.db.base import Base

class Evaluation(Base):
    __tablename__ = "evaluations"

    id = Column(StringUUID, primary_key=True, default=uuid.uuid4)
    question_id = Column(StringUUID, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    rag_answer_id = Column(StringUUID, ForeignKey("rag_answers.id", ondelete="CASCADE"), nullable=False)
    dimension_id = Column(StringUUID, ForeignKey("evaluation_dimensions.id", ondelete="CASCADE"), nullable=False)
    score = Column(Float, nullable=False)
    evaluation_method = Column(String(20), nullable=False)  # auto, manual
    evaluator_id = Column(StringUUID, ForeignKey("users.id", ondelete="SET NULL"))
    model_name = Column(String(50))
    explanation = Column(Text)
    raw_model_response = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now()) 