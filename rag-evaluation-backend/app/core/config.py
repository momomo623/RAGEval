import secrets
from typing import Any, Dict, List, Optional, Union
import os
import socket

from pydantic import AnyHttpUrl, field_validator, EmailStr, Field, ConfigDict, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic.networks import PostgresDsn

# 检测是否在Docker容器中运行
def is_running_in_docker():
    try:
        with open('/proc/self/cgroup', 'r') as f:
            return 'docker' in f.read()
    except:
        return False

class Settings(BaseSettings):
    PROJECT_NAME: str = "RAG Evaluation System"
    API_V1_STR: str = "/api/v1"
    
    # JWT设置
    SECRET_KEY: str = secrets.token_urlsafe(32)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8天
    
    # 数据库设置
    # 优先读取 DATABASE_URL（常见命名），否则用 POSTGRES_* 组装
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_PORT: int = int(os.getenv("POSTGRES_PORT", "5432"))
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "postgres")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "rag_evaluation")
    # 兼容常见变量名 DATABASE_URL
    DATABASE_URL: Optional[str] = os.getenv("DATABASE_URL")
    DATABASE_URI: Optional[PostgresDsn] = None

    @field_validator("DATABASE_URI", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: Optional[str], info) -> Any:
        # 如果显式提供（或通过 DATABASE_URL 注入）则直接返回
        if isinstance(v, str) and v:
            return v

        values = info.data
        # 优先使用 DATABASE_URL（如果设置）
        database_url_env = values.get("DATABASE_URL")
        if isinstance(database_url_env, str) and database_url_env:
            return database_url_env

        # 通过 POSTGRES_* 组装连接串
        db_name = values.get('POSTGRES_DB', '')
        host = values.get("POSTGRES_SERVER")
        port = values.get("POSTGRES_PORT")
        # pydantic 的 PostgresDsn.build 需要 path 以 '/' 开头
        return PostgresDsn.build(
            scheme="postgresql",
            username=values.get("POSTGRES_USER"),
            password=values.get("POSTGRES_PASSWORD"),
            host=f"{host}:{port}" if port else host,
            # 注意：PostgresDsn.build 会自动为 path 添加前导 '/'
            # 这里传入不带前导斜杠的数据库名，避免出现 '//rag_evaluation'
            path=f"{db_name}"
        )
    
    # Redis设置
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379
    
    # CORS设置
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = []

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    # OpenAI API 配置
    OPENAI_API_KEY: Optional[str] = None
    DEFAULT_MODEL: str = "gpt-4"
    
    # Anthropic API 配置
    ANTHROPIC_API_KEY: Optional[str] = None
    
    # 测试用户
    FIRST_ADMIN_EMAIL: EmailStr = "admin@example.com"
    FIRST_ADMIN_PASSWORD: str = "adminpassword"

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True
    )

settings = Settings()

