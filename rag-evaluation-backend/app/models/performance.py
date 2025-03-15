from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer, Float, Boolean, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid

from app.db.base import Base

class PerformanceTest(Base):
    """性能测试记录"""
    __tablename__ = "performance_tests"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    test_type = Column(String(50), nullable=False)  # latency, throughput, concurrency
    system_under_test = Column(String(100))  # 被测系统名称
    status = Column(String(20), default="created")  # created, running, completed, failed
    config = Column(JSONB)  # 测试配置和结果摘要
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class PerformanceMetric(Base):
    """性能测试指标"""
    __tablename__ = "performance_metrics"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    test_id = Column(UUID(as_uuid=True), ForeignKey("performance_tests.id", ondelete="CASCADE"), nullable=False)
    rag_answer_id = Column(UUID(as_uuid=True), ForeignKey("rag_answers.id", ondelete="SET NULL"))
    
    # 测试参数
    concurrency_level = Column(Integer, default=1)
    batch_size = Column(Integer, default=1)
    
    # 性能指标
    response_time = Column(Float)  # 响应时间（毫秒）
    throughput = Column(Float)  # 吞吐量（每秒请求数）
    success_rate = Column(Float)  # 成功率（百分比）
    
    # 资源使用
    cpu_usage = Column(Float)  # CPU使用率（百分比）
    memory_usage = Column(Float)  # 内存使用（MB）
    
    # 状态
    status = Column(String(20), default="success")  # success, error, timeout
    error_message = Column(Text)
    
    # 额外信息
    performance_metadata = Column(JSONB)  # 将 metadata 重命名为 performance_metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now()) 