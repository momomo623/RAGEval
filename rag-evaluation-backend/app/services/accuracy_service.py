from typing import List, Dict, Any, Optional, Union, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, desc, asc, case
import uuid
import json
import random
import string
from datetime import datetime, timedelta
import logging
from fastapi import HTTPException

from app.models.accuracy import AccuracyTest, AccuracyTestItem, AccuracyHumanAssignment
from app.models.question import Question
from app.models.rag_answer import RagAnswer
from app.schemas.accuracy import (
    AccuracyTestCreate, 
    AccuracyTestDetail,
    AccuracyTestProgress,
    AccuracyTestItemCreate,
    HumanAssignmentCreate
)

logger = logging.getLogger(__name__)

class AccuracyService:
    def __init__(self, db: Session):
        self.db = db
    
    def create_test(self, data: AccuracyTestCreate, user_id: Optional[uuid.UUID] = None) -> AccuracyTest:
        """创建新的精度评测任务"""
        # 创建评测对象
        test = AccuracyTest(
            project_id=data.project_id,
            dataset_id=data.dataset_id,
            name=data.name,
            description=data.description,
            evaluation_type=data.evaluation_type,
            scoring_method=data.scoring_method,
            dimensions=data.dimensions,
            weights=data.weights or {dim: 1.0 for dim in data.dimensions},
            prompt_template=data.prompt_template,
            version=data.version,
            model_config_test=data.model_config_test,
            batch_settings=data.batch_settings or {"batch_size": 10, "timeout_seconds": 300},
            status="created",
            created_by=user_id
        )
        
        self.db.add(test)
        self.db.commit()
        self.db.refresh(test)
        
        # 查询数据集的问题
        questions = self.db.query(Question).filter(
            Question.dataset_id == data.dataset_id
        ).all()
        
        # 创建评测项目
        test_items = []
        processed_question_ids = set()
        
        for idx, question in enumerate(questions):
            if str(question.id) in processed_question_ids:
                continue
            
            # 查找指定版本的RAG回答
            query = self.db.query(RagAnswer).filter(
                RagAnswer.question_id == question.id
            )
            
            # 如果指定了版本，则按版本筛选
            if data.version:
                query = query.filter(RagAnswer.version == data.version)
            
            # 获取最新的匹配回答
            rag_answer = query.order_by(desc(RagAnswer.created_at)).first()
            
            if not rag_answer:
                continue
            
            # 创建评测项
            test_item = AccuracyTestItem(
                evaluation_id=test.id,
                question_id=question.id,
                rag_answer_id=rag_answer.id,
                sequence_number=len(test_items) + 1,
                status="pending"
            )
            test_items.append(test_item)
            processed_question_ids.add(str(question.id))
        
        # 更新测试的问题总数
        test.total_questions = len(test_items)
        
        # 批量添加评测项目
        if test_items:
            self.db.bulk_save_objects(test_items)
        
        self.db.commit()
        self.db.refresh(test)
        
        return test
    
    def get_tests_by_project(self, project_id: uuid.UUID) -> List[AccuracyTest]:
        """获取项目的所有精度评测"""
        return self.db.query(AccuracyTest).filter(
            AccuracyTest.project_id == project_id
        ).order_by(desc(AccuracyTest.created_at)).all()
    
    def get_test_detail(self, test_id: uuid.UUID) -> Optional[AccuracyTest]:
        """获取精度评测详情"""
        return self.db.query(AccuracyTest).filter(
            AccuracyTest.id == test_id
        ).first()
    
    def get_test_items(
        self,
        test_id: uuid.UUID,
        limit: int = 50,
        offset: int = 0,
        status: Optional[str] = None,
        score: Optional[float] = None
    ) -> Tuple[List[Dict[str, Any]], int]:
        """获取评测项目列表"""
        query = self.db.query(
            AccuracyTestItem,
            Question.question_text.label("question_content"),
            Question.standard_answer.label("reference_answer"),
            RagAnswer.answer.label("rag_answer_content")
        ).join(
            Question, AccuracyTestItem.question_id == Question.id
        ).join(
            RagAnswer, AccuracyTestItem.rag_answer_id == RagAnswer.id
        ).filter(
            AccuracyTestItem.evaluation_id == test_id
        )
        
        # 应用筛选条件
        if status:
            query = query.filter(AccuracyTestItem.status == status)
            
        if score is not None:
            query = query.filter(AccuracyTestItem.final_score == score)
        
        # 获取总数
        total_count = query.count()
        
        # 分页查询
        items = query.order_by(
            asc(AccuracyTestItem.sequence_number)
        ).offset(offset).limit(limit).all()
        
        # 转换为字典列表
        result = []
        for item, question_content, reference_answer, rag_answer_content in items:
            item_dict = {
                "id": item.id,
                "evaluation_id": item.evaluation_id,
                "question_id": item.question_id,
                "rag_answer_id": item.rag_answer_id,
                "status": item.status,
                "final_score": item.final_score,
                "final_dimension_scores": item.final_dimension_scores,
                "final_evaluation_reason": item.final_evaluation_reason,
                "final_evaluation_type": item.final_evaluation_type,
                "ai_score": item.ai_score,
                "ai_dimension_scores": item.ai_dimension_scores,
                "ai_evaluation_reason": item.ai_evaluation_reason,
                "ai_evaluation_time": item.ai_evaluation_time,
                "human_score": item.human_score,
                "human_dimension_scores": item.human_dimension_scores,
                "human_evaluation_reason": item.human_evaluation_reason,
                "human_evaluator_id": item.human_evaluator_id,
                "human_evaluation_time": item.human_evaluation_time,
                "sequence_number": item.sequence_number,
                "question_content": question_content,
                "reference_answer": reference_answer,
                "rag_answer_content": rag_answer_content
            }
            result.append(item_dict)
        
        return result, total_count
    
    def start_test(self, test_id: uuid.UUID) -> Optional[AccuracyTest]:
        """开始精度评测"""
        test = self.db.query(AccuracyTest).filter(
            AccuracyTest.id == test_id
        ).first()
        
        if not test:
            return None
        
        if test.status not in ["created", "failed"]:
            raise ValueError(f"测试状态为{test.status}，无法启动")
        
        test.status = "running"
        test.started_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(test)
        
        return test
    
    def update_test_progress(
        self, 
        test_id: uuid.UUID, 
        processed: int, 
        success: int, 
        failed: int
    ) -> Optional[AccuracyTest]:
        """更新测试进度"""
        test = self.db.query(AccuracyTest).filter(
            AccuracyTest.id == test_id
        ).first()
        
        if not test:
            return None
        
        test.processed_questions = processed
        test.success_questions = success
        test.failed_questions = failed
        
        self.db.commit()
        self.db.refresh(test)
        
        return test
    
    def complete_test(self, test_id: uuid.UUID) -> Optional[AccuracyTest]:
        """完成测试并更新结果"""
        test = self.db.query(AccuracyTest).filter(
            AccuracyTest.id == test_id
        ).first()
        
        if not test:
            return None
        
        if test.status != "running":
            raise ValueError(f"测试状态为{test.status}，无法标记为完成")
        
        # 计算评测结果汇总
        results_summary = self._calculate_test_results(test_id)
        
        test.status = "completed"
        test.completed_at = datetime.utcnow()
        test.results_summary = results_summary
        
        self.db.commit()
        self.db.refresh(test)
        
        return test
    
    def fail_test(self, test_id: uuid.UUID, error_details: Dict[str, Any]) -> Optional[AccuracyTest]:
        """将测试标记为失败"""
        test = self.db.query(AccuracyTest).filter(
            AccuracyTest.id == test_id
        ).first()
        
        if not test:
            return None
        
        test.status = "failed"
        test.results_summary = {
            "error": True,
            "error_message": error_details.get("message", "未知错误"),
            "error_details": error_details
        }
        
        self.db.commit()
        self.db.refresh(test)
        
        return test
    
    def submit_test_item_results(self, test_id: uuid.UUID, items: List[Dict[str, Any]]) -> bool:
        """批量提交评测项结果"""
        test = self.db.query(AccuracyTest).filter(
            AccuracyTest.id == test_id
        ).first()
        
        if not test:
            raise ValueError("测试不存在")
        
        if test.status != "running":
            raise ValueError(f"测试状态为{test.status}，无法提交结果")

        # 批量更新评测项
        for item_data in items:
            question_id = item_data.get("id")
            if not question_id:
                continue
            
            item = self.db.query(AccuracyTestItem).filter(
                AccuracyTestItem.question_id == question_id,
                AccuracyTestItem.evaluation_id == test_id
            ).first()
            
            if not item:
                logger.warning(f"未找到评测项: {question_id}")
                continue
            
            # 更新AI评测结果
            if "ai_score" in item_data:
                item.ai_score = item_data.get("ai_score")
                item.ai_dimension_scores = item_data.get("ai_dimension_scores")
                item.ai_evaluation_reason = item_data.get("ai_evaluation_reason")
                item.ai_raw_response = item_data.get("ai_raw_response")
                item.ai_evaluation_time = datetime.utcnow()
                
                # 如果是AI评测，或者尚未有人工评测，则将AI结果设为最终结果
                if test.evaluation_type == "ai" or not item.human_score:
                    item.final_score = item.ai_score
                    item.final_dimension_scores = item.ai_dimension_scores
                    item.final_evaluation_reason = item.ai_evaluation_reason
                    item.final_evaluation_type = "ai"
                    logger.info(f"设置AI评测最终分数: item_id={item.id}, score={item.final_score}")
            
            # 更新人工评测结果
            if "human_score" in item_data:
                item.human_score = item_data.get("human_score")
                item.human_dimension_scores = item_data.get("human_dimension_scores")
                item.human_evaluation_reason = item_data.get("human_evaluation_reason")
                item.human_evaluator_id = item_data.get("human_evaluator_id")
                item.human_evaluation_time = datetime.utcnow()
                
                # 如果是人工评测，或者混合评测且有人工结果，则将人工结果设为最终结果
                if test.evaluation_type in ["manual", "hybrid"]:
                    item.final_score = item.human_score
                    item.final_dimension_scores = item.human_dimension_scores
                    item.final_evaluation_reason = item.human_evaluation_reason
                    item.final_evaluation_type = "human"
                    logger.info(f"设置人工评测最终分数: item_id={item.id}, score={item.final_score}")
            
            # 更新状态
            if "status" in item_data:
                item.status = item_data.get("status")
            else:
                if item.status == "pending":
                    item.status = "ai_completed" if test.evaluation_type == "ai" else "human_completed"
                elif item.status in ["ai_completed", "human_completed"]:
                    item.status = "both_completed"
        
        self.db.commit()
        
        # 更新测试进度和结果
        self._update_test_status(test_id)
        
        return True
    
    def _update_test_status(self, test_id: uuid.UUID) -> None:
        """更新测试状态和进度"""
        # 获取测试项统计
        stats = self.db.query(
            func.count(AccuracyTestItem.id).label("total"),
            func.sum(
                case(
                    (AccuracyTestItem.status.in_(["ai_completed", "human_completed", "both_completed"]), 1),
                    else_=0
                )
            ).label("processed"),
            func.sum(
                case(
                    (AccuracyTestItem.status == "failed", 1),
                    else_=0
                )
            ).label("failed")
        ).filter(
            AccuracyTestItem.evaluation_id == test_id
        ).first()
        
        test = self.db.query(AccuracyTest).filter(
            AccuracyTest.id == test_id
        ).first()
        
        if test and stats:
            test.processed_questions = stats.processed or 0
            test.failed_questions = stats.failed or 0
            test.success_questions = (stats.processed or 0) - (stats.failed or 0)
            
            # 如果所有问题都已处理，自动完成测试
            if test.status == "running" and test.processed_questions + test.failed_questions >= test.total_questions:
                test.status = "completed"
                test.completed_at = datetime.utcnow()
                test.results_summary = self._calculate_test_results(test_id)
            
            self.db.commit()
    
    def _calculate_test_results(self, test_id: uuid.UUID) -> Dict[str, Any]:
        """计算测试结果汇总"""
        test = self.db.query(AccuracyTest).filter(
            AccuracyTest.id == test_id
        ).first()
        
        if not test:
            logger.error(f"测试不存在: test_id={test_id}")
            return {}
        
        # 获取所有完成的评测项
        items = self.db.query(AccuracyTestItem).filter(
            AccuracyTestItem.evaluation_id == test_id,
            AccuracyTestItem.status.in_(["ai_completed", "human_completed", "both_completed"])
        ).all()
        
        logger.info(f"计算测试结果: test_id={test_id}, 评测项数量={len(items)}")
        
        # 计算总分和平均分
        total_score = 0
        dimension_totals = {}
        dimension_counts = {}
        
        for item in items:
            if item.final_score is not None:
                try:
                    total_score += float(item.final_score)
                    logger.info(f"评测项分数: id={item.id}, score={item.final_score}, dimensions={item.final_dimension_scores}")
                    
                    # 计算各维度分数
                    if item.final_dimension_scores:
                        for dim, score in item.final_dimension_scores.items():
                            if dim not in dimension_totals:
                                dimension_totals[dim] = 0
                                dimension_counts[dim] = 0
                            
                            # 确保分数是有效的数值
                            if score is not None:
                                try:
                                    score_float = float(score)
                                    dimension_totals[dim] += score_float
                                    dimension_counts[dim] += 1
                                except (TypeError, ValueError) as e:
                                    logger.warning(f"无效的维度分数: dim={dim}, score={score}, error={str(e)}")
                                    continue
                except (TypeError, ValueError) as e:
                    logger.warning(f"无效的最终分数: item_id={item.id}, score={item.final_score}, error={str(e)}")
                    continue
        
        # 计算各维度平均分
        dimension_scores = {}
        for dim in dimension_totals:
            if dimension_counts[dim] > 0:
                try:
                    dimension_scores[dim] = round(dimension_totals[dim] / dimension_counts[dim], 2)
                except Exception as e:
                    logger.error(f"计算维度平均分失败: dim={dim}, error={str(e)}")
                    dimension_scores[dim] = 0
        
        # 计算加权总分
        weights = test.weights or {dim: 1.0 for dim in test.dimensions}
        weighted_score = 0
        weight_sum = 0
        
        for dim, score in dimension_scores.items():
            if dim in weights:
                try:
                    weight = float(weights[dim])
                    weighted_score += score * weight
                    weight_sum += weight
                except (TypeError, ValueError) as e:
                    logger.warning(f"无效的权重: dim={dim}, weight={weights[dim]}, error={str(e)}")
                    continue
        
        try:
            overall_score = round(weighted_score / weight_sum, 2) if weight_sum > 0 else 0
        except Exception as e:
            logger.error(f"计算总分失败: error={str(e)}")
            overall_score = 0
        
        logger.info(f"测试结果汇总: test_id={test_id}, overall_score={overall_score}, dimension_scores={dimension_scores}")
        
        # 构建结果汇总
        results_summary = {
            "overall_score": overall_score,
            "dimension_scores": dimension_scores,
            "score_distribution": self._calculate_score_distribution(items),
            "evaluation_types": self._calculate_evaluation_types(items),
            "total_evaluated": len(items),
            "evaluation_type": test.evaluation_type,
            "scoring_method": test.scoring_method
        }
        
        return results_summary
    
    def create_human_assignment(
        self, 
        data: HumanAssignmentCreate, 
        user_id: Optional[uuid.UUID] = None
    ) -> AccuracyHumanAssignment:
        """创建人工评测任务"""
        # 验证评测存在且类型正确
        test = self.db.query(AccuracyTest).filter(
            AccuracyTest.id == data.evaluation_id
        ).first()
        
        if not test:
            raise ValueError("评测不存在")
        
        if test.evaluation_type not in ["manual", "hybrid"]:
            raise ValueError(f"评测类型为{test.evaluation_type}，不支持人工评测")
        
        # 获取待评测的项目
        items = self.db.query(AccuracyTestItem).filter(
            AccuracyTestItem.evaluation_id == data.evaluation_id,
            AccuracyTestItem.status.in_(["pending", "ai_completed"])
        ).limit(data.item_count).all()
        
        if not items:
            raise ValueError("没有可分配的评测项")
            
        # 生成随机访问码
        access_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
        
        # 设置过期时间
        expiration_date = None
        if data.expiration_days:
            expiration_date = datetime.utcnow() + timedelta(days=data.expiration_days)
        
        # 创建分配
        assignment = AccuracyHumanAssignment(
            evaluation_id=data.evaluation_id,
            access_code=access_code,
            evaluator_name=data.evaluator_name,
            evaluator_email=data.evaluator_email,
            item_ids=[str(item.id) for item in items],
            total_items=len(items),
            completed_items=0,
            status="assigned",
            is_active=True,
            expiration_date=expiration_date,
            created_by=user_id
        )
        
        self.db.add(assignment)
        self.db.commit()
        self.db.refresh(assignment)
        
        return assignment
    
    def get_human_assignments(self, test_id: uuid.UUID) -> List[AccuracyHumanAssignment]:
        """获取评测的人工评测任务列表"""
        return self.db.query(AccuracyHumanAssignment).filter(
            AccuracyHumanAssignment.evaluation_id == test_id
        ).order_by(desc(AccuracyHumanAssignment.assigned_at)).all()

    def check_running_tests(self, project_id: uuid.UUID) -> List[AccuracyTest]:
        """检查项目中的运行中测试"""
        return self.db.query(AccuracyTest).filter(
            AccuracyTest.project_id == project_id,
            AccuracyTest.status == "running"
        ).all()

    def mark_test_interrupted(self, test_id: uuid.UUID, reason: str) -> Optional[AccuracyTest]:
        """标记测试为中断状态"""
        test = self.db.query(AccuracyTest).filter(
            AccuracyTest.id == test_id
        ).first()
        
        if test and test.status == "running":
            test.status = "interrupted"
            test.completed_at = datetime.utcnow()
            self.db.commit()
            return test
        return None

    def reset_test_items(self, test_id: uuid.UUID) -> bool:
        """重置测试项状态"""
        try:
            # 删除已完成的评测项
            self.db.query(AccuracyTestItem).filter(
                AccuracyTestItem.evaluation_id == test_id,
                AccuracyTestItem.status.in_(["ai_completed", "human_completed", "both_completed"])
            ).delete()
            
            # 重置测试状态
            test = self.db.query(AccuracyTest).filter(
                AccuracyTest.id == test_id
            ).first()
            
            if test:
                test.status = "created"
                test.processed_questions = 0
                test.success_questions = 0
                test.failed_questions = 0
                test.results_summary = None
                test.started_at = None
                test.completed_at = None
                
            self.db.commit()
            return True
        except Exception as e:
            self.db.rollback()
            logger.error(f"重置测试项失败: {str(e)}")
            return False

    def update_test_status(self, db: Session, test_id: str, status: str) -> Optional[AccuracyTest]:
        """更新测试状态"""
        test = self.get_test_detail(test_id)
        if not test:
            raise HTTPException(status_code=404, detail="测试不存在")
        
        test.status = status
        db.commit()
        db.refresh(test)
        return test

    def _calculate_score_distribution(self, items: List[AccuracyTestItem]) -> Dict[str, int]:
        """计算分数分布"""
        distribution = {
            "5": 0, "4": 0, "3": 0, "2": 0, "1": 0, "0": 0
        }
        
        for item in items:
            if item.final_score is not None:
                score_key = str(int(round(float(item.final_score))))
                if score_key in distribution:
                    distribution[score_key] += 1
        
        return distribution

    def _calculate_evaluation_types(self, items: List[AccuracyTestItem]) -> Dict[str, int]:
        """计算评测类型分布"""
        type_counts = {
            "ai": 0,
            "human": 0
        }
        
        for item in items:
            if item.final_evaluation_type:
                type_counts[item.final_evaluation_type] += 1
        
        return type_counts