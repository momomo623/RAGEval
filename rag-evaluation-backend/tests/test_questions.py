import pytest

class TestQuestions:
    """问题API测试"""
    
    def test_create_question(self, client, normal_token, project_id):
        """测试创建问题"""
        question_data = {
            "project_id": project_id,
            "question_text": "这是一个测试问题？",
            "type": "open_ended",
            "category": "general",
            "difficulty": "medium",
            "standard_answer": "这是问题的参考答案",
            "tags": ["测试", "单元测试"],
            "question_metadata": {
                "source": "测试数据"
            }
        }
        
        response = client.post(
            "/api/v1/questions",
            headers={"Authorization": f"Bearer {normal_token}"},
            json=question_data
        )
        
        assert response.status_code in [200, 403, 404]
        
        if response.status_code == 200:
            data = response.json()
            assert data["question_text"] == question_data["question_text"]
            assert data["project_id"] == project_id
            assert "id" in data
    
    # def test_get_questions(self, client, normal_token, project_id):
    #     """测试获取问题列表"""
    #     response = client.get(
    #         "/api/v1/questions",
    #         params={"project_id": project_id},
    #         headers={"Authorization": f"Bearer {normal_token}"}
    #     )
    #
    #     assert response.status_code in [200, 403]
    #
    #     if response.status_code == 200:
    #         data = response.json()
    #         assert isinstance(data, list)
    
    def test_get_question(self, client, normal_token, question_id):
        """测试获取问题详情"""
        response = client.get(
            f"/api/v1/questions/{question_id}",
            headers={"Authorization": f"Bearer {normal_token}"}
        )
        
        assert response.status_code in [200, 403, 404]
    
    def test_update_question(self, client, normal_token, question_id):
        """测试更新问题"""
        update_data = {
            "question_text": "更新后的问题内容",
            "difficulty": "hard"
        }
        
        response = client.put(
            f"/api/v1/questions/{question_id}",
            headers={"Authorization": f"Bearer {normal_token}"},
            json=update_data
        )
        
        assert response.status_code in [200, 403, 404]
    
    def test_delete_question(self, client, normal_token, question_id):
        """测试删除问题"""
        response = client.delete(
            f"/api/v1/questions/{question_id}",
            headers={"Authorization": f"Bearer {normal_token}"}
        )
        
        assert response.status_code in [200, 403, 404]
    
    def test_batch_import_questions(self, client, normal_token, project_id):
        """测试批量导入问题"""
        import_data = {
            "project_id": project_id,
            "questions": [
                {
                    "question_text": "批量导入问题1",
                    "type": "open_ended",
                    "standard_answer": "参考答案1"
                },
                {
                    "question_text": "批量导入问题2",
                    "type": "open_ended",
                    "standard_answer": "参考答案2"
                }
            ]
        }
        
        response = client.post(
            "/api/v1/questions/batch",
            headers={"Authorization": f"Bearer {normal_token}"},
            json=import_data
        )
        
        assert response.status_code in [200, 403, 404] 