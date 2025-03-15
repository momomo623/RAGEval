from typing import List, Dict, Any, Optional, Union, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
import uuid
import json
import asyncio

from app.models.evaluation import Evaluation
from app.models.project import Project, EvaluationDimension
from app.models.question import Question
from app.models.rag_answer import RagAnswer
from app.schemas.evaluation import (
    EvaluationCreate, 
    EvaluationUpdate, 
    AutoEvaluationRequest,
    EvaluationResult,
    EvaluationSummary,
    ProjectEvaluationSummary
)
from app.services.auto_evaluator import AutoEvaluator

class EvaluationService:
    """评测服务"""
    
    def __init__(self, db: Session):
        self.db = db
    
    async def evaluate_auto(
        self, 
        request: AutoEvaluationRequest,
        model: str = "gpt-4",
        api_key: Optional[str] = None
    ) -> List[EvaluationResult]:
        """自动评测单个问题的RAG回答"""
        auto_evaluator = AutoEvaluator(api_key=api_key, model=model)
        results = await auto_evaluator.evaluate_batch([request])
        
        # 保存评测结果到数据库
        for result in results:
            db_obj = Evaluation(
                question_id=result.question_id,
                rag_answer_id=result.rag_answer_id,
                dimension_id=result.dimension_id,
                score=result.score,
                explanation=result.explanation,
                evaluation_method=result.evaluation_method,
                model_name=result.model_name,
                raw_model_response=result.raw_model_response
            )
            self.db.add(db_obj)
        
        self.db.commit()
        return results
    
    async def evaluate_batch_auto(
        self,
        project_id: str,
        model: str = "gpt-4",
        api_key: Optional[str] = None,
        dimension_ids: List[str] = None,
        question_ids: List[str] = None,
        include_evaluated: bool = False
    ) -> Dict[str, Any]:
        """批量自动评测"""
        # 获取项目
        project = self.db.query(Project).filter(Project.id == project_id).first()
        if not project:
            return {
                "success": False,
                "error": "项目未找到",
                "results": []
            }
        
        # 获取评测维度
        if dimension_ids:
            dimensions = self.db.query(EvaluationDimension).filter(
                EvaluationDimension.project_id == project_id,
                EvaluationDimension.id.in_(dimension_ids)
            ).all()
        else:
            dimensions = self.db.query(EvaluationDimension).filter(
                EvaluationDimension.project_id == project_id
            ).all()
        
        if not dimensions:
            return {
                "success": False,
                "error": "未找到有效的评测维度",
                "results": []
            }
        
        # 获取问题和回答
        query = self.db.query(Question, RagAnswer).join(
            RagAnswer, Question.id == RagAnswer.question_id
        ).filter(
            Question.project_id == project_id
        )
        
        if question_ids:
            query = query.filter(Question.id.in_(question_ids))
        
        # 排除已评测的问题-回答-维度组合
        if not include_evaluated:
            # 获取已评测的组合
            evaluated_combos = self.db.query(
                Evaluation.question_id, Evaluation.rag_answer_id, Evaluation.dimension_id
            ).all()
            
            # 将其转为集合以便快速查找
            evaluated_set = {(str(q), str(a), str(d)) for q, a, d in evaluated_combos}
            
            # 过滤查询结果
            question_answer_pairs = query.all()
            filtered_pairs = []
            
            for question, answer in question_answer_pairs:
                include_pair = False
                for dimension in dimensions:
                    # 如果这个组合未评测，则包含
                    if (str(question.id), str(answer.id), str(dimension.id)) not in evaluated_set:
                        include_pair = True
                        break
                
                if include_pair:
                    filtered_pairs.append((question, answer))
            
            question_answer_pairs = filtered_pairs
        else:
            question_answer_pairs = query.all()
        
        if not question_answer_pairs:
            return {
                "success": False,
                "error": "未找到需要评测的问题和回答",
                "results": []
            }
        
        # 准备评测请求
        evaluation_requests = []
        for question, answer in question_answer_pairs:
            # 为每个维度创建一个请求
            request = AutoEvaluationRequest(
                question_id=str(question.id),
                question=question.question_text,
                standard_answer=question.standard_answer,
                rag_answer=answer.answer_text,
                rag_answer_id=str(answer.id),
                dimensions=[{
                    "id": str(dim.id),
                    "name": dim.name,
                    "description": dim.description or dim.display_name
                } for dim in dimensions]
            )
            evaluation_requests.append(request)
        
        # 执行自动评测
        auto_evaluator = AutoEvaluator(api_key=api_key, model=model)
        all_results = await auto_evaluator.evaluate_batch(evaluation_requests)
        
        # 保存评测结果到数据库
        for result in all_results:
            db_obj = Evaluation(
                question_id=result.question_id,
                rag_answer_id=result.rag_answer_id,
                dimension_id=result.dimension_id,
                score=result.score,
                explanation=result.explanation,
                evaluation_method=result.evaluation_method,
                model_name=result.model_name,
                raw_model_response=result.raw_model_response
            )
            self.db.add(db_obj)
        
        self.db.commit()
        
        # 统计结果
        success_count = len([r for r in all_results if r.success])
        failed_count = len(all_results) - success_count
        
        return {
            "success": True,
            "total": len(all_results),
            "success_count": success_count,
            "failed_count": failed_count,
            "results": [result.dict() for result in all_results]
        }
    
    def create_manual_evaluation(
        self,
        obj_in: EvaluationCreate,
        evaluator_id: str
    ) -> Evaluation:
        """创建人工评测结果"""
        db_obj = Evaluation(
            question_id=obj_in.question_id,
            rag_answer_id=obj_in.rag_answer_id,
            dimension_id=obj_in.dimension_id,
            score=obj_in.score,
            explanation=obj_in.explanation,
            evaluation_method="manual",
            evaluator_id=evaluator_id
        )
        self.db.add(db_obj)
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj
    
    def update_evaluation(
        self,
        evaluation_id: str,
        obj_in: EvaluationUpdate
    ) -> Optional[Evaluation]:
        """更新评测结果"""
        db_obj = self.db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()
        if not db_obj:
            return None
        
        update_data = obj_in.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        
        self.db.add(db_obj)
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj
    
    def get_evaluation(self, evaluation_id: str) -> Optional[Evaluation]:
        """获取单个评测结果"""
        return self.db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()
    
    def get_evaluations_by_question(
        self,
        question_id: str,
        dimension_id: Optional[str] = None
    ) -> List[Evaluation]:
        """获取问题的评测结果"""
        query = self.db.query(Evaluation).filter(Evaluation.question_id == question_id)
        if dimension_id:
            query = query.filter(Evaluation.dimension_id == dimension_id)
        return query.all()
    
    def get_evaluations_by_rag_answer(
        self,
        rag_answer_id: str,
        dimension_id: Optional[str] = None
    ) -> List[Evaluation]:
        """获取RAG回答的评测结果"""
        query = self.db.query(Evaluation).filter(Evaluation.rag_answer_id == rag_answer_id)
        if dimension_id:
            query = query.filter(Evaluation.dimension_id == dimension_id)
        return query.all()
    
    def get_project_evaluation_summary(
        self,
        project_id: str
    ) -> Optional[ProjectEvaluationSummary]:
        """获取项目评测摘要"""
        # 获取项目
        project = self.db.query(Project).filter(Project.id == project_id).first()
        if not project:
            return None
        
        # 获取项目的所有问题ID
        question_ids = [q[0] for q in self.db.query(Question.id).filter(
            Question.project_id == project_id
        ).all()]
        
        if not question_ids:
            return ProjectEvaluationSummary(
                project_id=project_id,
                project_name=project.name,
                total_score=0.0,
                dimension_scores=[],
                question_count=0,
                evaluated_count=0,
                evaluation_progress=0.0
            )
        
        # 获取项目的评测维度
        dimensions = self.db.query(EvaluationDimension).filter(
            EvaluationDimension.project_id == project_id
        ).all()
        
        # 计算每个维度的评测摘要
        dimension_summaries = []
        total_weighted_score = 0.0
        total_weight = 0.0
        
        for dim in dimensions:
            # 获取该维度的所有评测
            evaluations = self.db.query(Evaluation).filter(
                Evaluation.question_id.in_(question_ids),
                Evaluation.dimension_id == dim.id
            ).all()
            
            if not evaluations:
                # 此维度没有评测结果
                continue
            
            scores = [e.score for e in evaluations]
            avg_score = sum(scores) / len(scores) if scores else 0
            
            dim_summary = EvaluationSummary(
                dimension_name=dim.display_name,
                dimension_id=str(dim.id),
                average_score=avg_score,
                max_score=max(scores) if scores else 0,
                min_score=min(scores) if scores else 0,
                count=len(evaluations),
                weight=dim.weight
            )
            
            dimension_summaries.append(dim_summary)
            
            # 计算加权分数
            total_weighted_score += avg_score * dim.weight
            total_weight += dim.weight
        
        # 计算总体分数
        total_score = total_weighted_score / total_weight if total_weight > 0 else 0
        
        # 计算评测进度
        question_count = len(question_ids)
        
        # 获取已评测的问题数量（去重）
        evaluated_question_ids = set()
        for e in self.db.query(Evaluation.question_id).filter(
            Evaluation.question_id.in_(question_ids)
        ).all():
            evaluated_question_ids.add(e[0])
        
        evaluated_count = len(evaluated_question_ids)
        evaluation_progress = evaluated_count / question_count if question_count > 0 else 0
        
        return ProjectEvaluationSummary(
            project_id=project_id,
            project_name=project.name,
            total_score=total_score,
            dimension_scores=dimension_summaries,
            question_count=question_count,
            evaluated_count=evaluated_count,
            evaluation_progress=evaluation_progress
        )
    
    def delete_evaluation(self, evaluation_id: str) -> bool:
        """删除评测结果"""
        db_obj = self.db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()
        if not db_obj:
            return False
        
        self.db.delete(db_obj)
        self.db.commit()
        return True 