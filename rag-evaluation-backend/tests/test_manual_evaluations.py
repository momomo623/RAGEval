import pytest

class TestManualEvaluations:
    """人工评测API测试"""
    
    def test_create_manual_evaluation(self, client, normal_token, project_id, question_id):
        """测试创建人工评测"""
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
                
                # 创建人工评测
                eval_data = {
                    "project_id": project_id,
                    "question_id": question_id,
                    "rag_answer_id": answer_id,
                    "scores": {
                        "accuracy": 4,
                        "relevance": 5
                    },
                    "comments": "这是人工评测的详细评语",
                    "reviewer": "测试评审员"
                }
                
                response = client.post(
                    "/api/v1/manual-evaluations",
                    headers={"Authorization": f"Bearer {normal_token}"},
                    json=eval_data
                )
                
                assert response.status_code in [200, 400, 403, 404]
    
    # def test_get_manual_evaluations_tasks(self, client, normal_token, project_id):
    #     """测试获取人工评测任务列表"""
    #     response = client.get(
    #         "/api/v1/manual-evaluations/tasks",
    #         params={"project_id": project_id},
    #         headers={"Authorization": f"Bearer {normal_token}"}
    #     )
    #
    #     assert response.status_code in [200, 403]
    #
    #     if response.status_code == 200:
    #         data = response.json()
    #         assert isinstance(data, list)
    
    def test_update_manual_evaluation(self, client, normal_token):
        """测试更新人工评测"""
        # 先获取评测列表
        response = client.get(
            "/api/v1/evaluations",
            params={"evaluation_type": "manual"},
            headers={"Authorization": f"Bearer {normal_token}"}
        )
        
        if response.status_code == 200:
            evals = response.json()
            if len(evals) > 0:
                eval_id = evals[0]["id"]
                
                # 更新人工评测
                update_data = {
                    "scores": {
                        "accuracy": 3,
                        "relevance": 4
                    },
                    "comments": "更新后的评测评语"
                }
                
                response = client.put(
                    f"/api/v1/manual-evaluations/{eval_id}",
                    headers={"Authorization": f"Bearer {normal_token}"},
                    json=update_data
                )
                
                assert response.status_code in [200, 403, 404] 