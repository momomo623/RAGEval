import asyncio
import httpx
import time
import json
import uuid
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session

from app.models.rag_answer import RagAnswer, ApiConfig
from app.models.question import Question
from app.schemas.rag_answer import RagAnswerCreate, ApiRequestConfig

class RagService:
    """RAG系统回答收集服务"""
    
    def __init__(self, db: Session):
        self.db = db
        
    async def collect_answer_api(
        self, 
        question: Question,
        api_config: ApiRequestConfig,
        source_system: str = "RAG系统",
        collect_performance: bool = True
    ) -> Tuple[Optional[RagAnswer], Optional[str]]:
        """
        从RAG API收集单个问题的回答
        返回: (rag_answer, error_message)
        """
        # 替换模板中的问题占位符
        request_data = api_config.request_template.copy()
        
        # 递归查找并替换所有{{question}}占位符
        def replace_question_placeholder(obj, question_text):
            if isinstance(obj, dict):
                for key, value in obj.items():
                    if isinstance(value, (dict, list)):
                        obj[key] = replace_question_placeholder(value, question_text)
                    elif isinstance(value, str) and "{{question}}" in value:
                        obj[key] = value.replace("{{question}}", question_text)
                return obj
            elif isinstance(obj, list):
                return [replace_question_placeholder(item, question_text) for item in obj]
            return obj
            
        request_data = replace_question_placeholder(request_data, question.question_text)
        
        # 准备请求头
        headers = {
            "Content-Type": "application/json"
        }
        if api_config.api_key:
            headers["Authorization"] = f"Bearer {api_config.api_key}"
        
        if api_config.headers:
            headers.update(api_config.headers)
        
        # 性能测量数据
        start_time = time.time()
        first_response_time = None
        
        try:
            async with httpx.AsyncClient(timeout=api_config.timeout) as client:
                # 发送请求
                response = await client.post(
                    api_config.endpoint_url,
                    headers=headers,
                    json=request_data
                )
                
                # 记录首次响应时间
                first_response_time = int((time.time() - start_time) * 1000)  # 毫秒
                
                if response.status_code != 200:
                    return None, f"API请求失败: {response.status_code} - {response.text}"
                
                # 解析响应
                try:
                    response_json = response.json()
                except json.JSONDecodeError:
                    return None, "无法解析API响应JSON"
                
                # 从响应中提取回答
                answer_text = self._extract_answer_from_response(response_json, api_config.response_path)
                if not answer_text:
                    return None, f"无法从响应中提取回答，路径: {api_config.response_path}"
                
                # 计算性能指标
                total_response_time = int((time.time() - start_time) * 1000)  # 毫秒
                character_count = len(answer_text)
                characters_per_second = character_count / (total_response_time / 1000) if total_response_time > 0 else 0
                
                # 创建RagAnswer对象
                rag_answer_data = RagAnswerCreate(
                    question_id=str(question.id),
                    answer_text=answer_text,
                    collection_method="api",
                    source_system=source_system,
                    first_response_time=first_response_time,
                    total_response_time=total_response_time,
                    character_count=character_count,
                    raw_response=response_json,
                    api_config_id=None  # 此处可以保存ApiConfig的ID，如果有的话
                )
                
                # 保存到数据库
                db_obj = RagAnswer(
                    question_id=question.id,
                    answer_text=answer_text,
                    collection_method="api",
                    source_system=source_system,
                    first_response_time=first_response_time,
                    total_response_time=total_response_time,
                    character_count=character_count,
                    characters_per_second=characters_per_second,
                    raw_response=response_json,
                    answer_metadata=None  # 更改字段名
                )
                self.db.add(db_obj)
                self.db.commit()
                self.db.refresh(db_obj)
                
                return db_obj, None
                
        except httpx.TimeoutException:
            return None, "API请求超时"
        except Exception as e:
            return None, f"收集回答时出错: {str(e)}"
    
    async def collect_answers_batch(
        self,
        question_ids: List[str],
        api_config: ApiRequestConfig,
        concurrent_requests: int = 1,
        max_attempts: int = 1,
        source_system: str = "RAG系统",
        collect_performance: bool = True
    ) -> Dict[str, Any]:
        """批量收集多个问题的回答"""
        # 获取问题列表
        questions = self.db.query(Question).filter(Question.id.in_(question_ids)).all()
        if not questions:
            return {
                "success": False,
                "error": "未找到任何问题",
                "results": []
            }
        
        # 创建任务列表
        tasks = []
        for question in questions:
            tasks.append(self.collect_answer_api(question, api_config, source_system, collect_performance))
        
        # 使用信号量控制并发数
        semaphore = asyncio.Semaphore(concurrent_requests)
        
        async def bounded_collect(task):
            async with semaphore:
                return await task
        
        # 执行任务
        bounded_tasks = [bounded_collect(task) for task in tasks]
        results = await asyncio.gather(*bounded_tasks)
        
        # 处理结果
        success_count = 0
        failed_count = 0
        success_results = []
        error_results = []
        
        for (answer, error), question in zip(results, questions):
            if answer:
                success_count += 1
                success_results.append({
                    "question_id": str(question.id),
                    "answer_id": str(answer.id),
                    "success": True
                })
            else:
                failed_count += 1
                error_results.append({
                    "question_id": str(question.id),
                    "success": False,
                    "error": error
                })
        
        return {
            "success": True,
            "total": len(questions),
            "success_count": success_count,
            "failed_count": failed_count,
            "results": success_results + error_results
        }
    
    def import_answers_manual(
        self,
        answers: List[Dict[str, Any]],
        source_system: str = "手动导入"
    ) -> Dict[str, Any]:
        """手动导入回答"""
        success_count = 0
        failed_count = 0
        results = []
        
        for answer_data in answers:
            try:
                question_id = answer_data.get("question_id")
                answer_text = answer_data.get("answer_text")
                
                if not question_id or not answer_text:
                    failed_count += 1
                    results.append({
                        "question_id": question_id,
                        "success": False,
                        "error": "问题ID或回答文本缺失"
                    })
                    continue
                
                # 检查问题是否存在
                question = self.db.query(Question).filter(Question.id == question_id).first()
                if not question:
                    failed_count += 1
                    results.append({
                        "question_id": question_id,
                        "success": False,
                        "error": "问题不存在"
                    })
                    continue
                
                # 创建回答
                character_count = len(answer_text)
                db_obj = RagAnswer(
                    question_id=question.id,
                    answer_text=answer_text,
                    collection_method="manual",
                    source_system=source_system,
                    character_count=character_count,
                    answer_metadata=answer_data.get("metadata")
                )
                self.db.add(db_obj)
                self.db.commit()
                self.db.refresh(db_obj)
                
                success_count += 1
                results.append({
                    "question_id": question_id,
                    "answer_id": str(db_obj.id),
                    "success": True
                })
                
            except Exception as e:
                failed_count += 1
                results.append({
                    "question_id": answer_data.get("question_id", "未知"),
                    "success": False,
                    "error": str(e)
                })
        
        return {
            "success": True,
            "total": len(answers),
            "success_count": success_count,
            "failed_count": failed_count,
            "results": results
        }
    
    def _extract_answer_from_response(self, response_json: Dict[str, Any], path: str) -> Optional[str]:
        """从响应JSON中提取回答文本"""
        try:
            parts = path.split('.')
            current = response_json
            
            for part in parts:
                if part in current:
                    current = current[part]
                else:
                    return None
            
            # 确保结果是字符串
            if isinstance(current, str):
                return current
            else:
                return str(current)
        except Exception:
            return None
    
    def get_rag_answer(self, answer_id: str) -> Optional[RagAnswer]:
        """获取单个RAG回答"""
        return self.db.query(RagAnswer).filter(RagAnswer.id == answer_id).first()
    
    def get_answers_by_question(self, question_id: str) -> List[RagAnswer]:
        """获取问题的所有回答"""
        return self.db.query(RagAnswer).filter(RagAnswer.question_id == question_id).all()
    
    def get_answers_by_project(
        self, 
        project_id: str, 
        skip: int = 0, 
        limit: int = 100
    ) -> List[RagAnswer]:
        """获取项目的所有回答"""
        # 先获取项目的所有问题ID
        question_ids = self.db.query(Question.id).filter(Question.project_id == project_id).all()
        question_ids = [q[0] for q in question_ids]
        
        # 然后查询这些问题的回答
        return self.db.query(RagAnswer).filter(
            RagAnswer.question_id.in_(question_ids)
        ).offset(skip).limit(limit).all()
    
    def delete_rag_answer(self, answer_id: str) -> bool:
        """删除RAG回答"""
        db_obj = self.db.query(RagAnswer).filter(RagAnswer.id == answer_id).first()
        if not db_obj:
            return False
        
        self.db.delete(db_obj)
        self.db.commit()
        return True
    
    def save_api_config(
        self,
        project_id: str,
        name: str,
        endpoint_url: str,
        auth_type: str = "none",
        auth_config: Optional[Dict[str, Any]] = None,
        request_template: Dict[str, Any] = None,
        headers: Optional[Dict[str, Any]] = None
    ) -> ApiConfig:
        """保存API配置"""
        db_obj = ApiConfig(
            project_id=project_id,
            name=name,
            endpoint_url=endpoint_url,
            auth_type=auth_type,
            auth_config=auth_config or {},
            request_template=request_template or {},
            headers=headers or {}
        )
        self.db.add(db_obj)
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj 