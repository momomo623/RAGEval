from datetime import datetime
from typing import Optional, List
from sqlalchemy import (
    Column, String, Text, Integer, Float, Boolean, 
    ForeignKey, DateTime, UniqueConstraint, Numeric, ARRAY
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid

from app.db.base import Base
from app.models.types import StringUUID

class AccuracyTest(Base):
    """精度评测表"""
    __tablename__ = "accuracy_test"
    
    id = Column(StringUUID, primary_key=True, default=uuid.uuid4)
    project_id = Column(StringUUID, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    dataset_id = Column(StringUUID, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    evaluation_type = Column(String(20), nullable=False)
    scoring_method = Column(String(20), nullable=False)
    status = Column(String(20), nullable=False, default="created")
    
    # 评测配置信息
    dimensions = Column(JSONB, nullable=False, default=["accuracy"])
    weights = Column(JSONB, default={"accuracy": 1.0})
    model_config_test = Column(JSONB)
    prompt_template = Column(Text)
    version = Column(String(50))
    
    # 进度和结果
    total_questions = Column(Integer, default=0)
    processed_questions = Column(Integer, default=0)
    success_questions = Column(Integer, default=0)
    failed_questions = Column(Integer, default=0)
    batch_settings = Column(JSONB, default={"batch_size": 10, "timeout_seconds": 300})
    
    # 评测结果汇总
    results_summary = Column(JSONB)
    
    # 时间信息
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    
    # 创建者
    created_by = Column(StringUUID, ForeignKey("users.id", ondelete="SET NULL"))
    
    # 关系
    items = relationship("AccuracyTestItem", back_populates="evaluation", cascade="all, delete-orphan")
    assignments = relationship("AccuracyHumanAssignment", back_populates="evaluation", cascade="all, delete-orphan")
    project = relationship("Project", back_populates="accuracy_tests")
    dataset = relationship("Dataset")
    

class AccuracyTestItem(Base):
    """评测项目表"""
    __tablename__ = "accuracy_test_items"
    
    id = Column(StringUUID, primary_key=True, default=uuid.uuid4)
    evaluation_id = Column(StringUUID, ForeignKey("accuracy_test.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(StringUUID, ForeignKey("questions.id"), nullable=False)
    rag_answer_id = Column(StringUUID, ForeignKey("rag_answers.id"), nullable=False)
    
    # 状态信息
    status = Column(String(20), default="pending")
    
    # 最终评分信息
    final_score = Column(Numeric)
    final_dimension_scores = Column(JSONB)
    final_evaluation_reason = Column(Text)
    final_evaluation_type = Column(String(20))
    
    # AI评测结果
    ai_score = Column(Numeric)
    ai_dimension_scores = Column(JSONB)
    ai_evaluation_reason = Column(Text)
    ai_evaluation_time = Column(DateTime(timezone=True))
    ai_raw_response = Column(JSONB)
    
    # 人工评测结果
    human_score = Column(Numeric)
    human_dimension_scores = Column(JSONB)
    human_evaluation_reason = Column(Text)
    human_evaluator_id = Column(String(100))
    human_evaluation_time = Column(DateTime(timezone=True))
    
    # 其他元数据
    sequence_number = Column(Integer)
    item_metadata = Column(JSONB)
    
    # 关系
    evaluation = relationship("AccuracyTest", back_populates="items")
    question = relationship("Question")
    rag_answer = relationship("RagAnswer")
    
    __table_args__ = (
        UniqueConstraint('evaluation_id', 'question_id', name='unique_evaluation_question'),
    )


class AccuracyHumanAssignment(Base):
    """人工评测分配表"""
    __tablename__ = "accuracy_human_assignments"
    
    id = Column(StringUUID, primary_key=True, default=uuid.uuid4)
    evaluation_id = Column(StringUUID, ForeignKey("accuracy_test.id", ondelete="CASCADE"), nullable=False)
    access_code = Column(String(20), nullable=False, unique=True)
    evaluator_name = Column(String(100))
    evaluator_email = Column(String(255))
    
    # 分配信息
    item_ids = Column(JSONB, nullable=False)
    total_items = Column(Integer, nullable=False)
    completed_items = Column(Integer, default=0)
    
    # 状态信息
    status = Column(String(20), default="assigned")
    
    # 访问控制
    is_active = Column(Boolean, default=True)
    expiration_date = Column(DateTime(timezone=True))
    
    # 时间信息
    assigned_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    last_activity_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    
    # 创建者
    created_by = Column(StringUUID, ForeignKey("users.id", ondelete="SET NULL"))
    
    # 关系
    evaluation = relationship("AccuracyTest", back_populates="assignments") 