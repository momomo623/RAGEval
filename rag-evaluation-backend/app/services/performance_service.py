from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid
import numpy as np
from sqlalchemy.orm import Session

from app.models.performance import PerformanceTest
from app.models.question import Question
from app.models.rag_answer import RagAnswer
from app.schemas.performance import PerformanceTestCreate, PerformanceTestUpdate
from app.schemas.rag_answer import RagAnswerCreate
from app.services import dataset_service, question_service

class PerformanceService:
    def get(self, db: Session, *, id: str) -> Optional[PerformanceTest]:
        """根据ID获取性能测试"""
        return db.query(PerformanceTest).filter(PerformanceTest.id == id).first()
    
    def get_multi(self, db: Session, *, skip: int = 0, limit: int = 100) -> List[PerformanceTest]:
        """获取多个性能测试"""
        return db.query(PerformanceTest).offset(skip).limit(limit).all()
    
    def get_by_project(self, db: Session, *, project_id: str) -> List[PerformanceTest]:
        """获取项目的所有性能测试"""
        # 时间倒序排列    db.query(PerformanceTest).filter(PerformanceTest.project_id == project_id).all()
        return  db.query(PerformanceTest).filter(PerformanceTest.project_id == project_id).order_by(PerformanceTest.created_at.desc()).all()
    
    def update(self, db: Session, *, db_obj: PerformanceTest, obj_in: PerformanceTestUpdate) -> PerformanceTest:
        """更新性能测试"""
        update_data = obj_in.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def create_performance_test(
        self, db: Session, *, obj_in: PerformanceTestCreate
    ) -> PerformanceTest:
        # 如果提供了dataset_id，获取问题总数
        total_questions = 0
        if obj_in.dataset_id:
            questions = question_service.get_questions_by_dataset(
                db=db, dataset_id=obj_in.dataset_id
            )
            total_questions = len(questions)
        
        # 创建性能测试记录
        db_obj = PerformanceTest(
            name=obj_in.name,
            project_id=obj_in.project_id,
            dataset_id=obj_in.dataset_id,
            description=obj_in.description,
            concurrency=obj_in.concurrency,
            version=obj_in.version,
            config=obj_in.config,
            total_questions=total_questions,
            status="created"
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj
    
    def start_performance_test(
        self, db: Session, *, performance_test_id: str
    ) -> PerformanceTest:
        """更新测试状态为运行中"""
        db_obj = db.query(PerformanceTest).filter(PerformanceTest.id == performance_test_id).first()
        if not db_obj:
            return None
        
        db_obj.status = "running"
        db_obj.started_at = datetime.utcnow()
        db.commit()
        db.refresh(db_obj)
        return db_obj
    
    def complete_performance_test(
        self, db: Session, *, performance_test_id: str, calculate_metrics: bool = True
    ) -> PerformanceTest:
        """完成性能测试并计算汇总指标"""
        db_obj = db.query(PerformanceTest).filter(PerformanceTest.id == performance_test_id).first()
        if not db_obj:
            return None
        
        db_obj.status = "completed"
        db_obj.completed_at = datetime.utcnow()
        
        if calculate_metrics:
            # 获取该测试的所有RAG答案
            rag_answers = db.query(RagAnswer).filter(
                RagAnswer.performance_test_id == performance_test_id
            ).all()
            
            # 计算汇总指标
            metrics = self._calculate_summary_metrics(rag_answers, db_obj)
            db_obj.summary_metrics = metrics
            
            # 更新成功和失败的问题数
            db_obj.success_questions = len([a for a in rag_answers if a.total_response_time is not None])
            db_obj.failed_questions = len(rag_answers) - db_obj.success_questions
            db_obj.processed_questions = len(rag_answers)
        
        db.commit()
        db.refresh(db_obj)
        return db_obj
    
    def fail_performance_test(
        self, db: Session, *, performance_test_id: str, error_details: Dict[str, Any] = None
    ) -> PerformanceTest:
        """标记性能测试为失败状态"""
        db_obj = db.query(PerformanceTest).filter(PerformanceTest.id == performance_test_id).first()
        if not db_obj:
            return None
        
        db_obj.status = "failed"
        db_obj.completed_at = datetime.utcnow()
        if error_details:
            db_obj.summary_metrics = {"error_details": error_details}
        
        db.commit()
        db.refresh(db_obj)
        return db_obj
    
    def _calculate_summary_metrics(self, rag_answers: List[RagAnswer], test: PerformanceTest) -> Dict[str, Any]:
        """计算性能指标汇总"""
        if not rag_answers:
            return {}
        
        # 过滤出成功的回答
        successful_answers = [a for a in rag_answers if a.total_response_time is not None]
        if not successful_answers:
            return {"success_rate": 0, "test_duration_seconds": 0}
        
        # 计算测试持续时间
        if test.completed_at and test.started_at:
            # 移除两个时间戳的时区信息，简化计算
            naive_completed = test.completed_at.replace(tzinfo=None)
            naive_started = test.started_at.replace(tzinfo=None)
            test_duration = (naive_completed - naive_started).total_seconds()
        else:
            test_duration = 0
        
        # 提取性能数据
        first_response_times = [a.first_response_time for a in successful_answers if a.first_response_time is not None]
        total_response_times = [a.total_response_time for a in successful_answers if a.total_response_time is not None]
        character_counts = [a.character_count for a in successful_answers if a.character_count is not None]
        
        # 计算分位数函数
        def calculate_percentiles(data):
            if not data:
                return None
            return {
                "avg": float(np.mean(data)),
                "max": float(np.max(data)),
                "min": float(np.min(data)),
                "p50": float(np.percentile(data, 50)),
                "p75": float(np.percentile(data, 75)),
                "p90": float(np.percentile(data, 90)),
                "p95": float(np.percentile(data, 95)),
                "p99": float(np.percentile(data, 99)),
                "samples": len(data)
            }
        
        # 构建汇总指标
        metrics = {
            "response_time": {
                "first_token_time": calculate_percentiles(first_response_times),
                "total_time": calculate_percentiles(total_response_times)
            },
            "throughput": {
                "requests_per_second": len(successful_answers) / test_duration if test_duration > 0 else 0,
                "chars_per_second": sum(character_counts) / test_duration if test_duration > 0 else 0
            },
            "character_stats": {
                "output_chars": calculate_percentiles(character_counts)
            },
            "success_rate": len(successful_answers) / len(rag_answers) if rag_answers else 0,
            "test_duration_seconds": test_duration
        }
        
        return metrics
    
    def get_performance_test_detail(
        self, db: Session, *, performance_test_id: str
    ) -> Dict[str, Any]:
        """获取性能测试详情，包括测试结果"""
        test = db.query(PerformanceTest).filter(PerformanceTest.id == performance_test_id).first()
        if not test:
            return None
        
        # 获取这个测试生成的所有RAG答案
        rag_answers = db.query(RagAnswer).filter(
            RagAnswer.performance_test_id == performance_test_id
        ).order_by(RagAnswer.sequence_number).all()
        
        # 构建详细结果
        return {
            "test": test,
            "rag_answers": rag_answers,
            "total_answers": len(rag_answers)
        }

    def get_qa_pairs(self, db: Session, *, performance_test_id: str, skip: int = 0, limit: int = 50) -> Dict[str, Any]:
        """获取性能测试的问答对列表，返回标准分页格式"""
        # 使用JOIN查询同时获取问题和回答
        query_base = (
            db.query(
                RagAnswer.id,
                RagAnswer.question_id,
                RagAnswer.answer,
                RagAnswer.total_response_time,
                RagAnswer.first_response_time,
                RagAnswer.sequence_number,
                Question.question_text.label("question_content")
            )
            .join(Question, RagAnswer.question_id == Question.id)
            .filter(RagAnswer.performance_test_id == performance_test_id)
            .order_by(RagAnswer.sequence_number)
        )
        
        # 计算总数
        total = query_base.count()
        
        # 获取当前页数据
        results = query_base.offset(skip).limit(limit).all()
        
        # 将查询结果转换为字典列表
        items = []
        for i, row in enumerate(results):
            items.append({
                "id": row.id,
                "question_id": row.question_id,
                "question_content": row.question_content,
                "answer": row.answer,
                "total_response_time": row.total_response_time,
                "first_response_time": row.first_response_time,
                "sequence_number": row.sequence_number if row.sequence_number is not None else i + 1 + skip
            })
        
        # 计算页码相关信息
        page = skip // limit + 1 if limit > 0 else 1
        pages = (total + limit - 1) // limit if total > 0 else 1
        
        # 返回标准分页格式
        return {
            "items": items,
            "total": total,
            "page": page,
            "size": limit,
            "pages": pages
        }

    # def get_performance_tests_by_project(self, db: Session, *, project_id: str) -> List[PerformanceTest]:
    #     """获取项目的所有性能测试记录"""
    #     return self.get_by_project(db=db, project_id=project_id)

performance_service = PerformanceService() 