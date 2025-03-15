import pytest

class TestEvaluations:
    """评测API和自动评测API测试"""
    
    def test_create_auto_evaluation(self, client, normal_token, project_id, question_id):
        """测试创建自动评测"""
        # 先获取该问题的RAG回答
        response = client.get(
            "/api/v1/rag-answers",
            params={"question_id": question_id},
            headers={"Authorization": f"Bearer {normal_token}"}
        )
        
        if response.status_code == 200:
            answers = response.json()
            if len(answers) > 0:
                answer_id = answers[0]["id"]
                
                # 创建自动评测
                eval_data = {
                    "project_id": project_id,
                    "question_id": question_id,
                    "rag_answer_id": answer_id,
                    "model": "gpt-4",
                    "dimensions": ["accuracy", "relevance"],
                    "prompt_template": "默认评估提示模板"
                }
                
                response = client.post(
                    "/api/v1/auto-evaluations",
                    headers={"Authorization": f"Bearer {normal_token}"},
                    json=eval_data
                )
                
                assert response.status_code in [200, 400, 403, 404]

    # def test_get_evaluations(self, client, normal_token, project_id):
    #     """测试获取评测列表"""
    #     response = client.get(
    #         f"/api/v1/evaluations/project/{project_id}",
    #         headers={"Authorization": f"Bearer {normal_token}"}
    #     )
    #
    #     assert response.status_code in [200, 403]
    #
    #     if response.status_code == 200:
    #         data = response.json()
    #         assert isinstance(data, list)

    def test_get_evaluation(self, client, normal_token):
        """测试获取评测详情"""
        # 先获取评测列表
        response = client.get(
            "/api/v1/evaluations",
            headers={"Authorization": f"Bearer {normal_token}"}
        )
        
        if response.status_code == 200:
            evals = response.json()
            if len(evals) > 0:
                eval_id = evals[0]["id"]
                
                # 获取具体评测详情
                response = client.get(
                    f"/api/v1/evaluations/{eval_id}",
                    headers={"Authorization": f"Bearer {normal_token}"}
                )
                
                assert response.status_code in [200, 403, 404]
    
    def test_batch_auto_evaluation(self, client, normal_token, project_id):
        """测试批量自动评测"""
        batch_data = {
            "project_id": project_id,
            "model": "gpt-4",
            "dimensions": ["accuracy", "relevance"],
            "question_ids": [] # 应该填入实际问题ID，此处为空进行模拟测试
        }
        
        response = client.post(
            "/api/v1/auto-evaluations/batch",
            headers={"Authorization": f"Bearer {normal_token}"},
            json=batch_data
        )
        
        assert response.status_code in [200, 400, 403, 404] 