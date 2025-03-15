import asyncio
import httpx
import time
from typing import List, Dict, Any, Optional
import uuid

from app.core.config import settings
from app.schemas.evaluation import AutoEvaluationRequest, EvaluationResult

class AutoEvaluator:
    """自动评测服务"""
    
    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-4"):
        self.api_key = api_key
        self.model = model
        self.base_url = "https://api.openai.com/v1"
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }
        
    async def evaluate_answer(
        self, 
        question: str, 
        standard_answer: str, 
        rag_answer: str,
        dimension: str,
        dimension_description: str
    ) -> Dict[str, Any]:
        """评估单个维度的回答质量"""
        
        prompt = self._create_evaluation_prompt(
            question, 
            standard_answer, 
            rag_answer,
            dimension,
            dimension_description
        )
        
        start_time = time.time()
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=self.headers,
                    json={
                        "model": self.model,
                        "messages": [
                            {"role": "system", "content": "你是一个专业的RAG系统评测助手，负责评价检索增强生成系统的回答质量。"},
                            {"role": "user", "content": prompt}
                        ],
                        "temperature": 0.1,
                    }
                )
                
                if response.status_code != 200:
                    return {
                        "success": False,
                        "score": 0,
                        "explanation": f"API请求失败: {response.text}",
                        "raw_response": response.json() if response.headers.get("content-type") == "application/json" else response.text,
                        "response_time": time.time() - start_time
                    }
                
                result = response.json()
                evaluation_text = result["choices"][0]["message"]["content"]
                
                # 解析评测结果
                score, explanation = self._parse_evaluation_response(evaluation_text)
                
                return {
                    "success": True,
                    "score": score,
                    "explanation": explanation,
                    "raw_response": result,
                    "response_time": time.time() - start_time
                }
                
        except Exception as e:
            return {
                "success": False,
                "score": 0,
                "explanation": f"评估过程发生错误: {str(e)}",
                "raw_response": str(e),
                "response_time": time.time() - start_time
            }
    
    async def evaluate_batch(self, requests: List[AutoEvaluationRequest]) -> List[EvaluationResult]:
        """批量评测多个问答对的多个维度"""
        tasks = []
        
        for req in requests:
            for dim in req.dimensions:
                tasks.append(
                    self.evaluate_answer(
                        req.question,
                        req.standard_answer,
                        req.rag_answer,
                        dim.name,
                        dim.description
                    )
                )
        
        # 限制并发请求数量，避免API限流
        batch_size = 5
        results = []
        
        for i in range(0, len(tasks), batch_size):
            batch_results = await asyncio.gather(*tasks[i:i+batch_size])
            results.extend(batch_results)
            if i + batch_size < len(tasks):
                await asyncio.sleep(1)  # 避免请求过于频繁
        
        # 将结果与请求关联
        evaluation_results = []
        result_index = 0
        
        for req in requests:
            req_results = []
            for _ in req.dimensions:
                result = results[result_index]
                req_results.append(
                    EvaluationResult(
                        question_id=req.question_id,
                        rag_answer_id=req.rag_answer_id,
                        dimension_id=req.dimensions[len(req_results)].id,
                        score=result["score"],
                        explanation=result["explanation"],
                        raw_model_response=result["raw_response"],
                        model_name=self.model,
                        evaluation_method="auto",
                        success=result["success"]
                    )
                )
                result_index += 1
            
            evaluation_results.extend(req_results)
        
        return evaluation_results
    
    def _create_evaluation_prompt(
        self, 
        question: str, 
        standard_answer: str, 
        rag_answer: str,
        dimension: str,
        dimension_description: str
    ) -> str:
        """创建评测提示"""
        
        return f"""请评估以下RAG系统回答的质量，重点关注"{dimension}"维度（{dimension_description}）。
        
问题：{question}

参考标准答案：{standard_answer}

RAG系统回答：{rag_answer}

评分要求：
- 请严格根据"{dimension}"维度（{dimension_description}）进行评估
- 5分量表评分：
  - 5分：完全满足维度要求，接近完美
  - 4分：大体满足维度要求，有轻微不足
  - 3分：部分满足维度要求，有明显不足
  - 2分：基本不满足维度要求，但有一些可取之处
  - 1分：完全不满足维度要求，存在严重问题

请按以下格式回答：
分数：[1-5之间的整数]
分析：[详细解释评分理由，指出具体优缺点]
"""

    def _parse_evaluation_response(self, response_text: str) -> tuple:
        """解析模型返回的评估结果"""
        try:
            lines = response_text.strip().split('\n')
            score_line = next((line for line in lines if line.startswith('分数：')), None)
            
            if not score_line:
                return 0, "无法解析评分结果"
            
            score = int(score_line.replace('分数：', '').strip())
            
            # 提取分析部分
            analysis_start_idx = response_text.find('分析：')
            explanation = response_text[analysis_start_idx:].replace('分析：', '', 1).strip() if analysis_start_idx != -1 else "无分析内容"
            
            return score, explanation
            
        except Exception as e:
            return 0, f"解析评分结果时出错: {str(e)}" 