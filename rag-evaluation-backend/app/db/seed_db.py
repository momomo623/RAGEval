#!/usr/bin/env python3

import os
import psycopg2
import sys
import uuid

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.core.config import settings

def seed_data():
    """插入初始测试数据"""
    try:
        # 连接到数据库
        conn = psycopg2.connect(
            host=settings.POSTGRES_SERVER,
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            database=settings.POSTGRES_DB
        )
        cursor = conn.cursor()
        
        # 创建测试用户
        user_id = str(uuid.uuid4())
        cursor.execute(
            "INSERT INTO users (id, email, password_hash, name, is_admin) VALUES (%s, %s, %s, %s, %s)",
            (user_id, "admin@example.com", "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW", "管理员", True)
        )
        
        # 创建测试项目
        project_id = str(uuid.uuid4())
        cursor.execute(
            "INSERT INTO projects (id, user_id, name, description, status) VALUES (%s, %s, %s, %s, %s)",
            (project_id, user_id, "示例项目", "这是一个用于演示的项目", "created")
        )
        
        # 创建评测维度
        dimensions = [
            ("accuracy", "准确性", "回答的事实是否与标准答案一致", 1.0),
            ("relevance", "相关性", "回答是否与问题相关", 1.0),
            ("completeness", "完整性", "回答是否涵盖了标准答案中的所有关键信息", 1.0),
            ("conciseness", "简洁性", "回答是否无冗余信息", 0.8)
        ]
        
        for name, display_name, description, weight in dimensions:
            cursor.execute(
                "INSERT INTO evaluation_dimensions (project_id, name, display_name, description, weight) VALUES (%s, %s, %s, %s, %s)",
                (project_id, name, display_name, description, weight)
            )
        
        print("测试数据添加成功")
        conn.commit()
        cursor.close()
        conn.close()
        return True
    except Exception as e:
        print(f"添加测试数据时出错: {e}")
        return False

if __name__ == "__main__":
    seed_data() 