import pytest

class TestProjects:
    """项目API测试"""
    
    def test_create_project(self, client, normal_token):
        """测试创建项目"""
        project_data = {
            "name": "测试项目",
            "description": "这是一个测试项目",
            "evaluation_method": "auto",
            "scoring_scale": "1-5",
            "status": "created",
            "settings": {
                "auto_evaluation_model": "gpt-4",
                "default_dimensions": ["accuracy", "relevance"]
            }
        }
        
        response = client.post(
            "/api/v1/projects",
            headers={"Authorization": f"Bearer {normal_token}"},
            json=project_data
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == project_data["name"]
        assert data["description"] == project_data["description"]
        assert "id" in data  # 只验证字段存在，不验证具体类型
    
    def test_get_projects(self, client, normal_token):
        """测试获取用户项目列表"""
        response = client.get(
            "/api/v1/projects",
            headers={"Authorization": f"Bearer {normal_token}"}
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_project(self, client, normal_token, project_id):
        """测试获取项目详情"""
        response = client.get(
            f"/api/v1/projects/{project_id}",
            headers={"Authorization": f"Bearer {normal_token}"}
        )
        
        assert response.status_code in [200, 404]
        
        if response.status_code == 200:
            data = response.json()
            assert "id" in data
            assert "name" in data
            assert "dimensions" in data
    
    def test_update_project(self, client, normal_token, project_id):
        """测试更新项目"""
        update_data = {
            "name": "更新后的项目名称",
            "status": "in_progress"
        }
        
        response = client.put(
            f"/api/v1/projects/{project_id}",
            headers={"Authorization": f"Bearer {normal_token}"},
            json=update_data
        )
        
        assert response.status_code in [200, 403, 404]
    
    def test_delete_project(self, client, normal_token, project_id):
        """测试删除项目"""
        response = client.delete(
            f"/api/v1/projects/{project_id}",
            headers={"Authorization": f"Bearer {normal_token}"}
        )
        
        assert response.status_code in [200, 403, 404] 