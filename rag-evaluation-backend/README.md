# 🔧 RAG评测系统后端 | Backend

基于 FastAPI + Python 3.9+ 构建的高性能后端API服务，提供完整的RAG系统评测功能。

## 🚀 快速开始

### 环境要求
- Python 3.9+
- PostgreSQL 14+
- Redis (可选，用于缓存)

### 本地开发

```bash
# 1. 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或 venv\Scripts\activate  # Windows

# 2. 安装依赖
pip install -r requirements.txt

# 3. 启动开发服务器
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 📁 项目结构

```
app/
├── api/                 # API接口层
│   ├── api_v1/         # API版本1
│   │   └── endpoints/  # 具体接口端点
│   ├── api.py          # 路由注册
│   └── deps.py         # 依赖注入
├── core/               # 核心配置
│   ├── config.py       # 系统配置
│   └── security.py     # 安全机制
├── db/                 # 数据库相关
│   ├── base.py         # 基础设置
│   ├── create.sql      # 建表脚本
│   ├── init_db.py      # 初始化脚本
│   └── seed_db.py      # 数据填充
├── models/             # 数据模型
├── schemas/            # 数据模式
├── services/           # 业务服务层
├── utils/              # 工具模块
├── main.py             # 应用入口
└── requirements.txt    # 依赖列表
```

## 🧩 核心模块详细说明

## API层 (app/api/)

### api_v1/endpoints/
- **users.py**: 用户管理API接口，提供用户CRUD操作
- **auth.py**: 认证相关API，处理用户登录、注册、令牌刷新等功能
- **projects.py**: 项目管理API，提供创建、更新、删除和查询评测项目的接口
- **questions.py**: 问题管理API，处理问题的CRUD和问题批量导入/生成功能
- **rag_answers.py**: RAG回答收集API，提供从RAG系统收集回答的接口和回答管理功能
- **evaluations.py**: 评测管理通用API，处理评测结果统计和比较功能
- **auto_evaluation.py**: 自动评测API，提供基于大模型的自动评测功能
- **manual_evaluation.py**: 人工评测API，处理人工评分和评论功能
- **reports.py**: 报告生成API，提供创建、查询和导出评测报告的接口
- **performance.py**: 性能测试API，处理RAG系统性能测试和指标收集功能

### api.py
- 路由注册文件，将所有API端点注册到主应用路由器

### deps.py
- 依赖注入模块，提供获取数据库会话、当前用户等依赖项

## 核心模块 (app/core/)

- **config.py**: 系统配置管理，包括数据库连接、安全设置等配置项
- **security.py**: 安全相关功能，实现JWT生成、密码哈希等安全机制

## 数据库模块 (app/db/)

- **base.py**: 数据库基础设置，定义基础模型类
- **create.sql**: 数据库创建脚本，包含表结构定义
- **init_db.py**: 数据库初始化脚本，用于创建初始数据库结构
- **seed_db.py**: 数据填充脚本，用于填充测试或初始数据

## 数据模型 (app/models/)

- **user.py**: 用户模型，定义用户表结构
- **project.py**: 项目模型，定义评测项目和评测维度表结构
- **question.py**: 问题模型，定义问题表结构
- **rag_answer.py**: RAG回答模型，定义回答记录和API配置表结构
- **evaluation.py**: 评测结果模型，定义评测记录表结构
- **performance.py**: 性能测试模型，定义性能测试记录和指标表结构

## 数据模式 (app/schemas/)

- **user.py**: 用户数据模式，定义用户数据的验证和序列化规则
- **project.py**: 项目数据模式，定义项目数据的验证和序列化规则
- **question.py**: 问题数据模式，定义问题数据的验证和序列化规则
- **rag_answer.py**: RAG回答数据模式，定义回答数据的验证和序列化规则
- **evaluation.py**: 评测数据模式，定义评测数据的验证和序列化规则
- **performance.py**: 性能测试数据模式，定义性能数据的验证和序列化规则
- **report.py**: 报告数据模式，定义报告数据的验证和序列化规则

## 服务层 (app/services/)

- **user_service.py**: 用户服务，提供用户管理的核心业务逻辑
- **project_service.py**: 项目服务，提供项目管理的业务逻辑
- **question_service.py**: 问题服务，处理问题管理的业务逻辑
- **rag_service.py**: RAG回答收集服务，负责与RAG系统交互并收集回答
- **evaluation_service.py**: 评测服务，处理评测的业务逻辑
- **auto_evaluator.py**: 自动评测引擎，使用大模型进行自动评测
- **report_service.py**: 报告服务，生成和导出评测报告
- **llm_service.py**: 大语言模型服务，提供问题生成等基于LLM的功能

## 工具模块 (app/utils/)

- **security.py**: 安全工具函数，提供加密、解密等功能
- **file_handlers.py**: 文件处理工具，处理文件上传和导出

## 应用入口

- **__init__.py**: 模块初始化文件
- **main.py**: 应用入口文件，创建并配置FastAPI应用实例

## 依赖管理

- **requirements.txt**: 项目依赖列表，记录所有Python包依赖

## 🎨 技术栈

- **FastAPI**: 现代化、高性能的Python Web框架
- **SQLAlchemy**: Python SQL工具包和对象关系映射(ORM)
- **Pydantic**: 数据验证和设置管理库
- **PostgreSQL**: 开源关系型数据库
- **Uvicorn**: ASGI服务器实现
- **JWT**: JSON Web Token用于身份验证
- **Asyncio**: 异步编程支持

## 🔧 核心功能

### 🤖 AI智能功能
- 集成多种大模型API (GPT、Claude等)
- 基于文档的智能问答对生成
- 自动评测引擎

### 📊 评测功能
- 多维度精度评测 (准确性、相关性、完整性)
- 性能测试 (响应时间、并发测试、吞吐量)
- 评测结果统计和分析

### 🔐 安全特性
- JWT身份验证
- 密码哈希加密
- API访问控制
- 数据验证和清理

