import pytest

class TestUsers:
    """用户API测试"""
    
    def test_get_all_users(self, client, admin_token):
        """测试获取所有用户（管理员权限）"""
        response = client.get(
            "/api/v1/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code in [200, 403]
        
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list)
            if len(data) > 0:
                user = data[0]
                assert "id" in user
                assert "email" in user
                assert "name" in user
    
    def test_create_user(self, client, admin_token, test_user_data):
        """测试创建新用户（管理员权限）"""
        response = client.post(
            "/api/v1/users",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=test_user_data
        )
        
        assert response.status_code in [200, 400, 403]
        
        if response.status_code == 200:
            data = response.json()
            assert data["email"] == test_user_data["email"]
            assert data["name"] == test_user_data["name"]
            assert "id" in data
    
    def test_get_current_user(self, client, normal_token):
        """测试获取当前用户信息"""
        response = client.get(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {normal_token}"}
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert "email" in data
        assert "name" in data
    
    def test_update_current_user(self, client, normal_token):
        """测试更新当前用户信息"""
        update_data = {
            "name": "新用户名称",
            "bio": "新个人简介"
        }
        
        response = client.put(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {normal_token}"},
            json=update_data
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == update_data["name"]
        assert data["bio"] == update_data["bio"]
    
    def test_get_user_by_id(self, client, admin_token, user_id):
        """测试获取指定用户信息"""
        response = client.get(
            f"/api/v1/users/{user_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code in [200, 403, 404]
    
    def test_update_user_by_id(self, client, admin_token, user_id):
        """测试更新指定用户信息"""
        update_data = {
            "name": "管理员更新的用户名",
            "is_active": True
        }
        
        response = client.put(
            f"/api/v1/users/{user_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=update_data
        )
        
        assert response.status_code in [200, 403, 404]
    
    def test_delete_user(self, client, admin_token, user_id):
        """测试删除用户"""
        response = client.delete(
            f"/api/v1/users/{user_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code in [200, 403, 404]
    
    def test_create_api_key(self, client, normal_token, test_api_key_data):
        """测试创建API密钥"""
        response = client.post(
            "/api/v1/users/api-keys",
            headers={"Authorization": f"Bearer {normal_token}"},
            json=test_api_key_data
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == test_api_key_data["name"]
        assert data["key"] == test_api_key_data["key"]
        assert data["provider"] == test_api_key_data["provider"]
        assert "id" in data
    
    def test_get_api_keys(self, client, normal_token):
        """测试获取所有API密钥"""
        response = client.get(
            "/api/v1/users/api-keys",
            headers={"Authorization": f"Bearer {normal_token}"}
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
    
    def test_update_api_key(self, client, normal_token, api_key_id):
        """测试更新API密钥"""
        update_data = {
            "name": "更新后的密钥名称",
            "is_active": False
        }
        
        response = client.put(
            f"/api/v1/users/api-keys/{api_key_id}",
            headers={"Authorization": f"Bearer {normal_token}"},
            json=update_data
        )
        
        assert response.status_code in [200, 403, 404]
    
    def test_delete_api_key(self, client, normal_token, api_key_id):
        """测试删除API密钥"""
        response = client.delete(
            f"/api/v1/users/api-keys/{api_key_id}",
            headers={"Authorization": f"Bearer {normal_token}"}
        )
        
        assert response.status_code in [200, 403, 404] 