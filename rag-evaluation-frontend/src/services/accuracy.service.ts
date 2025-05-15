import { api } from '../utils/api';


export interface AccuracyTestCreate {
  project_id: string;
  name: string;
  description?: string;
  dataset_id: string;
  evaluation_type: 'ai' | 'manual' | 'hybrid';
  scoring_method: 'binary' | 'three_scale' | 'five_scale';
  dimensions: string[];
  weights?: Record<string, number>;
  prompt_template?: string;
  version?: string;
  model_config_test?: Record<string, any>;
}

export interface AccuracyTest {
  id: string;
  project_id: string;
  dataset_id: string;
  name: string;
  description: string;
  evaluation_type: 'ai' | 'manual' | 'hybrid';
  scoring_method: 'binary' | 'three_scale' | 'five_scale';
  status: 'created' | 'running' | 'completed' | 'failed';
  dimensions: string[];
  weights: Record<string, number>;
  model_config_test: Record<string, any>;
  prompt_template: string;
  version: string;
  total_questions: number;
  processed_questions: number;
  success_questions: number;
  failed_questions: number;
  batch_settings: {
    batch_size: number;
    timeout_seconds: number;
  };
  results_summary: {
    overall_score: number;
    [key: string]: any;
  };
  created_at: string;
  started_at: string;
  completed_at: string;
  created_by: string;
}

export interface AccuracyTestDetail extends AccuracyTest {
  items: AccuracyTestItem[];
}

export interface AccuracyTestItem {
  id: string;
  evaluation_id: string;
  question_id: string;
  rag_answer_id: string;
  status: 'pending' | 'ai_completed' | 'human_completed' | 'both_completed' | 'failed';
  final_score: number;
  final_dimension_scores: Record<string, number>;
  final_evaluation_reason: string;
  final_evaluation_type: 'ai' | 'human';
  ai_score: number;
  ai_dimension_scores: Record<string, number>;
  ai_evaluation_reason: string;
  ai_evaluation_time: string;
  ai_raw_response: any;
  human_score: number;
  human_dimension_scores: Record<string, number>;
  human_evaluation_reason: string;
  human_evaluator_id: string;
  human_evaluation_time: string;
  sequence_number: number;
  item_metadata: any;
  question_content: string;
  rag_answer_content: string;
  reference_answer: string;
}

interface StartAccuracyTestRequest {
  accuracy_test_id: string;
}

export const accuracyService = {

  getDatasetRagVersions: async (datasetId: string): Promise<string[]> => {
    return api.get<string[]>(`/v1/rag-answers/versions/dataset/${datasetId}`);
  },
  // 创建精度测试
  create: async (data: AccuracyTestCreate): Promise<AccuracyTest> => {
    console.log('create accuracy test', data);
    return api.post<AccuracyTest>('/v1/accuracy/add', data);
  },

  // 获取项目的所有精度测试
  getByProject: async (projectId: string): Promise<AccuracyTest[]> => {
    return api.get<AccuracyTest[]>(`/v1/accuracy/project/${projectId}`);
  },

  // 获取精度测试详情
  getDetail: async (id: string): Promise<AccuracyTestDetail> => {
    return api.get<AccuracyTestDetail>(`/v1/accuracy/${id}`);
  },

  // 开始精度测试
  start: async (data: StartAccuracyTestRequest): Promise<AccuracyTest> => {
    return api.post<AccuracyTest>('/v1/accuracy/start', data);
  },

  // 完成精度测试
  complete: async (id: string): Promise<AccuracyTest> => {
    try {
      return await api.post<AccuracyTest>(`/v1/accuracy/${id}/complete`);
    } catch (error: any) {
      // 如果错误是因为测试已完成，则忽略错误
      if (error.response?.data?.detail?.includes('测试状态为completed')) {
        console.log('测试已经处于完成状态，无需再次标记');
        // 获取当前测试状态并返回
        return await api.get<AccuracyTest>(`/v1/accuracy/${id}`);
      }
      // 其他错误则抛出
      throw error;
    }
  },

  // 标记测试为失败
  fail: async (id: string, errorDetails: any): Promise<AccuracyTest> => {
    try {
      return await api.post<AccuracyTest>(`/v1/accuracy/${id}/fail`, errorDetails);
    } catch (error: any) {
      // 如果错误是因为测试已完成或已失败，则忽略错误
      if (error.response?.data?.detail?.includes('测试状态为') &&
          (error.response?.data?.detail?.includes('completed') ||
           error.response?.data?.detail?.includes('failed'))) {
        console.log('测试已经处于完成或失败状态，无需再次标记');
        // 获取当前测试状态并返回
        return await api.get<AccuracyTest>(`/v1/accuracy/${id}`);
      }
      // 其他错误则抛出
      throw error;
    }
  },

  // 提交评测项结果
  submitItemResults: async (testId: string, items: any[]): Promise<boolean> => {
    return api.post<boolean>(`/v1/accuracy/${testId}/items`, items);
  },

  // 创建人工评测任务
  createHumanAssignment: async (testId: string, data: any): Promise<any> => {
    return api.post(`/v1/accuracy/${testId}/human-assignments`, data);
  },

  // 获取人工评测任务列表
  getHumanAssignments: async (testId: string): Promise<any[]> => {
    return api.get(`/v1/accuracy/${testId}/human-assignments`);
  },

  // 获取精度测试项目列表（支持分页）
  getTestItems: async (testId: string, params?: {
    limit?: number,
    offset?: number,
    status?: string | null,
    score?: number | null
  }): Promise<any> => {
    const queryParams = new URLSearchParams();

    if (params?.limit) {
      queryParams.append('limit', params.limit.toString());
    }

    if (params?.offset !== undefined) {
      queryParams.append('offset', params.offset.toString());
    }

    if (params?.status) {
      queryParams.append('status', params.status);
    }

    if (params?.score !== null && params?.score !== undefined) {
      queryParams.append('score', params.score.toString());
    }

    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return api.get<any>(`/v1/accuracy/${testId}/items${queryString}`);
  },

  // 检查运行中的测试
  checkRunningTests: async (projectId: string): Promise<AccuracyTest[]> => {
    return api.get<AccuracyTest[]>(`/v1/accuracy/project/${projectId}/running-tests`);
  },

  // 标记测试为中断
  markTestInterrupted: async (testId: string, reason: string): Promise<AccuracyTest> => {
    return api.post<AccuracyTest>(`/v1/accuracy/${testId}/interrupt`, { reason });
  },

  // 重置测试项
  resetTestItems: async (testId: string): Promise<boolean> => {
    return api.post<boolean>(`/v1/accuracy/${testId}/reset`);
  },

  // 更新测试状态
  async updateTestStatus(testId: string, status: string): Promise<void> {
    await api.put(`/accuracy/${testId}/status`, { status });
  }
};