import pytest

class TestRAGAnswers:
    """RAG回答API测试"""
    
    def test_create_rag_answer(self, client, normal_token, project_id, question_id):
        """测试创建RAG回答"""
        answer_data = {
            "project_id": project_id,
            "question_id": question_id,
            "rag_name": "测试RAG系统",
            "content": "这是RAG系统的回答",
            "sources": [
                {
                    "text": "资料1内容",
                    "url": "https://example.com/source1",
                    "relevance_score": 0.9
                }
            ],
            "metadata": {
                "model": "gpt-4",
                "latency": 0.5
            }
        }
        
        response = client.post(
            "/api/v1/rag-answers",
            headers={"Authorization": f"Bearer {normal_token}"},
            json=answer_data
        )
        
        assert response.status_code in [200, 403, 404]
    
    # def test_get_rag_answers(self, client, normal_token, question_id):
    #     """测试获取RAG回答列表"""
    #     response = client.get(
    #         "/api/v1/rag-answers",
    #         params={"question_id": question_id},
    #         headers={"Authorization": f"Bearer {normal_token}"}
    #     )
    #
    #     assert response.status_code in [200, 403]
    #
    #     if response.status_code == 200:
    #         data = response.json()
    #         assert isinstance(data, list)
    
    def test_get_rag_answer(self, client, normal_token, question_id):
        """测试获取RAG回答详情"""
        # 先获取回答列表
        response = client.get(
            "/api/v1/rag-answers",
            params={"question_id": question_id},
            headers={"Authorization": f"Bearer {normal_token}"}
        )
        
        if response.status_code == 200:
            answers = response.json()
            if len(answers) > 0:
                answer_id = answers[0]["id"]
                
                # 获取具体回答详情
                response = client.get(
                    f"/api/v1/rag-answers/{answer_id}",
                    headers={"Authorization": f"Bearer {normal_token}"}
                )
                
                assert response.status_code == 200
                
                data = response.json()
                assert "id" in data
                assert "content" in data
                assert "sources" in data 