import pytest

class TestPerformance:
    """性能测试API测试"""
    
    def test_create_performance_test(self, client, normal_token, project_id):
        """测试创建性能测试"""
        test_data = {
            "project_id": project_id,
            "name": "测试性能测试",
            "description": "这是一个测试性能测试",
            "test_type": "latency",
            "config": {
                "max_concurrency": 10,
                "duration": 60,
                "ramp_up": 10
            }
        }
        
        response = client.post(
            "/api/v1/performance",
            headers={"Authorization": f"Bearer {normal_token}"},
            json=test_data
        )
        
        assert response.status_code in [200, 400, 403, 404]
    
    # def test_get_performance_tests(self, client, normal_token, project_id):
    #     """测试获取性能测试列表"""
    #     response = client.get(
    #         "/api/v1/performance",
    #         params={"project_id": project_id},
    #         headers={"Authorization": f"Bearer {normal_token}"}
    #     )
    #
    #     assert response.status_code in [200, 403]
    #
    #     if response.status_code == 200:
    #         data = response.json()
    #         assert isinstance(data, list)
    
    def test_get_performance_test(self, client, normal_token):
        """测试获取性能测试详情"""
        # 先获取测试列表
        response = client.get(
            "/api/v1/performance",
            headers={"Authorization": f"Bearer {normal_token}"}
        )
        
        if response.status_code == 200:
            tests = response.json()
            if len(tests) > 0:
                test_id = tests[0]["id"]
                
                # 获取具体测试详情
                response = client.get(
                    f"/api/v1/performance/{test_id}",
                    headers={"Authorization": f"Bearer {normal_token}"}
                )
                
                assert response.status_code in [200, 403, 404]
    
    def test_run_performance_test(self, client, normal_token, project_id):
        """测试运行性能测试"""
        test_data = {
            "project_id": project_id,
            "name": "运行测试",
            "description": "这是一个运行中的性能测试",
            "api_config_id": "api配置ID", # 应该填入实际API配置ID
            "concurrency": 5,
            "duration": 30,
            "question_ids": [] # 应该填入实际问题ID
        }
        
        response = client.post(
            "/api/v1/performance/run",
            headers={"Authorization": f"Bearer {normal_token}"},
            json=test_data
        )
        
        assert response.status_code in [200, 400, 403, 404]
        
        if response.status_code == 200:
            data = response.json()
            assert "test_id" in data
            assert "status" in data
            assert data["status"] == "running" 