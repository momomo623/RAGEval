#!/usr/bin/env python3
"""
数据迁移脚本：将旧版基于项目的问题迁移到新版基于数据集的问题
使用方法: python migrate_questions.py
"""

import os
import sys
import uuid
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor, execute_values

# 数据库连接配置
DB_HOST = os.environ.get("POSTGRES_SERVER", "localhost")
DB_PORT = os.environ.get("POSTGRES_PORT", "5432")
DB_NAME = os.environ.get("POSTGRES_DB", "rag_evaluation")
DB_USER = os.environ.get("POSTGRES_USER", "postgres")
DB_PASS = os.environ.get("POSTGRES_PASSWORD", "postgres")

def connect_db():
    """连接到数据库"""
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASS
        )
        return conn
    except Exception as e:
        print(f"数据库连接失败: {e}")
        sys.exit(1)

def migrate_questions():
    """迁移问题数据"""
    conn = connect_db()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # 1. 获取所有项目
            cur.execute("SELECT id, name, description, user_id FROM projects")
            projects = cur.fetchall()
            
            print(f"找到 {len(projects)} 个项目需要迁移")
            
            for project in projects:
                # 2. 为每个项目创建一个默认数据集
                dataset_name = f"{project['name']} - 默认数据集"
                dataset_id = str(uuid.uuid4())
                
                cur.execute(
                    """
                    INSERT INTO datasets 
                    (id, user_id, name, description, is_public, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (
                        dataset_id,
                        project['user_id'],
                        dataset_name,
                        f"从项目 '{project['name']}' 自动迁移的数据集",
                        False,
                        datetime.now(),
                        datetime.now()
                    )
                )
                
                # 3. 关联数据集到项目
                cur.execute(
                    """
                    INSERT INTO project_datasets
                    (project_id, dataset_id)
                    VALUES (%s, %s)
                    """,
                    (project['id'], dataset_id)
                )
                
                # 4. 获取该项目的所有问题
                cur.execute(
                    """
                    SELECT id, question_text, standard_answer, category, 
                           difficulty, type, tags, question_metadata, 
                           created_at, updated_at
                    FROM temp_questions 
                    WHERE project_id = %s
                    """,
                    (project['id'],)
                )
                questions = cur.fetchall()
                
                print(f"项目 '{project['name']}' 有 {len(questions)} 个问题需要迁移")
                
                if not questions:
                    continue
                
                # 5. 迁移问题到新数据集
                question_values = [
                    (
                        q['id'],
                        dataset_id,
                        q['question_text'],
                        q['standard_answer'],
                        q['category'],
                        q['difficulty'],
                        q['type'],
                        q['tags'],
                        q['question_metadata'],
                        q['created_at'],
                        q['updated_at']
                    )
                    for q in questions
                ]
                
                execute_values(
                    cur,
                    """
                    INSERT INTO questions
                    (id, dataset_id, question_text, standard_answer, category,
                     difficulty, type, tags, question_metadata, created_at, updated_at)
                    VALUES %s
                    """,
                    question_values
                )
                
                print(f"成功迁移项目 '{project['name']}' 的 {len(questions)} 个问题")
            
            # 6. 提交事务
            conn.commit()
            print("数据迁移完成!")
            
    except Exception as e:
        conn.rollback()
        print(f"迁移失败: {e}")
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    print("开始迁移问题数据...")
    migrate_questions() 