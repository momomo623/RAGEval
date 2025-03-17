-- 创建数据集表
CREATE TABLE IF NOT EXISTS public.datasets (
    id UUID DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    tags JSONB DEFAULT '[]'::jsonb,
    dataset_metadata JSONB DEFAULT '{}'::jsonb,  -- 改名后的字段
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 其他部分不变 