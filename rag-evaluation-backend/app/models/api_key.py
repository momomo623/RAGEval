from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from app.db.base import Base
from app.models.types import StringUUID


class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(StringUUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(StringUUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    key = Column(String(255), nullable=False)
    provider = Column(String(50), nullable=False)  # openai, anthropic, etc.
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now()) 