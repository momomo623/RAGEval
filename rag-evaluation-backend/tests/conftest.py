import pytest
from fastapi.testclient import TestClient
from app.main import app
import uuid
import os
import jwt
from datetime import datetime, timedelta

@pytest.fixture
def client():
    """创建一个测试客户端"""
    return TestClient(app)

@pytest.fixture
def admin_token():
    """获取管理员用户令牌"""
    # 创建一个有效的JWT格式令牌
    payload = {
        "sub": str(uuid.uuid4()),  # 用户ID
        "exp": datetime.utcnow() + timedelta(days=1),  # 过期时间
        "is_admin": True,  # 管理员
        "is_active": True   # 活跃用户
    }
    # 使用固定的测试密钥，确保与应用配置中的SECRET_KEY一致
    from app.core.config import settings
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")
    return token

@pytest.fixture
def normal_token():
    """获取普通用户令牌"""
    # 创建一个有效的JWT格式令牌
    payload = {
        "sub": str(uuid.uuid4()),  # 用户ID
        "exp": datetime.utcnow() + timedelta(days=1),  # 过期时间
        "is_admin": False,  # 非管理员
        "is_active": True   # 活跃用户
    }
    # 使用固定的测试密钥，确保与应用配置中的SECRET_KEY一致
    from app.core.config import settings
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")
    return token

@pytest.fixture
def user_id():
    """生成一个测试用户ID"""
    return str(uuid.uuid4())

@pytest.fixture
def api_key_id():
    """生成一个测试API密钥ID"""
    return str(uuid.uuid4())

@pytest.fixture
def project_id():
    """生成一个测试项目ID"""
    return str(uuid.uuid4())

@pytest.fixture
def question_id():
    """生成一个测试问题ID"""
    return str(uuid.uuid4())

@pytest.fixture
def test_user_data():
    """测试用户数据"""
    return {
        "email": f"test_{uuid.uuid4()}@example.com",
        "password": "testpassword123",
        "name": "测试用户",
        "company": "测试公司",
        "bio": "这是一个测试用户",
        "avatar_url": "https://example.com/avatar.jpg"
    }

@pytest.fixture
def test_api_key_data():
    """测试API密钥数据"""
    return {
        "name": "测试OpenAI API密钥",
        "key": f"sk-{uuid.uuid4()}",
        "provider": "openai",
        "is_active": True
    } 