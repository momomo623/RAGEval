-- 表设计思路说明
-- 1. users表
-- 用于存储用户信息，包括认证信息和个人资料。遵循了最小化原则，只存储了必要的用户信息。使用UUID作为主键，提高安全性和分布式环境的兼容性。
-- 2. api_keys表
-- 存储用户的API密钥，方便用户管理不同服务提供商的密钥。这允许用户为不同的评测项目使用不同的API密钥，也便于管理密钥的有效性。
-- 3. projects表
-- 核心表，代表用户创建的评测项目。每个项目有自己的名称、描述和评分方法，并通过status字段跟踪项目的进度状态。
-- 4. evaluation_dimensions表
-- 存储项目的评测维度，如准确性、相关性等。设计为与项目关联，并且可配置权重，这样不同项目可以有不同的评测维度和权重配置。
-- 5. questions表
-- 存储项目中的问题和标准答案。通过project_id与项目关联，支持对问题进行分类和难度标记，便于分析不同类型问题的评测结果。
-- 6. api_configs表
-- 存储RAG系统的API配置信息，包括终端点、认证方式、请求格式等。使用JSONB类型存储请求格式模板，提供灵活性。
-- 7. rag_answers表
-- 存储RAG系统的回答，与问题一一对应。同时存储原始响应，便于后续分析和调试。支持通过API收集或手动导入的方式。
-- 8. evaluations表
-- 存储每个维度的评测结果。设计为每个(问题,回答,维度)组合一条记录，便于细粒度分析。同时记录评测方式(自动或人工)和评测理由。
-- 9. performance_metrics表
-- 存储性能测试指标，特别关注响应时间和生成速度等。支持记录并发测试场景下的性能表现，为RAG系统的性能优化提供依据。
-- 10. system_settings表
-- 存储用户级别的系统配置，如默认评测模型、界面偏好等。采用键值对设计，提供扩展性。
-- 11. shared_projects表
-- 支持项目共享功能，允许多用户协作评测。通过权限控制，可灵活设置其他用户对项目的访问权限。
-- 设计要点
-- 使用UUID作为主键：提高安全性，避免ID暴露业务信息，便于分布式部署
-- 添加时间戳：所有表都包含created_at字段，便于数据审计和历史追踪
-- 使用JSONB类型：存储复杂结构的数据，如API响应和配置，兼顾性能和灵活性
-- 外键关系：确保数据完整性，使用CASCADE删除规则简化级联操作
-- 完整注释：为表和字段添加详细注释，提高代码可维护性
-- 枚举字段：对状态和类型等字段使用字符串枚举，增强可读性和兼容性
-- 7. 分表设计：将不同功能的数据分表存储，如将评测维度和评测结果分开，提高查询效率
-- 这个数据库结构设计充分考虑了RAG评测系统的功能需求，支持多维度评测、性能测试、多用户协作等核心特性，同时具有良好的扩展性和可维护性。

-- 创建数据库
CREATE DATABASE rag_evaluation;

-- 连接到数据库
\c rag_evaluation

-- 创建UUID扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 创建用户表
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    company VARCHAR(100),
    bio TEXT,
    avatar_url VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
COMMENT ON TABLE users IS '用户信息表';
COMMENT ON COLUMN users.id IS '用户唯一标识';
COMMENT ON COLUMN users.email IS '用户邮箱，作为登录名';
COMMENT ON COLUMN users.password_hash IS '加密后的密码';
COMMENT ON COLUMN users.name IS '用户姓名';
COMMENT ON COLUMN users.company IS '公司/组织名称';
COMMENT ON COLUMN users.bio IS '个人简介';
COMMENT ON COLUMN users.avatar_url IS '头像URL';
COMMENT ON COLUMN users.is_active IS '账户是否激活';
COMMENT ON COLUMN users.is_admin IS '是否为管理员';
COMMENT ON COLUMN users.created_at IS '创建时间';
COMMENT ON COLUMN users.updated_at IS '最后更新时间';

-- 创建API密钥表
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    key VARCHAR(100) NOT NULL UNIQUE,
    provider VARCHAR(50) NOT NULL, -- OpenAI, Anthropic等
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
COMMENT ON TABLE api_keys IS '用户API密钥表';
COMMENT ON COLUMN api_keys.id IS '密钥唯一标识';
COMMENT ON COLUMN api_keys.user_id IS '关联的用户ID';
COMMENT ON COLUMN api_keys.name IS '密钥名称';
COMMENT ON COLUMN api_keys.key IS '加密存储的API密钥';
COMMENT ON COLUMN api_keys.provider IS 'API提供商';
COMMENT ON COLUMN api_keys.is_active IS '密钥是否可用';
COMMENT ON COLUMN api_keys.created_at IS '创建时间';
COMMENT ON COLUMN api_keys.updated_at IS '最后更新时间';

-- 创建项目表
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'created', -- created, in_progress, completed
    scoring_method VARCHAR(20) NOT NULL DEFAULT 'three_scale', -- binary, three_scale, five_scale
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
COMMENT ON TABLE projects IS '评测项目表';
COMMENT ON COLUMN projects.id IS '项目唯一标识';
COMMENT ON COLUMN projects.user_id IS '项目创建者ID';
COMMENT ON COLUMN projects.name IS '项目名称';
COMMENT ON COLUMN projects.description IS '项目描述';
COMMENT ON COLUMN projects.status IS '项目状态: created(已创建), in_progress(进行中), completed(已完成)';
COMMENT ON COLUMN projects.scoring_method IS '评分方法: binary(二元评分), three_scale(三分量表), five_scale(五分量表)';
COMMENT ON COLUMN projects.created_at IS '创建时间';
COMMENT ON COLUMN projects.updated_at IS '最后更新时间';

-- 创建评测维度表
CREATE TABLE evaluation_dimensions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL, -- accuracy, relevance, completeness, conciseness
    display_name VARCHAR(50) NOT NULL, -- 准确性, 相关性, 完整性, 简洁性
    description TEXT,
    weight DECIMAL(3,2) NOT NULL DEFAULT 1.0, -- 权重, 默认为1
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
COMMENT ON TABLE evaluation_dimensions IS '评测维度表';
COMMENT ON COLUMN evaluation_dimensions.id IS '维度唯一标识';
COMMENT ON COLUMN evaluation_dimensions.project_id IS '关联的项目ID';
COMMENT ON COLUMN evaluation_dimensions.name IS '维度名称(英文)';
COMMENT ON COLUMN evaluation_dimensions.display_name IS '显示名称(中文)';
COMMENT ON COLUMN evaluation_dimensions.description IS '维度描述';
COMMENT ON COLUMN evaluation_dimensions.weight IS '维度权重';
COMMENT ON COLUMN evaluation_dimensions.is_enabled IS '是否启用该维度';
COMMENT ON COLUMN evaluation_dimensions.created_at IS '创建时间';

-- 创建问题表
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    standard_answer TEXT NOT NULL,
    category VARCHAR(50), -- 可选的问题分类
    difficulty VARCHAR(20), -- easy, medium, hard
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
COMMENT ON TABLE questions IS '问题和标准答案表';
COMMENT ON COLUMN questions.id IS '问题唯一标识';
COMMENT ON COLUMN questions.project_id IS '关联的项目ID';
COMMENT ON COLUMN questions.question IS '问题内容';
COMMENT ON COLUMN questions.standard_answer IS '标准答案';
COMMENT ON COLUMN questions.category IS '问题分类';
COMMENT ON COLUMN questions.difficulty IS '问题难度';
COMMENT ON COLUMN questions.created_at IS '创建时间';
COMMENT ON COLUMN questions.updated_at IS '最后更新时间';

-- 创建API配置表
CREATE TABLE api_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    endpoint_url VARCHAR(255) NOT NULL,
    auth_type VARCHAR(20) NOT NULL DEFAULT 'none', -- none, api_key, basic_auth
    api_key VARCHAR(255),
    username VARCHAR(100),
    password VARCHAR(255),
    request_format JSONB,
    response_path VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
COMMENT ON TABLE api_configs IS 'RAG系统API配置表';
COMMENT ON COLUMN api_configs.id IS '配置唯一标识';
COMMENT ON COLUMN api_configs.project_id IS '关联的项目ID';
COMMENT ON COLUMN api_configs.endpoint_url IS 'API端点URL';
COMMENT ON COLUMN api_configs.auth_type IS '认证类型: none(无), api_key(API密钥), basic_auth(基本认证)';
COMMENT ON COLUMN api_configs.api_key IS 'API密钥(如果使用)';
COMMENT ON COLUMN api_configs.username IS '用户名(如果使用基本认证)';
COMMENT ON COLUMN api_configs.password IS '密码(如果使用基本认证)';
COMMENT ON COLUMN api_configs.request_format IS '请求格式模板(JSON)';
COMMENT ON COLUMN api_configs.response_path IS '从响应中提取答案的路径';
COMMENT ON COLUMN api_configs.created_at IS '创建时间';
COMMENT ON COLUMN api_configs.updated_at IS '最后更新时间';

-- 修改RAG回答表，增加基本性能指标字段
CREATE TABLE rag_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    answer TEXT NOT NULL,
    raw_response JSONB, -- 原始响应JSON
    collection_method VARCHAR(20) NOT NULL DEFAULT 'api', -- api, manual_import
    
    -- 添加基本性能指标字段
    first_response_time DECIMAL(10,3), -- 首次响应时间(秒)
    total_response_time DECIMAL(10,3), -- 总响应时间(秒)
    character_count INTEGER, -- 字符数
    characters_per_second DECIMAL(10,2), -- 每秒字符数
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
COMMENT ON TABLE rag_answers IS 'RAG系统回答表';
COMMENT ON COLUMN rag_answers.id IS '回答唯一标识';
COMMENT ON COLUMN rag_answers.question_id IS '关联的问题ID';
COMMENT ON COLUMN rag_answers.answer IS 'RAG系统的回答';
COMMENT ON COLUMN rag_answers.raw_response IS '原始响应数据(JSON)';
COMMENT ON COLUMN rag_answers.collection_method IS '收集方式: api(API调用), manual_import(手动导入)';
COMMENT ON COLUMN rag_answers.first_response_time IS '首次响应时间(秒)';
COMMENT ON COLUMN rag_answers.total_response_time IS '总响应时间(秒)';
COMMENT ON COLUMN rag_answers.character_count IS '回答字符数';
COMMENT ON COLUMN rag_answers.characters_per_second IS '每秒生成字符数';
COMMENT ON COLUMN rag_answers.created_at IS '创建时间';

-- 修改性能指标表，保留高级性能数据
CREATE TABLE performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rag_answer_id UUID NOT NULL REFERENCES rag_answers(id) ON DELETE CASCADE,
    
    -- 移除已合并到rag_answers的基本指标
    -- first_response_time DECIMAL(10,3), 
    -- total_response_time DECIMAL(10,3) NOT NULL,
    -- character_count INTEGER NOT NULL,
    -- characters_per_second DECIMAL(10,2),
    
    -- 保留高级性能指标
    concurrency_level INTEGER DEFAULT 1, -- 并发级别
    test_session_id UUID, -- 测试会话ID，用于关联同一测试批次
    test_type VARCHAR(30) DEFAULT 'standard', -- 测试类型: standard, stress, stability
    response_chunks INTEGER, -- 流式响应的数据块数量
    status VARCHAR(20) NOT NULL DEFAULT 'success', -- success, error, timeout
    error_message TEXT, -- 错误信息
    
    -- 扩展字段，用于存储自定义性能指标
    custom_metrics JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
COMMENT ON TABLE performance_metrics IS 'RAG系统高级性能指标表';
COMMENT ON COLUMN performance_metrics.id IS '性能记录唯一标识';
COMMENT ON COLUMN performance_metrics.rag_answer_id IS '关联的RAG回答ID';
COMMENT ON COLUMN performance_metrics.concurrency_level IS '测试时的并发级别';
COMMENT ON COLUMN performance_metrics.test_session_id IS '测试会话标识，用于关联同一批次测试';
COMMENT ON COLUMN performance_metrics.test_type IS '测试类型';
COMMENT ON COLUMN performance_metrics.response_chunks IS '流式响应的数据块数量';
COMMENT ON COLUMN performance_metrics.status IS '响应状态: success(成功), error(错误), timeout(超时)';
COMMENT ON COLUMN performance_metrics.error_message IS '错误信息(如有)';
COMMENT ON COLUMN performance_metrics.custom_metrics IS '自定义性能指标，使用JSONB存储灵活的指标数据';
COMMENT ON COLUMN performance_metrics.created_at IS '创建时间';

-- 创建索引以提高查询性能
CREATE INDEX idx_rag_answers_question_id ON rag_answers(question_id);
CREATE INDEX idx_rag_answers_performance ON rag_answers(total_response_time, first_response_time);
CREATE INDEX idx_rag_answers_character_count ON rag_answers(character_count);

-- 创建评测结果表
CREATE TABLE evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    rag_answer_id UUID NOT NULL REFERENCES rag_answers(id) ON DELETE CASCADE,
    dimension_id UUID NOT NULL REFERENCES evaluation_dimensions(id) ON DELETE CASCADE,
    score DECIMAL(3,1) NOT NULL, -- 评分
    evaluation_method VARCHAR(20) NOT NULL, -- auto, manual
    evaluator_id UUID REFERENCES users(id), -- 人工评测时的评测人
    model_name VARCHAR(50), -- 自动评测时使用的模型名称
    explanation TEXT, -- 评测解释或评论
    raw_model_response JSONB, -- 用于自动评测时模型的原始响应
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
COMMENT ON TABLE evaluations IS '评测结果表';
COMMENT ON COLUMN evaluations.id IS '评测结果唯一标识';
COMMENT ON COLUMN evaluations.question_id IS '关联的问题ID';
COMMENT ON COLUMN evaluations.rag_answer_id IS '关联的RAG回答ID';
COMMENT ON COLUMN evaluations.dimension_id IS '关联的评测维度ID';
COMMENT ON COLUMN evaluations.score IS '评分';
COMMENT ON COLUMN evaluations.evaluation_method IS '评测方式: auto(自动), manual(人工)';
COMMENT ON COLUMN evaluations.evaluator_id IS '人工评测者ID';
COMMENT ON COLUMN evaluations.model_name IS '自动评测使用的模型';
COMMENT ON COLUMN evaluations.explanation IS '评测解释';
COMMENT ON COLUMN evaluations.raw_model_response IS '评测模型的原始响应(JSON)';
COMMENT ON COLUMN evaluations.created_at IS '创建时间';

-- 创建系统配置表
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key VARCHAR(50) NOT NULL,
    value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, key)
);
COMMENT ON TABLE system_settings IS '用户系统配置表';
COMMENT ON COLUMN system_settings.id IS '配置唯一标识';
COMMENT ON COLUMN system_settings.user_id IS '用户ID';
COMMENT ON COLUMN system_settings.key IS '配置键';
COMMENT ON COLUMN system_settings.value IS '配置值';
COMMENT ON COLUMN system_settings.created_at IS '创建时间';
COMMENT ON COLUMN system_settings.updated_at IS '最后更新时间';

-- 创建共享项目表
CREATE TABLE shared_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission VARCHAR(20) NOT NULL DEFAULT 'read', -- read, write, admin
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (project_id, user_id)
);
COMMENT ON TABLE shared_projects IS '项目共享表';
COMMENT ON COLUMN shared_projects.id IS '共享记录唯一标识';
COMMENT ON COLUMN shared_projects.project_id IS '共享的项目ID';
COMMENT ON COLUMN shared_projects.user_id IS '被共享的用户ID';
COMMENT ON COLUMN shared_projects.permission IS '权限类型: read(只读), write(可编辑), admin(管理员)';
COMMENT ON COLUMN shared_projects.created_at IS '创建时间';