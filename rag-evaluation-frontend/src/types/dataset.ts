export interface Dataset {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  is_public: boolean;
  tags: string[];
  dataset_metadata: Record<string, any>;
  question_count: number;
  created_at: string;
  updated_at: string;
}

export interface DatasetDetail extends Dataset {
  projects: Array<{
    id: string;
    name: string;
  }>;
}

export interface Question {
  id: string;
  dataset_id: string;
  question_text: string;
  standard_answer: string;
  category?: string;
  difficulty?: string;
  type?: string;
  tags?: Record<string, any>;
  question_metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CreateDatasetRequest {
  name: string;
  description?: string;
  is_public: boolean;
  tags?: string[];
  dataset_metadata?: Record<string, any>;
}

export interface UpdateDatasetRequest {
  name?: string;
  description?: string;
  is_public?: boolean;
  tags?: string[];
  dataset_metadata?: Record<string, any>;
}

export interface DatasetListParams {
  page?: number;
  size?: number;
  search?: string;
  tag?: string;
  is_public?: boolean;
}

export interface ImportDataRequest {
  dataset_id: string;
  file?: File;
  questions?: Array<{
    question_text: string;
    standard_answer: string;
    category?: string;
    difficulty?: string;
    tags?: Record<string, any>;
  }>;
}

export interface ProjectDatasetLink {
  project_id: string;
  dataset_id: string;
}

export interface BatchLinkDatasetsRequest {
  project_id: string;
  dataset_ids: string[];
}

export interface RagAnswer {
  id: string;
  question_id: string;
  answer_text: string;
  source_type: string;
  version: string;
  api_config_id?: string;
  response_time?: number;
  token_count?: number;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export interface CreateRagAnswerRequest {
  question_id: string;
  answer_text: string;
  source_type: string;
  version?: string;
  api_config_id?: string;
  response_time?: number;
  token_count?: number;
  metadata?: any;
}

export interface ImportQuestionWithRagRequest {
  dataset_id: string;
  questions: {
    question_text: string;
    standard_answer: string;
    category?: string;
    difficulty?: string;
    type?: string;
    tags?: string[];
    rag_answer?: CreateRagAnswerRequest;
  }[];
} 