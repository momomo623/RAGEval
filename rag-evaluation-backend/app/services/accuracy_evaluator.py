from typing import List, Dict, Any, Optional, Union, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, desc
import asyncio
import uuid
import json
import random
import string
from datetime import datetime, timedelta
import logging
import aiohttp
import time

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
from app.services.accuracy_evaluator import AccuracyEvaluator

logger = logging.getLogger(__name__)

class AccuracyService:
    """精度评测服务"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_test(self, data: AccuracyTestCreate, user_id: str) -> AccuracyTest:
        """创建新的精度评测"""
        test = AccuracyTest(
            project_id=data.project_id,
            dataset_id=data.dataset_id,
            name=data.name,
            description=data.description,
            evaluation_type=data.evaluation_type,
            scoring_method=data.scoring_method,
            dimensions=data.dimensions,
            weights=data.weights,
            model_config=data.model_config,
            prompt_template=data.prompt_template,
            version=data.version,
            batch_settings=data.batch_settings,
            created_by=user_id
        )
        
        self.db.add(test)
        self.db.commit()
        self.db.refresh(test)
        
        # 计算问题总数
        question_count = self.db.query(func.count(Question.id)).filter(
            Question.dataset_id == data.dataset_id
        ).scalar()
        
        # 更新问题总数
        test.total_questions = question_count
        self.db.commit()
        
        return test
    
    def get_tests_by_project(self, project_id: str) -> List[AccuracyTest]:
        """获取项目下的所有精度评测"""
        return self.db.query(AccuracyTest).filter(
            AccuracyTest.project_id == project_id
        ).order_by(desc(AccuracyTest.created_at)).all()
    
    def get_test_by_id(self, test_id: str) -> Optional[AccuracyTest]:
        """根据ID获取精度评测"""
        return self.db.query(AccuracyTest).filter(
            AccuracyTest.id == test_id
        ).first()
    
    def get_test_detail(self, test_id: str) -> Optional[AccuracyTestDetail]:
        """获取精度评测详情"""
        test = self.get_test_by_id(test_id)
        if not test:
            return None
            
        # 计算进度
        progress = 0
        if test.total_questions > 0:
            progress = (test.processed_questions / test.total_questions) * 100
        
        # 计算持续时间
        duration_seconds = None
        if test.started_at:
            end_time = test.completed_at or datetime.now()
            duration_seconds = int((end_time - test.started_at).total_seconds())
            
        return AccuracyTestDetail(
            **test.__dict__,
            progress=progress,
            duration_seconds=duration_seconds
        )
    
    def get_test_progress(self, test_id: str) -> AccuracyTestProgress:
        """获取精度评测进度"""
        test = self.get_test_by_id(test_id)
        if not test:
            return AccuracyTestProgress(
                total=0,
                processed=0,
                success=0,
                failed=0,
                progress_percent=0,
                status="unknown"
            )
            
        # 计算进度百分比
        progress_percent = 0
        if test.total_questions > 0:
            progress_percent = (test.processed_questions / test.total_questions) * 100
            
        return AccuracyTestProgress(
            total=test.total_questions,
            processed=test.processed_questions,
            success=test.success_questions,
            failed=test.failed_questions,
            progress_percent=progress_percent,
            status=test.status,
            started_at=test.started_at,
            completed_at=test.completed_at
        )
        
    async def start_test(self, test_id: str, llm_api_key: Optional[str] = None) -> AccuracyTest:
        """启动精度评测"""
        test = self.get_test_by_id(test_id)
        if not test:
            raise ValueError(f"精度评测不存在: {test_id}")
            
        if test.status in ["running", "completed"]:
            raise ValueError(f"评测已在运行中或已完成，状态: {test.status}")
            
        # 更新测试状态为运行中
        test.status = "running"
        test.started_at = datetime.now()
        test.processed_questions = 0
        test.success_questions = 0
        test.failed_questions = 0
        self.db.commit()
        
        # 获取数据集问题和对应RAG回答
        try:
            # 获取问题列表
            questions = self.db.query(Question).filter(
                Question.dataset_id == test.dataset_id
            ).all()
            
            if not questions:
                test.status = "failed"
                test.results_summary = {"error": "数据集中没有问题"}
                self.db.commit()
                return test
                
            # 创建评测项
            await self._create_test_items(test, questions)
            
            # 如果是AI评测或混合评测，启动自动评测
            if test.evaluation_type in ["ai", "hybrid"]:
                # 启动异步任务进行评测
                asyncio.create_task(self._run_ai_evaluation(test_id, llm_api_key))
                
            return test
        except Exception as e:
            logger.error(f"启动评测失败: {str(e)}")
            test.status = "failed"
            test.results_summary = {"error": str(e)}
            self.db.commit()
            raise
    
    async def _create_test_items(self, test: AccuracyTest, questions: List[Question]) -> None:
        """创建评测项目"""
        # 先清除已有的评测项
        self.db.query(AccuracyTestItem).filter(
            AccuracyTestItem.evaluation_id == test.id
        ).delete()
        
        # 对每个问题，创建评测项
        for i, question in enumerate(questions):
            # 查找最新的RAG回答
            rag_answer = self.db.query(RagAnswer).filter(
                RagAnswer.question_id == question.id
            ).order_by(desc(RagAnswer.created_at)).first()
            
            if not rag_answer:
                logger.warning(f"问题 {question.id} 没有RAG回答，跳过")
                continue
                
            # 创建评测项
            item = AccuracyTestItem(
                evaluation_id=test.id,
                question_id=question.id,
                rag_answer_id=rag_answer.id,
                sequence_number=i+1,
                status="pending"
            )
            
            self.db.add(item)
            
        self.db.commit()
        
        # 更新总问题数
        test.total_questions = self.db.query(func.count(AccuracyTestItem.id)).filter(
            AccuracyTestItem.evaluation_id == test.id
        ).scalar()
        self.db.commit()
    
    async def _run_ai_evaluation(self, test_id: str, llm_api_key: Optional[str] = None) -> None:
        """运行AI评测"""
        try:
            # 获取测试详情
            test = self.get_test_by_id(test_id)
            if not test:
                logger.error(f"评测不存在: {test_id}")
                return
                
            # 获取待评测项目
            items = self.db.query(AccuracyTestItem).join(
                Question, AccuracyTestItem.question_id == Question.id
            ).join(
                RagAnswer, AccuracyTestItem.rag_answer_id == RagAnswer.id
            ).filter(
                AccuracyTestItem.evaluation_id == test_id,
                AccuracyTestItem.status == "pending"
            ).with_entities(
                AccuracyTestItem.id,
                AccuracyTestItem.question_id,
                AccuracyTestItem.rag_answer_id,
                Question.question,
                Question.answer,
                RagAnswer.answer.label("rag_answer")
            ).all()
            
            if not items:
                logger.warning(f"评测 {test_id} 没有待评测项目")
                self._complete_test(test_id)
                return
                
            # 批量处理设置
            batch_size = test.batch_settings.get("batch_size", 10)
            
            # 创建评测器
            model_config = test.model_config or {}
            evaluator = AccuracyEvaluator(
                api_key=llm_api_key,
                model=model_config.get("model_name", "gpt-4"),
                base_url=model_config.get("base_url", "https://api.openai.com/v1")
            )
            
            # 分批处理
            for i in range(0, len(items), batch_size):
                batch = items[i:i+batch_size]
                
                # 构建评估请求
                eval_requests = []
                for item in batch:
                    eval_requests.append({
                        "item_id": item.id,
                        "question": item.question,
                        "standard_answer": item.answer,
                        "rag_answer": item.rag_answer,
                        "dimensions": test.dimensions
                    })
                
                # 执行批量评估
                results = await evaluator.evaluate_batch(
                    eval_requests,
                    scoring_method=test.scoring_method,
                    custom_prompt=test.prompt_template
                )
                
                # 更新评测结果
                for result in results:
                    item_id = result["item_id"]
                    success = result["success"]
                    
                    item = self.db.query(AccuracyTestItem).filter(
                        AccuracyTestItem.id == item_id
                    ).first()
                    
                    if not item:
                        continue
                        
                    if success:
                        # 更新AI评测结果
                        item.ai_score = result["overall_score"]
                        item.ai_dimension_scores = {
                            dim: data["score"] for dim, data in result["dimensions"].items()
                        }
                        item.ai_evaluation_reason = result["overall_reason"]
                        item.ai_evaluation_time = datetime.now()
                        item.ai_raw_response = result["raw_response"]
                        
                        # 更新最终评分
                        item.final_score = item.ai_score
                        item.final_dimension_scores = item.ai_dimension_scores
                        item.final_evaluation_reason = item.ai_evaluation_reason
                        item.final_evaluation_type = "ai"
                        
                        # 更新状态
                        if test.evaluation_type == "ai":
                            item.status = "ai_completed"
                        elif test.evaluation_type == "hybrid":
                            item.status = "ai_completed"  # 等待人工评测
                        
                        # 更新测试计数
                        test.success_questions += 1
                    else:
                        # 评测失败
                        item.status = "failed"
                        test.failed_questions += 1
                        
                    # 更新处理数量
                    test.processed_questions += 1
                    
                self.db.commit()
                
                # 休眠一小段时间，避免过快请求
                await asyncio.sleep(1)
            
            # 完成评测
            self._complete_test(test_id)
                
        except Exception as e:
            logger.error(f"AI评测执行失败: {str(e)}")
            test = self.get_test_by_id(test_id)
            if test:
                test.status = "failed"
                test.results_summary = {"error": str(e)}
                self.db.commit()
    
    def _complete_test(self, test_id: str) -> None:
        """完成评测，计算结果汇总"""
        test = self.get_test_by_id(test_id)
        if not test:
            return
            
        # 如果是纯AI评测，或者所有项目都已评测完成，标记为已完成
        if test.evaluation_type == "ai":
            test.status = "completed"
            test.completed_at = datetime.now()
            
            # 计算结果汇总
            self._calculate_results_summary(test)
            
        elif test.evaluation_type == "manual":
            # 检查是否所有人工评测都已完成
            pending_items = self.db.query(func.count(AccuracyTestItem.id)).filter(
                AccuracyTestItem.evaluation_id == test_id,
                AccuracyTestItem.status != "human_completed"
            ).scalar()
            
            if pending_items == 0:
                test.status = "completed"
                test.completed_at = datetime.now()
                self._calculate_results_summary(test)
                
        elif test.evaluation_type == "hybrid":
            # 对于混合评测，AI部分完成后，状态保持为running，等待人工评测
            # 在提交人工评测结果时检查是否所有项目都已评测完成
            pass
            
        self.db.commit()
        
    def _calculate_results_summary(self, test: AccuracyTest) -> None:
        """计算评测结果汇总"""
        # 获取所有评测项
        items = self.db.query(AccuracyTestItem).filter(
            AccuracyTestItem.evaluation_id == test.id,
            AccuracyTestItem.status.in_(["ai_completed", "human_completed", "both_completed"])
        ).all()
        
        if not items:
            test.results_summary = {
                "overall_score": 0,
                "dimension_scores": {},
                "total_items": 0,
                "high_quality_count": 0,
                "medium_quality_count": 0,
                "low_quality_count": 0
            }
            return
            
        # 计算总体评分和各维度评分
        total_score = 0
        dimension_scores = {}
        
        # 统计质量分布
        high_quality_count = 0  # 4-5分
        medium_quality_count = 0  # 2-3分
        low_quality_count = 0  # 0-1分
        
        for item in items:
            if item.final_score is not None:
                total_score += item.final_score
                
                # 质量分布
                if item.final_score >= 4:
                    high_quality_count += 1
                elif item.final_score >= 2:
                    medium_quality_count += 1
                else:
                    low_quality_count += 1
                    
                # 各维度评分
                if item.final_dimension_scores:
                    for dim, score in item.final_dimension_scores.items():
                        if dim not in dimension_scores:
                            dimension_scores[dim] = 0
                        dimension_scores[dim] += score
        
        # 计算平均分
        count = len(items)
        overall_score = total_score / count if count > 0 else 0
        
        # 计算各维度平均分
        for dim in dimension_scores:
            dimension_scores[dim] /= count
            
        # 更新结果汇总
        test.results_summary = {
            "overall_score": overall_score,
            "dimension_scores": dimension_scores,
            "total_items": count,
            "high_quality_count": high_quality_count,
            "medium_quality_count": medium_quality_count,
            "low_quality_count": low_quality_count
        }
        
    def get_test_items(self, test_id: str, page: int = 1, page_size: int = 10) -> Tuple[List[Dict[str, Any]], int]:
        """获取评测项目列表"""
        query = self.db.query(AccuracyTestItem).join(
            Question, AccuracyTestItem.question_id == Question.id
        ).join(
            RagAnswer, AccuracyTestItem.rag_answer_id == RagAnswer.id
        ).filter(
            AccuracyTestItem.evaluation_id == test_id
        )
        
        # 获取总数
        total = query.count()
        
        # 分页
        items = query.order_by(AccuracyTestItem.sequence_number).offset(
            (page - 1) * page_size
        ).limit(page_size).with_entities(
            AccuracyTestItem,
            Question.question.label("question_content"),
            Question.answer.label("standard_answer"),
            RagAnswer.answer.label("rag_answer_content")
        ).all()
        
        # 处理结果
        result = []
        for item, question_content, standard_answer, rag_answer_content in items:
            item_dict = {
                **item.__dict__,
                "question_content": question_content,
                "standard_answer": standard_answer,
                "rag_answer_content": rag_answer_content
            }
            result.append(item_dict)
            
        return result, total
        
    def create_human_assignment(self, data: HumanAssignmentCreate, user_id: str) -> AccuracyHumanAssignment:
        """创建人工评测分配"""
        # 验证评测存在
        test = self.get_test_by_id(data.evaluation_id)
        if not test:
            raise ValueError(f"评测不存在: {data.evaluation_id}")
            
        # 获取待分配的评测项
        items = self.db.query(AccuracyTestItem).filter(
            AccuracyTestItem.evaluation_id == data.evaluation_id,
            AccuracyTestItem.status.in_(["pending", "ai_completed"])
        ).limit(data.item_count).all()
        
        if not items:
            raise ValueError("没有可分配的评测项")
            
        # 生成随机访问码
        access_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
        
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
            created_by=user_id
        )
        
        self.db.add(assignment)
        self.db.commit()
        self.db.refresh(assignment)
        
        return assignment

class AccuracyEvaluator:
    """
    精度评测评估器，负责执行AI评测
    """
    
    def __init__(self, prompt_template: str = None, model_config: Dict[str, Any] = None):
        self.prompt_template = prompt_template
        self.model_config = model_config or {
            "model_name": "gpt-4",
            "temperature": 0.2,
            "max_tokens": 1000,
            "top_p": 1
        }
    
    def build_prompt(
        self,
        question: str,
        reference_answer: str,
        rag_answer: str,
        scoring_method: str,
        dimensions: List[str]
    ) -> str:
        """构建评测提示词"""
        if not self.prompt_template:
            # 默认提示词模板
            self.prompt_template = """你是一个专业的RAG系统回答质量评估专家。请评估以下RAG系统对问题的回答质量，与参考答案比较。

问题：{{question}}

参考答案：{{reference_answer}}

RAG系统回答：{{rag_answer}}

评分方法：{{scoring_method}}

评估维度：{{dimensions}}

请针对每个评估维度进行评分，并给出总体评分和详细的评估理由。评分格式为：
总体评分：[分数]
各维度评分：
- 维度1：[分数]
- 维度2：[分数]
...
评估理由：[你的详细分析]"""
        
        # 替换提示词模板中的占位符
        prompt = self.prompt_template
        prompt = prompt.replace('{{question}}', question)
        prompt = prompt.replace('{{reference_answer}}', reference_answer)
        prompt = prompt.replace('{{rag_answer}}', rag_answer)
        
        # 添加评分方法说明
        scoring_instructions = ""
        if scoring_method == "binary":
            scoring_instructions = "使用二元评分法：正确(1分)或错误(0分)"
        elif scoring_method == "three_scale":
            scoring_instructions = "使用三分量表评分法：错误(0分)、部分正确(1分)或完全正确(2分)"
        elif scoring_method == "five_scale":
            scoring_instructions = "使用五分量表评分法：从1分(完全不正确)到5分(完全正确)"
        
        prompt = prompt.replace('{{scoring_method}}', scoring_instructions)
        
        # 添加评测维度说明
        dimensions_text = "、".join(dimensions)
        prompt = prompt.replace('{{dimensions}}', dimensions_text)
        
        return prompt
    
    async def evaluate_item(
        self,
        question: str,
        reference_answer: str,
        rag_answer: str,
        scoring_method: str,
        dimensions: List[str]
    ) -> Dict[str, Any]:
        """评测单个项目"""
        # 构建提示词
        prompt = self.build_prompt(
            question,
            reference_answer,
            rag_answer,
            scoring_method,
            dimensions
        )
        
        # 在实际项目中，这里应调用LLM API进行评测，此处用模拟结果
        # 注意：实际项目中应该使用OpenAI客户端或其他LLM API
        
        # 模拟结果 - 实际项目中应替换为真实API调用
        evaluation_result = {
            "score": 4.5,  # 假设分数
            "dimension_scores": {dim: 4.0 for dim in dimensions},  # 假设维度分数
            "evaluation_reason": "回答基本符合要求，但有一些细节不够准确...",  # 假设评测理由
            "raw_response": {"choices": [{"message": {"content": "评测内容..."}}]},  # 假设原始响应
        }
        
        return evaluation_result
    
    async def evaluate_batch(
        self,
        items: List[Dict[str, Any]],
        scoring_method: str,
        dimensions: List[str],
        batch_size: int = 5,
        concurrency: int = 3
    ) -> List[Dict[str, Any]]:
        """批量评测多个项目"""
        results = []
        
        # 将项目分成批次
        batches = [items[i:i + batch_size] for i in range(0, len(items), batch_size)]
        
        for batch in batches:
            # 并发评测批次中的项目
            tasks = []
            for item in batch:
                task = asyncio.create_task(self.evaluate_item(
                    question=item['question_content'],
                    reference_answer=item['reference_answer'],
                    rag_answer=item['rag_answer_content'],
                    scoring_method=scoring_method,
                    dimensions=dimensions
                ))
                tasks.append((item, task))
            
            # 等待批次完成
            for item, task in tasks:
                try:
                    result = await task
                    results.append({
                        "id": item['id'],
                        "ai_score": result['score'],
                        "ai_dimension_scores": result['dimension_scores'],
                        "ai_evaluation_reason": result['evaluation_reason'],
                        "ai_raw_response": result['raw_response'],
                        "status": "ai_completed"
                    })
                except Exception as e:
                    logger.error(f"评测项 {item['id']} 失败: {str(e)}")
                    results.append({
                        "id": item['id'],
                        "status": "failed",
                        "error_message": str(e)
                    })
            
            # 避免API限流，批次之间添加间隔
            await asyncio.sleep(1)
        
        return results