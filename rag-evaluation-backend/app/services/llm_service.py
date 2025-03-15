from typing import List, Dict, Any, Optional
import httpx
import json
import time
import re

class QuestionGenerator:
    """使用大模型生成问答对"""
    
    def __init__(self, api_key: str, model: str = "gpt-4"):
        self.api_key = api_key
        self.model = model
        self.base_url = "https://api.openai.com/v1"
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }
    
    async def generate_qa_pairs(
        self, 
        content: str, 
        count: int = 10,
        difficulty: str = "中等",
        types: List[str] = ["事实型", "推理型", "应用型"]
    ) -> List[Dict[str, Any]]:
        """根据知识库内容生成问答对"""
        
        prompt = self._create_qa_generation_prompt(content, count, difficulty, types)
        
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=self.headers,
                    json={
                        "model": self.model,
                        "messages": [
                            {"role": "system", "content": "你是一个精通知识库问答对生成的AI助手。你的任务是根据给定文本生成高质量的问答对，确保问题多样化且有价值，答案完全基于给定内容。"},
                            {"role": "user", "content": prompt}
                        ],
                        "temperature": 0.7,
                    }
                )
                
                if response.status_code != 200:
                    return []
                
                result = response.json()
                qa_text = result["choices"][0]["message"]["content"]
                
                # 解析生成的问答对
                qa_pairs = self._parse_qa_pairs(qa_text)
                return qa_pairs
                
        except Exception as e:
            print(f"生成问答对时发生错误: {str(e)}")
            return []
    
    def _create_qa_generation_prompt(
        self, 
        content: str, 
        count: int,
        difficulty: str,
        types: List[str]
    ) -> str:
        """创建生成问答对的提示"""
        
        type_str = "、".join(types)
        
        return f"""请根据以下内容生成{count}个高质量的问答对，难度为"{difficulty}"，问题类型包括{type_str}。
        
知识库内容：
{content}

请按照以下格式输出问答对： 
```

[
{{
"question": "问题1",
"answer": "答案1",
"type": "问题类型",
"difficulty": "{difficulty}"
}},
...
]
```

注意事项：
1. 确保问题多样化，覆盖不同角度和知识点
2. 答案必须完全基于给定内容，不要添加外部信息
3. 答案应该简明扼要但完整
4. 确保问答对的JSON格式正确，可以直接解析
"""

    def _parse_qa_pairs(self, text: str) -> List[Dict[str, Any]]:
        """解析大模型返回的问答对文本"""
        try:
            # 提取JSON部分
            json_match = re.search(r'\[[\s\S]*\]', text)
            if not json_match:
                return []
            
            json_str = json_match.group(0)
            qa_pairs = json.loads(json_str)
            
            # 验证格式
            for qa in qa_pairs:
                if not all(k in qa for k in ["question", "answer", "type"]):
                    continue
            
            return qa_pairs
        except Exception as e:
            print(f"解析问答对时出错: {str(e)}")
            return []

    async def test_connection(self) -> bool:
        """测试API连接是否正常"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    "https://api.openai.com/v1/models",
                    headers=self.headers
                )
                return response.status_code == 200
        except Exception:
            return False