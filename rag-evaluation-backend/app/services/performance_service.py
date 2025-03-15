from typing import List, Dict, Any, Optional, Union
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
import uuid
import asyncio
import time
import statistics
from datetime import datetime, timedelta
import threading
from concurrent.futures import ThreadPoolExecutor

from app.models.performance import PerformanceTest, PerformanceMetric
from app.models.project import Project
from app.models.question import Question
from app.models.rag_answer import ApiConfig
from app.schemas.performance import (
    PerformanceTestCreate,
    PerformanceTestUpdate,
    PerformanceMetricCreate,
    PerformanceTestResult
)
from app.services.rag_service import RagService

class PerformanceService:
    """性能测试服务"""
    
    def __init__(self, db: Session):
        self.db = db
        self.active_tests = {}  # 存储正在运行的测试信息
    
    def create_test(
        self, 
        user_id: str,
        obj_in: PerformanceTestCreate
    ) -> PerformanceTest:
        """创建性能测试"""
        db_obj = PerformanceTest(
            user_id=user_id,
            project_id=obj_in.project_id,
            name=obj_in.name,
            description=obj_in.description,
            test_type=obj_in.test_type,
            config=obj_in.config
        )
        
        self.db.add(db_obj)
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj
    
    def update_test(
        self,
        test_id: str,
        obj_in: PerformanceTestUpdate
    ) -> Optional[PerformanceTest]:
        """更新性能测试"""
        db_obj = self.db.query(PerformanceTest).filter(PerformanceTest.id == test_id).first()
        if not db_obj:
            return None
        
        update_data = obj_in.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        
        self.db.add(db_obj)
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj
    
    def delete_test(self, test_id: str) -> bool:
        """删除性能测试"""
        db_obj = self.db.query(PerformanceTest).filter(PerformanceTest.id == test_id).first()
        if not db_obj:
            return False
        
        # 也删除所有相关的指标
        self.db.query(PerformanceMetric).filter(PerformanceMetric.test_id == test_id).delete()
        
        self.db.delete(db_obj)
        self.db.commit()
        return True
    
    def get_test(self, test_id: str) -> Optional[PerformanceTest]:
        """获取单个性能测试"""
        return self.db.query(PerformanceTest).filter(PerformanceTest.id == test_id).first()
    
    def get_tests_by_project(
        self, 
        project_id: str,
        skip: int = 0,
        limit: int = 100
    ) -> List[PerformanceTest]:
        """获取项目的所有性能测试"""
        return self.db.query(PerformanceTest).filter(
            PerformanceTest.project_id == project_id
        ).order_by(desc(PerformanceTest.created_at)).offset(skip).limit(limit).all()
    
    def get_tests_by_user(
        self, 
        user_id: str,
        skip: int = 0,
        limit: int = 100
    ) -> List[PerformanceTest]:
        """获取用户的所有性能测试"""
        return self.db.query(PerformanceTest).filter(
            PerformanceTest.user_id == user_id
        ).order_by(desc(PerformanceTest.created_at)).offset(skip).limit(limit).all()
    
    def add_metric(self, obj_in: PerformanceMetricCreate) -> PerformanceMetric:
        """添加性能指标"""
        db_obj = PerformanceMetric(
            test_id=obj_in.test_id,
            metric_type=obj_in.metric_type,
            value=obj_in.value,
            unit=obj_in.unit,
            timestamp=obj_in.timestamp,
            performance_metadata=obj_in.metadata
        )
        
        self.db.add(db_obj)
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj
    
    def get_metrics_by_test(
        self, 
        test_id: str,
        metric_type: Optional[str] = None
    ) -> List[PerformanceMetric]:
        """获取测试的所有性能指标"""
        query = self.db.query(PerformanceMetric).filter(PerformanceMetric.test_id == test_id)
        
        if metric_type:
            query = query.filter(PerformanceMetric.metric_type == metric_type)
            
        return query.order_by(PerformanceMetric.timestamp).all()
    
    async def run_test(
        self,
        test_id: str,
        api_config_id: str,
        concurrency: int = 1,
        duration: int = 60,
        ramp_up: int = 0,
        requests_per_second: Optional[int] = None,
        question_ids: Optional[List[str]] = None
    ) -> str:
        """
        运行性能测试
        返回测试任务ID
        """
        # 获取API配置
        api_config = self.db.query(ApiConfig).filter(ApiConfig.id == api_config_id).first()
        if not api_config:
            return None
            
        # 获取测试所需的问题
        project_id = api_config.project_id
        
        if question_ids:
            questions = self.db.query(Question).filter(
                Question.id.in_(question_ids),
                Question.project_id == project_id
            ).all()
        else:
            questions = self.db.query(Question).filter(
                Question.project_id == project_id
            ).limit(100).all()  # 限制最多100个问题
        
        if not questions:
            return None
            
        # 更新测试配置
        test = self.db.query(PerformanceTest).filter(PerformanceTest.id == test_id).first()
        if not test:
            return None
            
        test.config = {
            "api_config_id": str(api_config_id),
            "concurrency": concurrency,
            "duration": duration,
            "ramp_up": ramp_up,
            "requests_per_second": requests_per_second,
            "question_count": len(questions),
            "start_time": datetime.now().isoformat()
        }
        self.db.add(test)
        self.db.commit()
        
        # 创建测试运行任务
        task_id = str(uuid.uuid4())
        
        # 启动一个新线程执行测试
        threading.Thread(
            target=self._run_test_thread,
            args=(
                task_id, 
                test_id, 
                api_config, 
                questions, 
                concurrency, 
                duration, 
                ramp_up, 
                requests_per_second
            ),
            daemon=True
        ).start()
        
        return task_id
    
    def _run_test_thread(
        self,
        task_id: str,
        test_id: str,
        api_config: ApiConfig, 
        questions: List[Question],
        concurrency: int,
        duration: int,
        ramp_up: int,
        requests_per_second: Optional[int]
    ):
        """在单独的线程中运行性能测试"""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        # 设置测试状态为运行中
        self.active_tests[task_id] = {
            "test_id": test_id,
            "status": "running",
            "start_time": datetime.now(),
            "estimated_completion": datetime.now() + timedelta(seconds=duration),
            "metrics": []
        }
        
        try:
            # 运行测试
            results = loop.run_until_complete(
                self._execute_performance_test(
                    test_id,
                    api_config,
                    questions,
                    concurrency,
                    duration,
                    ramp_up,
                    requests_per_second
                )
            )
            
            # 更新测试状态
            self.active_tests[task_id]["status"] = "completed"
            self.active_tests[task_id]["end_time"] = datetime.now()
            self.active_tests[task_id]["results"] = results
            
            # 更新测试记录
            test = self.db.query(PerformanceTest).filter(PerformanceTest.id == test_id).first()
            if test:
                test.config.update({
                    "completed": True,
                    "end_time": datetime.now().isoformat(),
                    "summary": results["summary"]
                })
                self.db.add(test)
                self.db.commit()
            
        except Exception as e:
            # 测试失败
            self.active_tests[task_id]["status"] = "failed"
            self.active_tests[task_id]["error"] = str(e)
            
            # 更新测试记录
            test = self.db.query(PerformanceTest).filter(PerformanceTest.id == test_id).first()
            if test:
                test.config.update({
                    "completed": False,
                    "error": str(e),
                    "end_time": datetime.now().isoformat()
                })
                self.db.add(test)
                self.db.commit()
        
        finally:
            loop.close()
    
    async def _execute_performance_test(
        self,
        test_id: str,
        api_config: ApiConfig,
        questions: List[Question],
        concurrency: int,
        duration: int,
        ramp_up: int,
        requests_per_second: Optional[int]
    ) -> Dict[str, Any]:
        """执行性能测试的核心逻辑"""
        start_time = time.time()
        end_time = start_time + duration
        
        all_metrics = []
        response_times = []
        success_count = 0
        error_count = 0
        total_requests = 0
        
        # 创建RagService以发送请求
        rag_service = RagService(self.db)
        
        # 如果有ramp_up，计算每个并发级别的持续时间
        if ramp_up > 0 and concurrency > 1:
            ramp_step_duration = ramp_up / (concurrency - 1)
            current_concurrency = 1
            next_ramp_time = start_time + ramp_step_duration
        else:
            current_concurrency = concurrency
            next_ramp_time = end_time + 1  # 确保不会触发
        
        # 创建限速器
        if requests_per_second:
            min_interval = 1.0 / requests_per_second
            last_request_time = start_time
        else:
            min_interval = 0
        
        # 主测试循环
        while time.time() < end_time:
            current_time = time.time()
            
            # 检查是否需要增加并发度
            if current_time >= next_ramp_time and current_concurrency < concurrency:
                current_concurrency += 1
                next_ramp_time = current_time + ramp_step_duration
                
                # 记录并发度变化
                metric = PerformanceMetricCreate(
                    test_id=test_id,
                    metric_type="concurrency_level",
                    value=current_concurrency,
                    unit="threads",
                    timestamp=datetime.now(),
                    metadata={"elapsed_time": current_time - start_time}
                )
                all_metrics.append(metric)
                self.add_metric(metric)
            
            # 限制请求速率
            if min_interval > 0:
                sleep_time = last_request_time + min_interval - current_time
                if sleep_time > 0:
                    await asyncio.sleep(sleep_time)
                last_request_time = time.time()
            
            # 创建并发任务
            tasks = []
            for _ in range(current_concurrency):
                # 随机选择一个问题
                question = questions[total_requests % len(questions)]
                
                # 创建一个请求任务
                task = asyncio.create_task(
                    self._send_single_request(
                        rag_service, 
                        question, 
                        api_config
                    )
                )
                tasks.append(task)
                total_requests += 1
            
            # 等待所有任务完成
            results = await asyncio.gather(*tasks)
            
            # 处理结果
            for result in results:
                if result["success"]:
                    success_count += 1
                    response_times.append(result["response_time"])
                    
                    # 添加响应时间指标
                    metric = PerformanceMetricCreate(
                        test_id=test_id,
                        metric_type="response_time",
                        value=result["response_time"],
                        unit="ms",
                        timestamp=datetime.now(),
                        metadata={
                            "question_id": str(result["question_id"]),
                            "characters": result.get("character_count", 0)
                        }
                    )
                    all_metrics.append(metric)
                    self.add_metric(metric)
                    
                    # 如果有字符生成速度，也记录
                    if "characters_per_second" in result:
                        metric = PerformanceMetricCreate(
                            test_id=test_id,
                            metric_type="characters_per_second",
                            value=result["characters_per_second"],
                            unit="chars/s",
                            timestamp=datetime.now(),
                            metadata={"question_id": str(result["question_id"])}
                        )
                        all_metrics.append(metric)
                        self.add_metric(metric)
                else:
                    error_count += 1
                    
                    # 记录错误
                    metric = PerformanceMetricCreate(
                        test_id=test_id,
                        metric_type="error",
                        value=1,
                        unit="count",
                        timestamp=datetime.now(),
                        metadata={
                            "question_id": str(result["question_id"]),
                            "error": result["error"]
                        }
                    )
                    all_metrics.append(metric)
                    self.add_metric(metric)
            
            # 每秒计算一次吞吐量和错误率
            if int(current_time) > int(current_time - 1):
                elapsed = current_time - start_time
                throughput = total_requests / elapsed
                error_rate = error_count / total_requests if total_requests > 0 else 0
                
                # 记录吞吐量
                metric = PerformanceMetricCreate(
                    test_id=test_id,
                    metric_type="throughput",
                    value=throughput,
                    unit="req/s",
                    timestamp=datetime.now(),
                    metadata={"elapsed_time": elapsed}
                )
                all_metrics.append(metric)
                self.add_metric(metric)
                
                # 记录错误率
                metric = PerformanceMetricCreate(
                    test_id=test_id,
                    metric_type="error_rate",
                    value=error_rate * 100,
                    unit="percentage",
                    timestamp=datetime.now(),
                    metadata={"elapsed_time": elapsed}
                )
                all_metrics.append(metric)
                self.add_metric(metric)
        
        # 计算测试摘要
        actual_duration = time.time() - start_time
        avg_response_time = statistics.mean(response_times) if response_times else 0
        try:
            p95_response_time = statistics.quantiles(response_times, n=20)[19] if len(response_times) >= 20 else max(response_times) if response_times else 0
        except:
            p95_response_time = max(response_times) if response_times else 0
            
        max_response_time = max(response_times) if response_times else 0
        min_response_time = min(response_times) if response_times else 0
        throughput = total_requests / actual_duration
        error_rate = error_count / total_requests if total_requests > 0 else 0
        
        summary = {
            "total_requests": total_requests,
            "success_count": success_count,
            "error_count": error_count,
            "avg_response_time": avg_response_time,
            "p95_response_time": p95_response_time,
            "max_response_time": max_response_time,
            "min_response_time": min_response_time,
            "throughput": throughput,
            "error_rate": error_rate * 100,
            "duration": actual_duration,
            "concurrency": concurrency
        }
        
        # 记录测试摘要指标
        for key, value in summary.items():
            if key in ["total_requests", "success_count", "error_count"]:
                unit = "count"
            elif key in ["avg_response_time", "p95_response_time", "max_response_time", "min_response_time"]:
                unit = "ms"
            elif key == "throughput":
                unit = "req/s"
            elif key == "error_rate":
                unit = "percentage"
            elif key == "duration":
                unit = "seconds"
            elif key == "concurrency":
                unit = "threads"
            else:
                unit = ""
                
            metric = PerformanceMetricCreate(
                test_id=test_id,
                metric_type=f"summary_{key}",
                value=float(value),
                unit=unit,
                timestamp=datetime.now(),
                metadata={"summary": True}
            )
            all_metrics.append(metric)
            self.add_metric(metric)
        
        return {
            "summary": summary,
            "metrics": [m.dict() for m in all_metrics]
        }
    
    async def _send_single_request(
        self, 
        rag_service: RagService,
        question: Question,
        api_config: ApiConfig
    ) -> Dict[str, Any]:
        """发送单个请求并测量性能"""
        try:
            start_time = time.time()
            
            # 将ApiConfig对象转换为ApiRequestConfig
            from app.schemas.rag_answer import ApiRequestConfig
            api_request_config = ApiRequestConfig(
                endpoint_url=api_config.endpoint_url,
                headers=api_config.headers,
                request_template=api_config.request_template,
                response_path="answer"  # 假设从回答中提取的路径
            )
            
            # 如果有auth_config中有api_key，设置到api_request_config中
            if api_config.auth_config and "api_key" in api_config.auth_config:
                api_request_config.api_key = api_config.auth_config["api_key"]
            
            # 发送请求
            rag_answer, error = await rag_service.collect_answer_api(
                question=question,
                api_config=api_request_config,
                source_system="Performance Test",
                collect_performance=True
            )
            
            end_time = time.time()
            response_time = (end_time - start_time) * 1000  # 转换为毫秒
            
            if rag_answer:
                return {
                    "success": True,
                    "question_id": question.id,
                    "response_time": response_time,
                    "first_response_time": rag_answer.first_response_time,
                    "total_response_time": rag_answer.total_response_time,
                    "character_count": rag_answer.character_count,
                    "characters_per_second": rag_answer.characters_per_second
                }
            else:
                return {
                    "success": False,
                    "question_id": question.id,
                    "response_time": response_time,
                    "error": error
                }
                
        except Exception as e:
            return {
                "success": False,
                "question_id": question.id,
                "error": str(e)
            }
    
    def get_test_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """获取测试运行状态"""
        if task_id in self.active_tests:
            return self.active_tests[task_id]
        return None
    
    def get_test_results(self, test_id: str) -> PerformanceTestResult:
        """获取测试结果"""
        # 获取测试记录
        test = self.db.query(PerformanceTest).filter(PerformanceTest.id == test_id).first()
        if not test or "summary" not in test.config:
            return None
            
        # 获取测试指标
        metrics = self.get_metrics_by_test(test_id)
        
        # 构建测试结果
        return PerformanceTestResult(
            test_id=test_id,
            status="completed" if test.config.get("completed", False) else "failed",
            summary=test.config["summary"],
            metrics=[{
                "id": str(m.id),
                "metric_type": m.metric_type,
                "value": m.value,
                "unit": m.unit,
                "timestamp": m.timestamp,
                "metadata": m.performance_metadata
            } for m in metrics],
            errors=[m.performance_metadata for m in metrics if m.metric_type == "error"],
            start_time=datetime.fromisoformat(test.config["start_time"]),
            end_time=datetime.fromisoformat(test.config["end_time"]) if "end_time" in test.config else None,
            duration=test.config["summary"]["duration"]
        ) 