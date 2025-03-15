import pytest

class TestReports:
    """报告API测试"""
    
    def test_create_report(self, client, normal_token, project_id):
        """测试创建报告"""
        report_data = {
            "project_id": project_id,
            "title": "测试评测报告",
            "description": "这是一个测试评测报告",
            "config": {
                "include_charts": True,
                "include_raw_data": False
            }
        }
        
        response = client.post(
            "/api/v1/reports",
            headers={"Authorization": f"Bearer {normal_token}"},
            json=report_data
        )
        
        assert response.status_code in [200, 400, 403, 404]
    
    # def test_get_reports(self, client, normal_token, project_id):
    #     """测试获取报告列表"""
    #     response = client.get(
    #         "/api/v1/reports",
    #         params={"project_id": project_id},
    #         headers={"Authorization": f"Bearer {normal_token}"}
    #     )
    #
    #     assert response.status_code in [200, 403]
    #
    #     if response.status_code == 200:
    #         data = response.json()
    #         assert isinstance(data, list)
    
    def test_get_report(self, client, normal_token):
        """测试获取报告详情"""
        # 先获取报告列表
        response = client.get(
            "/api/v1/reports",
            headers={"Authorization": f"Bearer {normal_token}"}
        )
        
        if response.status_code == 200:
            reports = response.json()
            if len(reports) > 0:
                report_id = reports[0]["id"]
                
                # 获取具体报告详情
                response = client.get(
                    f"/api/v1/reports/{report_id}",
                    headers={"Authorization": f"Bearer {normal_token}"}
                )
                
                assert response.status_code in [200, 403, 404]
    
    def test_export_report(self, client, normal_token):
        """测试导出报告"""
        # 先获取报告列表
        response = client.get(
            "/api/v1/reports",
            headers={"Authorization": f"Bearer {normal_token}"}
        )
        
        if response.status_code == 200:
            reports = response.json()
            if len(reports) > 0:
                report_id = reports[0]["id"]
                
                # 导出报告
                export_data = {
                    "report_id": report_id,
                    "format": "pdf",
                    "include_charts": True
                }
                
                response = client.post(
                    "/api/v1/reports/export",
                    headers={"Authorization": f"Bearer {normal_token}"},
                    json=export_data
                )
                
                assert response.status_code in [200, 400, 403, 404] 