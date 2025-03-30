-- 确保放在最前面，在创建任何表之前
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 已注释的数据库创建语句
-- create database rag_evaluation
--    with owner postgres;

create table public.users
(
    id            uuid                     default uuid_generate_v4() not null
        primary key,
    email         varchar(255)                                        not null
        unique,
    password_hash varchar(255)                                        not null,
    name          varchar(100),
    company       varchar(100),
    bio           text,
    avatar_url    varchar(255),
    is_active     boolean                  default true,
    is_admin      boolean                  default false,
    created_at    timestamp with time zone default now(),
    updated_at    timestamp with time zone default now()
);

comment on table public.users is '用户信息表';

comment on column public.users.id is '用户唯一标识';

comment on column public.users.email is '用户邮箱，作为登录名';

comment on column public.users.password_hash is '加密后的密码';

comment on column public.users.name is '用户姓名';

comment on column public.users.company is '公司/组织名称';

comment on column public.users.bio is '个人简介';

comment on column public.users.avatar_url is '头像URL';

comment on column public.users.is_active is '账户是否激活';

comment on column public.users.is_admin is '是否为管理员';

comment on column public.users.created_at is '创建时间';

comment on column public.users.updated_at is '最后更新时间';

alter table public.users
    owner to postgres;

create table public.api_keys
(
    id         uuid                     default uuid_generate_v4() not null
        primary key,
    user_id    uuid                                                not null
        references public.users
            on delete cascade,
    name       varchar(100)                                        not null,
    key        varchar(100)                                        not null
        unique,
    provider   varchar(50)                                         not null,
    is_active  boolean                  default true,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

comment on table public.api_keys is '用户API密钥表';

comment on column public.api_keys.id is '密钥唯一标识';

comment on column public.api_keys.user_id is '关联的用户ID';

comment on column public.api_keys.name is '密钥名称';

comment on column public.api_keys.key is '加密存储的API密钥';

comment on column public.api_keys.provider is 'API提供商';

comment on column public.api_keys.is_active is '密钥是否可用';

comment on column public.api_keys.created_at is '创建时间';

comment on column public.api_keys.updated_at is '最后更新时间';

alter table public.api_keys
    owner to postgres;

create table public.projects
(
    id                    uuid                     default uuid_generate_v4()           not null
        primary key,
    user_id               uuid                                                          not null
        references public.users
            on delete cascade,
    name                  varchar(100)                                                  not null,
    description           text,
    status                varchar(20)              default 'created'::character varying not null,
    scoring_scale         varchar(20)              default '1-5'::character varying     not null,
    created_at            timestamp with time zone default now(),
    updated_at            timestamp with time zone default now(),
    evaluation_method     varchar(20)              default 'auto'::character varying    not null,
    settings              jsonb                    default '{}'::jsonb,
    public                boolean                  default false,
    evaluation_dimensions jsonb                    default '[{"name": "accuracy", "weight": 1.0, "enabled": true, "description": "评估回答的事实准确性"}, {"name": "relevance", "weight": 1.0, "enabled": true, "description": "评估回答与问题的相关程度"}, {"name": "completeness", "weight": 1.0, "enabled": true, "description": "评估回答信息的完整性"}, {"name": "conciseness", "weight": 1.0, "enabled": false, "description": "评估回答是否简洁无冗余"}]'::jsonb
);

comment on table public.projects is '评测项目表';

comment on column public.projects.id is '项目唯一标识';

comment on column public.projects.user_id is '项目创建者ID';

comment on column public.projects.name is '项目名称';

comment on column public.projects.description is '项目描述';

comment on column public.projects.status is '项目状态: created(已创建), in_progress(进行中), completed(已完成)';

comment on column public.projects.scoring_scale is '评分方法: binary(二元评分), three_scale(三分量表), five_scale(五分量表)';

comment on column public.projects.created_at is '创建时间';

comment on column public.projects.updated_at is '最后更新时间';

alter table public.projects
    owner to postgres;

create table public.api_configs
(
    id             uuid                     default uuid_generate_v4()        not null
        primary key,
    project_id     uuid                                                       not null
        references public.projects
            on delete cascade,
    endpoint_url   varchar(255)                                               not null,
    auth_type      varchar(20)              default 'none'::character varying not null,
    api_key        varchar(255),
    username       varchar(100),
    password       varchar(255),
    request_format jsonb,
    response_path  varchar(255),
    created_at     timestamp with time zone default now(),
    updated_at     timestamp with time zone default now()
);

comment on table public.api_configs is 'RAG系统API配置表';

comment on column public.api_configs.id is '配置唯一标识';

comment on column public.api_configs.project_id is '关联的项目ID';

comment on column public.api_configs.endpoint_url is 'API端点URL';

comment on column public.api_configs.auth_type is '认证类型: none(无), api_key(API密钥), basic_auth(基本认证)';

comment on column public.api_configs.api_key is 'API密钥(如果使用)';

comment on column public.api_configs.username is '用户名(如果使用基本认证)';

comment on column public.api_configs.password is '密码(如果使用基本认证)';

comment on column public.api_configs.request_format is '请求格式模板(JSON)';

comment on column public.api_configs.response_path is '从响应中提取答案的路径';

comment on column public.api_configs.created_at is '创建时间';

comment on column public.api_configs.updated_at is '最后更新时间';

alter table public.api_configs
    owner to postgres;

create table public.system_settings
(
    id         uuid                     default uuid_generate_v4() not null
        primary key,
    user_id    uuid                                                not null
        references public.users
            on delete cascade,
    key        varchar(50)                                         not null,
    value      text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    unique (user_id, key)
);

comment on table public.system_settings is '用户系统配置表';

comment on column public.system_settings.id is '配置唯一标识';

comment on column public.system_settings.user_id is '用户ID';

comment on column public.system_settings.key is '配置键';

comment on column public.system_settings.value is '配置值';

comment on column public.system_settings.created_at is '创建时间';

comment on column public.system_settings.updated_at is '最后更新时间';

alter table public.system_settings
    owner to postgres;

create table public.shared_projects
(
    id         uuid                     default uuid_generate_v4()        not null
        primary key,
    project_id uuid                                                       not null
        references public.projects
            on delete cascade,
    user_id    uuid                                                       not null
        references public.users
            on delete cascade,
    permission varchar(20)              default 'read'::character varying not null,
    created_at timestamp with time zone default now(),
    unique (project_id, user_id)
);

comment on table public.shared_projects is '项目共享表';

comment on column public.shared_projects.id is '共享记录唯一标识';

comment on column public.shared_projects.project_id is '共享的项目ID';

comment on column public.shared_projects.user_id is '被共享的用户ID';

comment on column public.shared_projects.permission is '权限类型: read(只读), write(可编辑), admin(管理员)';

comment on column public.shared_projects.created_at is '创建时间';

alter table public.shared_projects
    owner to postgres;

create table public.reports
(
    id          uuid                     default gen_random_uuid() not null
        primary key,
    project_id  uuid                                               not null
        references public.projects
            on delete cascade,
    user_id     uuid                                               not null
        references public.users
            on delete cascade,
    title       varchar(255)                                       not null,
    description text,
    report_type varchar(50)                                        not null,
    public      boolean                  default false,
    content     jsonb,
    config      jsonb,
    created_at  timestamp with time zone default CURRENT_TIMESTAMP,
    updated_at  timestamp with time zone default CURRENT_TIMESTAMP
);

alter table public.reports
    owner to postgres;

create index idx_reports_project_id
    on public.reports (project_id);

create index idx_reports_user_id
    on public.reports (user_id);

create index idx_reports_report_type
    on public.reports (report_type);

create index idx_reports_public
    on public.reports (public);

create index idx_reports_created_at
    on public.reports (created_at);

create table public.datasets
(
    id               uuid                     default uuid_generate_v4() not null
        primary key,
    user_id          uuid                                                not null
        references public.users
            on delete cascade,
    name             varchar(100)                                        not null,
    description      text,
    is_public        boolean                  default false,
    tags             jsonb                    default '[]'::jsonb,
    dataset_metadata jsonb                    default '{}'::jsonb,
    created_at       timestamp with time zone default now(),
    updated_at       timestamp with time zone default now()
);

comment on table public.datasets is '问答数据集表';

comment on column public.datasets.id is '数据集唯一标识';

comment on column public.datasets.user_id is '创建者ID';

comment on column public.datasets.name is '数据集名称';

comment on column public.datasets.description is '数据集描述';

comment on column public.datasets.is_public is '是否公开';

comment on column public.datasets.tags is '标签（JSON数组）';

comment on column public.datasets.dataset_metadata is '元数据（JSON对象）';

comment on column public.datasets.created_at is '创建时间';

comment on column public.datasets.updated_at is '最后更新时间';

alter table public.datasets
    owner to postgres;

create table public.project_datasets
(
    id         uuid                     default uuid_generate_v4() not null
        primary key,
    project_id uuid                                                not null
        references public.projects
            on delete cascade,
    dataset_id uuid                                                not null
        references public.datasets
            on delete restrict,
    created_at timestamp with time zone default now(),
    unique (project_id, dataset_id)
);

comment on table public.project_datasets is '项目-数据集关联表';

comment on column public.project_datasets.id is '关联记录唯一标识';

comment on column public.project_datasets.project_id is '项目ID';

comment on column public.project_datasets.dataset_id is '数据集ID';

comment on column public.project_datasets.created_at is '关联创建时间';

alter table public.project_datasets
    owner to postgres;

create table public.questions
(
    id                uuid                     default uuid_generate_v4() not null
        primary key,
    dataset_id        uuid                                                not null
        references public.datasets
            on delete cascade,
    question_text     text                                                not null,
    standard_answer   text                                                not null,
    category          varchar(50),
    difficulty        varchar(20),
    type              varchar(50),
    tags              jsonb                    default '[]'::jsonb,
    question_metadata jsonb                    default '{}'::jsonb,
    created_at        timestamp with time zone default now(),
    updated_at        timestamp with time zone default now()
);

comment on table public.questions is '问题和标准答案表';

comment on column public.questions.id is '问题唯一标识';

comment on column public.questions.dataset_id is '所属数据集ID';

comment on column public.questions.question_text is '问题内容';

comment on column public.questions.standard_answer is '标准答案';

comment on column public.questions.category is '问题分类';

comment on column public.questions.difficulty is '问题难度';

comment on column public.questions.type is '问题类型';

comment on column public.questions.tags is '问题标签';

comment on column public.questions.question_metadata is '问题元数据';

comment on column public.questions.created_at is '创建时间';

comment on column public.questions.updated_at is '最后更新时间';

alter table public.questions
    owner to postgres;

create index idx_questions_dataset_id
    on public.questions (dataset_id);

create index idx_questions_category
    on public.questions (category);

create index idx_questions_difficulty
    on public.questions (difficulty);

create index idx_questions_created_at
    on public.questions (created_at);

create table public.performance_tests
(
    id                  uuid                     default uuid_generate_v4()           not null
        primary key,
    name                varchar(100)                                                  not null,
    project_id          uuid                                                          not null,
    dataset_id          uuid,
    description         text,
    concurrency         integer                                                       not null,
    version             varchar(50),
    created_at          timestamp with time zone default now(),
    started_at          timestamp with time zone,
    completed_at        timestamp with time zone,
    status              varchar(20)              default 'created'::character varying not null,
    config              jsonb                    default '{}'::jsonb                  not null,
    total_questions     integer                  default 0                            not null,
    processed_questions integer                  default 0                            not null,
    success_questions   integer                  default 0                            not null,
    failed_questions    integer                  default 0                            not null,
    summary_metrics     jsonb                    default '{}'::jsonb                  not null
);

comment on table public.performance_tests is 'RAG系统性能测试表';

comment on column public.performance_tests.id is '性能测试唯一标识';

comment on column public.performance_tests.name is '测试名称';

comment on column public.performance_tests.project_id is '关联的项目ID';

comment on column public.performance_tests.dataset_id is '关联的数据集ID';

comment on column public.performance_tests.description is '测试描述信息';

comment on column public.performance_tests.concurrency is '并发请求数量';

comment on column public.performance_tests.version is '版本标识，与rag_answers表中的version对应';

comment on column public.performance_tests.created_at is '测试创建时间';

comment on column public.performance_tests.started_at is '测试开始时间';

comment on column public.performance_tests.completed_at is '测试完成时间';

comment on column public.performance_tests.status is '测试状态：created(已创建), running(运行中), completed(已完成), failed(失败)';

comment on column public.performance_tests.config is '测试配置详情，包括超时设置、重试策略等';

comment on column public.performance_tests.total_questions is '测试的总问题数量';

comment on column public.performance_tests.processed_questions is '已处理的问题数量';

comment on column public.performance_tests.success_questions is '成功处理的问题数量';

comment on column public.performance_tests.failed_questions is '处理失败的问题数量';

comment on column public.performance_tests.summary_metrics is '性能测试汇总指标，包含响应时间、吞吐量等统计数据
{
  "response_time": {
    "first_token_time": {                 // 首个Token响应时间
      "avg": 120.5,                       // 平均值（毫秒）
      "max": 350.2,                       // 最大值
      "min": 50.1,                        // 最小值
      "p50": 115.3,                       // 50分位数
      "p75": 190.4,                       // 75分位数
      "p90": 240.8,                       // 90分位数
      "p95": 280.5,                       // 95分位数
      "p99": 320.1,                       // 99分位数
      "samples": 1000                     // 样本数
    },
    "total_time": {                       // 总响应时间
      "avg": 1200.5,
      "max": 3500.2,
      "min": 500.1,
      "p50": 1150.3,
      "p75": 1900.4,
      "p90": 2400.8,
      "p95": 2800.5,
      "p99": 3200.1,
      "samples": 1000
    }
  },
  "throughput": {                         // 吞吐量指标
    "requests_per_second": 15.3,          // 每秒请求处理数
    "chars_per_second": 2450.7            // 每秒字符生成数
  },
  "character_stats": {                    // 字符统计
    "input_chars": {                      // 输入字符统计
      "avg": 125.7,
      "max": 500,
      "min": 10,
      "total": 125700,
      "samples": 1000
    },
    "output_chars": {                     // 输出字符统计
      "avg": 350.3,
      "max": 1200,
      "min": 50,
      "total": 350300,
      "samples": 1000
    }
  },
  "success_rate": 0.98,                   // 成功率
  "test_duration_seconds": 65.3           // 测试持续时间（秒）
}';

alter table public.performance_tests
    owner to postgres;

create table public.rag_answers
(
    id                    uuid                     default uuid_generate_v4()       not null
        primary key,
    question_id           uuid                                                      not null,
    answer                text                                                      not null,
    raw_response          jsonb,
    collection_method     varchar(20)              default 'api'::character varying not null,
    first_response_time   numeric(10, 3),
    total_response_time   numeric(10, 3),
    character_count       integer,
    characters_per_second numeric(10, 2),
    created_at            timestamp with time zone default now(),
    version               varchar(50),
    performance_test_id   uuid
        constraint fk_rag_answers_performance_test
            references public.performance_tests
            on delete set null,
    sequence_number       integer,
    constraint unique_question_version
        unique (question_id, version)
);

comment on table public.rag_answers is 'RAG系统回答表';

comment on column public.rag_answers.id is '回答唯一标识';

comment on column public.rag_answers.question_id is '关联的问题ID';

comment on column public.rag_answers.answer is 'RAG系统的回答';

comment on column public.rag_answers.raw_response is '原始响应数据(JSON)';

comment on column public.rag_answers.collection_method is '收集方式: api(API调用), manual_import(手动导入)';

comment on column public.rag_answers.first_response_time is '首次响应时间(秒)';

comment on column public.rag_answers.total_response_time is '总响应时间(秒)';

comment on column public.rag_answers.character_count is '回答字符数';

comment on column public.rag_answers.characters_per_second is '每秒生成字符数';

comment on column public.rag_answers.created_at is '创建时间';

comment on column public.rag_answers.performance_test_id is '关联的性能测试ID';

comment on column public.rag_answers.sequence_number is '在性能测试中的序号';

alter table public.rag_answers
    owner to postgres;

create index idx_rag_answers_question_id
    on public.rag_answers (question_id);

create index idx_rag_answers_performance
    on public.rag_answers (total_response_time, first_response_time);

create index idx_rag_answers_character_count
    on public.rag_answers (character_count);

create index idx_rag_answers_performance_test
    on public.rag_answers (performance_test_id);

create index idx_performance_tests_project_id
    on public.performance_tests (project_id);

create index idx_performance_status
    on public.performance_tests (status);

create index idx_performance_tests_version
    on public.performance_tests (version);

create table public.accuracy_test
(
    id                  uuid                     default uuid_generate_v4()           not null
        primary key,
    project_id          uuid                                                          not null
        references public.projects
            on delete cascade,
    dataset_id          uuid                                                          not null
        references public.datasets
            on delete cascade,
    name                varchar(255)                                                  not null,
    description         text,
    evaluation_type     varchar(20)                                                   not null
        constraint accuracy_test_evaluation_type_check
            check ((evaluation_type)::text = ANY
                   ((ARRAY ['ai'::character varying, 'manual'::character varying, 'hybrid'::character varying])::text[])),
    scoring_method      varchar(20)                                                   not null
        constraint accuracy_test_scoring_method_check
            check ((scoring_method)::text = ANY
                   ((ARRAY ['binary'::character varying, 'three_scale'::character varying, 'five_scale'::character varying])::text[])),
    status              varchar(20)              default 'created'::character varying not null
        constraint accuracy_test_status_check
            check ((status)::text = ANY
                   ((ARRAY ['created'::character varying, 'running'::character varying, 'completed'::character varying, 'failed'::character varying])::text[])),
    dimensions          jsonb                    default '["accuracy"]'::jsonb        not null,
    weights             jsonb                    default '{"accuracy": 1.0}'::jsonb,
    model_config_test   jsonb,
    prompt_template     text,
    version             varchar(50),
    total_questions     integer                  default 0,
    processed_questions integer                  default 0,
    success_questions   integer                  default 0,
    failed_questions    integer                  default 0,
    batch_settings      jsonb                    default '{"batch_size": 10, "timeout_seconds": 300}'::jsonb,
    results_summary     jsonb,
    created_at          timestamp with time zone default CURRENT_TIMESTAMP,
    started_at          timestamp with time zone,
    completed_at        timestamp with time zone,
    created_by          uuid
                                                                                      references public.users
                                                                                          on delete set null,
    prompt              text
);

comment on table public.accuracy_test is 'RAG系统精度评测表';

comment on column public.accuracy_test.id is '评测ID，主键';

comment on column public.accuracy_test.project_id is '所属项目ID';

comment on column public.accuracy_test.dataset_id is '评测数据集ID';

comment on column public.accuracy_test.name is '评测名称';

comment on column public.accuracy_test.description is '评测描述';

comment on column public.accuracy_test.evaluation_type is '评测方式：ai(自动)、manual(人工)、hybrid(混合)';

comment on column public.accuracy_test.scoring_method is '评分方法：binary(二元评分)、three_scale(三分量表)、five_scale(五分量表)';

comment on column public.accuracy_test.status is '评测状态：created(已创建)、running(运行中)、completed(已完成)、failed(失败)';

comment on column public.accuracy_test.dimensions is '评测维度：默认为准确性。样例：["accuracy", "relevance", "completeness"]';

comment on column public.accuracy_test.weights is '各维度权重配置。样例：{"accuracy": 1.0, "relevance": 0.8, "completeness": 0.6}';

comment on column public.accuracy_test.model_config_test is '模型配置（用于AI评测）。样例：{"model_name": "gpt-4", "temperature": 0.2, "max_tokens": 1000, "top_p": 1.0}';

comment on column public.accuracy_test.prompt_template is '评测提示词模板';

comment on column public.accuracy_test.version is 'RAG回答版本，用于关联特定版本的回答';

comment on column public.accuracy_test.total_questions is '总问题数';

comment on column public.accuracy_test.processed_questions is '已处理问题数';

comment on column public.accuracy_test.success_questions is '成功评测问题数';

comment on column public.accuracy_test.failed_questions is '失败评测问题数';

comment on column public.accuracy_test.batch_settings is '批量处理设置。样例：{"batch_size": 10, "timeout_seconds": 300, "retry_count": 3, "retry_delay_seconds": 5}';

comment on column public.accuracy_test.results_summary is '评测结果汇总。样例：{"overall_score": 4.2, "accuracy_score": 4.5, "relevance_score": 4.0, "completeness_score": 3.8, "total_items": 100, "high_quality_count": 75, "medium_quality_count": 20, "low_quality_count": 5}';

comment on column public.accuracy_test.created_at is '创建时间';

comment on column public.accuracy_test.started_at is '开始时间';

comment on column public.accuracy_test.completed_at is '完成时间';

comment on column public.accuracy_test.created_by is '创建者ID';

comment on column public.accuracy_test.prompt is '评测提示词';

alter table public.accuracy_test
    owner to postgres;

create index idx_accuracy_test_project_id
    on public.accuracy_test (project_id);

create index idx_accuracy_test_dataset_id
    on public.accuracy_test (dataset_id);

create index idx_accuracy_test_status
    on public.accuracy_test (status);

create index idx_accuracy_test_version
    on public.accuracy_test (version);

create table public.accuracy_test_items
(
    id                      uuid        default uuid_generate_v4() not null
        primary key,
    evaluation_id           uuid                                   not null
        references public.accuracy_test
            on delete cascade,
    question_id             uuid                                   not null
        references public.questions,
    rag_answer_id           uuid                                   not null
        references public.rag_answers,
    status                  varchar(20) default 'pending'::character varying
        constraint accuracy_test_items_status_check
            check ((status)::text = ANY
                   ((ARRAY ['pending'::character varying, 'ai_completed'::character varying, 'human_completed'::character varying, 'both_completed'::character varying, 'failed'::character varying])::text[])),
    final_score             numeric,
    final_dimension_scores  jsonb,
    final_evaluation_reason text,
    final_evaluation_type   varchar(20)
        constraint accuracy_test_items_final_evaluation_type_check
            check ((final_evaluation_type)::text = ANY
                   ((ARRAY ['ai'::character varying, 'human'::character varying])::text[])),
    ai_score                numeric,
    ai_dimension_scores     jsonb,
    ai_evaluation_reason    text,
    ai_evaluation_time      timestamp with time zone,
    ai_raw_response         jsonb,
    human_score             numeric,
    human_dimension_scores  jsonb,
    human_evaluation_reason text,
    human_evaluator_id      varchar(100),
    human_evaluation_time   timestamp with time zone,
    sequence_number         integer,
    item_metadata           jsonb,
    constraint unique_evaluation_question
        unique (evaluation_id, question_id)
);

comment on table public.accuracy_test_items is 'RAG回答评测项目表';

comment on column public.accuracy_test_items.id is '评测项ID，主键';

comment on column public.accuracy_test_items.evaluation_id is '所属评测ID';

comment on column public.accuracy_test_items.question_id is '问题ID，关联questions表';

comment on column public.accuracy_test_items.rag_answer_id is 'RAG回答ID，关联rag_answers表';

comment on column public.accuracy_test_items.status is '评测状态：pending(待评测)、ai_completed(AI评测完成)、human_completed(人工评测完成)、both_completed(两种评测都完成)、failed(失败)';

comment on column public.accuracy_test_items.final_score is '最终评分';

comment on column public.accuracy_test_items.final_dimension_scores is '最终各维度评分详情。样例：{"accuracy": 4, "relevance": 5, "completeness": 3}';

comment on column public.accuracy_test_items.final_evaluation_reason is '最终评测理由/解释';

comment on column public.accuracy_test_items.final_evaluation_type is '最终采用的评测类型：ai或human';

comment on column public.accuracy_test_items.ai_score is 'AI评测评分';

comment on column public.accuracy_test_items.ai_dimension_scores is 'AI评测各维度评分详情。样例：{"accuracy": 4, "relevance": 4, "completeness": 3}';

comment on column public.accuracy_test_items.ai_evaluation_reason is 'AI评测理由/解释';

comment on column public.accuracy_test_items.ai_evaluation_time is 'AI评测时间';

comment on column public.accuracy_test_items.ai_raw_response is 'AI评测原始响应。样例：{"id":"chatcmpl-123", "choices":[{"index":0, "message":{"role":"assistant", "content":"评分：4分。理由：回答准确包含了大部分关键信息，但缺少了一些细节。"}, "finish_reason":"stop"}], "usage":{"prompt_tokens":420, "completion_tokens":65, "total_tokens":485}}';

comment on column public.accuracy_test_items.human_score is '人工评测评分';

comment on column public.accuracy_test_items.human_dimension_scores is '人工评测各维度评分详情。样例：{"accuracy": 5, "relevance": 4, "completeness": 4}';

comment on column public.accuracy_test_items.human_evaluation_reason is '人工评测理由/解释';

comment on column public.accuracy_test_items.human_evaluator_id is '人工评测者ID或访问码';

comment on column public.accuracy_test_items.human_evaluation_time is '人工评测时间';

comment on column public.accuracy_test_items.sequence_number is '序号（用于排序和展示）';

comment on column public.accuracy_test_items.item_metadata is '其他元数据。样例：{"display_priority": "high", "review_flag": true, "comments": ["需要再次核对", "优秀案例"]}';

alter table public.accuracy_test_items
    owner to postgres;

create index idx_accuracy_test_items_evaluation_id
    on public.accuracy_test_items (evaluation_id);

create index idx_accuracy_test_items_question_id
    on public.accuracy_test_items (question_id);

create index idx_accuracy_test_items_rag_answer_id
    on public.accuracy_test_items (rag_answer_id);

create index idx_accuracy_test_items_status
    on public.accuracy_test_items (status);

create index idx_accuracy_test_items_final_score
    on public.accuracy_test_items (final_score);

create table public.accuracy_human_assignments
(
    id               uuid                     default uuid_generate_v4() not null
        primary key,
    evaluation_id    uuid                                                not null
        references public.accuracy_test
            on delete cascade,
    access_code      varchar(20)                                         not null
        constraint unique_access_code
            unique,
    evaluator_name   varchar(100),
    evaluator_email  varchar(255),
    item_ids         jsonb                                               not null,
    total_items      integer                                             not null,
    completed_items  integer                  default 0,
    status           varchar(20)              default 'assigned'::character varying
        constraint accuracy_human_assignments_status_check
            check ((status)::text = ANY
                   ((ARRAY ['assigned'::character varying, 'in_progress'::character varying, 'completed'::character varying])::text[])),
    is_active        boolean                  default true,
    expiration_date  timestamp with time zone,
    assigned_at      timestamp with time zone default CURRENT_TIMESTAMP,
    last_activity_at timestamp with time zone,
    completed_at     timestamp with time zone,
    created_by       uuid
                                                                         references public.users
                                                                             on delete set null
);

comment on table public.accuracy_human_assignments is '人工评测分配表';

comment on column public.accuracy_human_assignments.id is '分配ID，主键';

comment on column public.accuracy_human_assignments.evaluation_id is '所属评测ID';

comment on column public.accuracy_human_assignments.access_code is '评测访问码，用于鉴权访问';

comment on column public.accuracy_human_assignments.evaluator_name is '评测人姓名或标识（可选）';

comment on column public.accuracy_human_assignments.evaluator_email is '评测人邮箱（可选，用于发送通知）';

comment on column public.accuracy_human_assignments.item_ids is '分配的评测项ID列表JSON。样例：["123e4567-e89b-12d3-a456-426614174000", "223e4567-e89b-12d3-a456-426614174001"]';

comment on column public.accuracy_human_assignments.total_items is '总分配项数';

comment on column public.accuracy_human_assignments.completed_items is '已完成项数';

comment on column public.accuracy_human_assignments.status is '状态：assigned(已分配)、in_progress(进行中)、completed(已完成)';

comment on column public.accuracy_human_assignments.is_active is '是否激活（可随时禁用访问权限）';

comment on column public.accuracy_human_assignments.expiration_date is '访问码过期时间（null表示永不过期）';

comment on column public.accuracy_human_assignments.assigned_at is '分配时间';

comment on column public.accuracy_human_assignments.last_activity_at is '最后活动时间';

comment on column public.accuracy_human_assignments.completed_at is '完成时间';

comment on column public.accuracy_human_assignments.created_by is '创建此分配的系统用户ID';

alter table public.accuracy_human_assignments
    owner to postgres;

create index idx_human_assignments_evaluation_id
    on public.accuracy_human_assignments (evaluation_id);

create index idx_human_assignments_access_code
    on public.accuracy_human_assignments (access_code);

create index idx_human_assignments_status
    on public.accuracy_human_assignments (status);

create function public.update_updated_at_column() returns trigger
    language plpgsql
as
$$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

alter function public.update_updated_at_column() owner to postgres;

create trigger update_reports_updated_at
    before update
    on public.reports
    for each row
execute procedure public.update_updated_at_column();

create function public.update_datasets_updated_at() returns trigger
    language plpgsql
as
$$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

alter function public.update_datasets_updated_at() owner to postgres;

create trigger trigger_update_datasets_timestamp
    before update
    on public.datasets
    for each row
execute procedure public.update_datasets_updated_at();

