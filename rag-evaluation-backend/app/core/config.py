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
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")  # 默认是localhost，Docker环境通过环境变量覆盖
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "rag_evaluation"
    DATABASE_URI: Optional[PostgresDsn] = None

    @field_validator("DATABASE_URI", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: Optional[str], info) -> Any:
        if isinstance(v, str):
            return v
            
        values = info.data
        db_name = values.get('POSTGRES_DB', '')
        return PostgresDsn.build(
            scheme="postgresql",
            username=values.get("POSTGRES_USER"),
            password=values.get("POSTGRES_PASSWORD"),
            host=values.get("POSTGRES_SERVER"),
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

