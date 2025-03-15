def test_get_evaluations(self, client, normal_token, project_id):
    """测试获取评测列表"""
    response = client.get(
        f"/api/v1/evaluations/project/{project_id}",
        headers={"Authorization": f"Bearer {normal_token}"}
    )
    
    assert response.status_code in [200, 403]
    
    if response.status_code == 200:
        data = response.json()
        assert isinstance(data, list) 