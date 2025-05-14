import { api } from '../utils/api';

export interface PerformanceTest {
  id: string;
  name: string;
  project_id: string;
  dataset_id?: string;
  description?: string;
  concurrency: number;
  version?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  status: 'created' | 'running' | 'completed' | 'failed';
  total_questions: number;
  processed_questions: number;
  success_questions: number;
  failed_questions: number;
  summary_metrics: any;
}

export interface PerformanceTestCreate {
  name: string;
  project_id: string;
  dataset_id?: string;
  description?: string;
  concurrency: number;
  version?: string;
  config?: any;
}

export interface PerformanceTestDetail extends PerformanceTest {
  rag_answers?: any[];
  total_answers?: number;
}

export interface StartPerformanceTestRequest {
  performance_test_id: string;
  question_ids?: string[];
}
export const performanceCreate = async () => {
  return api.post<string>('/v1/performance/health');
}

export const performanceService = {

  // 创建性能测试
  create: async (data: PerformanceTestCreate): Promise<PerformanceTest> => {
    return api.post<PerformanceTest>('/v1/performance/add', data);
  },

  // 获取项目的所有性能测试
  getByProject: async (projectId: string): Promise<PerformanceTest[]> => {
    return api.get<PerformanceTest[]>(`/v1/performance/project/${projectId}`);
  },

  // 获取性能测试详情
  getDetail: async (id: string): Promise<PerformanceTestDetail> => {
    return api.get<PerformanceTestDetail>(`/v1/performance/${id}`);
  },

  // 开始性能测试
  start: async (data: StartPerformanceTestRequest): Promise<PerformanceTest> => {
    return api.post<PerformanceTest>('/v1/performance/start', data);
  },

  // 完成性能测试
  complete: async (id: string): Promise<PerformanceTest> => {
    return api.post<PerformanceTest>(`/v1/performance/${id}/complete`);
  },

  // 标记测试为失败
  fail: async (id: string, errorDetails: any): Promise<PerformanceTest> => {
    return api.post<PerformanceTest>(`/v1/performance/${id}/fail`, errorDetails);
  },

  // 执行RAG性能测试
  // 这部分在前端实现，只提供接口
  executeTest: async (
    testId: string, 
    questions: any[], 
    concurrency: number, 
    progressCallback?: (progress: any) => void
  ): Promise<boolean> => {
    // 此处仅提供框架，实际测试逻辑需要另外实现
    console.log('执行性能测试', testId, questions.length, concurrency);
    
    // 这里应该包含：
    // 1. 从localStorage获取RAG系统配置
    // 2. 并发发送请求到RAG系统
    // 3. 记录性能指标
    // 4. 将结果发送到后端保存
    
    if (progressCallback) {
      progressCallback({ 
        total: questions.length,
        completed: 0,
        success: 0,
        failed: 0
      });
    }
    
    return true;
  },

  // 根据ID获取单个性能测试的详情
  getById: async (id: string) => {
    try {
      // 获取数据
      const response = await api.get(`/v1/performance/${id}`);
      console.log('API返回原始数据:', response);
      
      // 返回数据，确保取到正确的部分
      return response;
    } catch (error) {
      console.error('获取性能测试详情失败:', error);
      throw error;
    }
  },
  fetchTestDetail: async (id: string, page: number = 1, size: number = 10) => {
    return api.get<PerformanceTestDetail>(`/v1/performance/${id}/qa-pairs`, {
      params: { page, size }
    });
  },

  // 取消性能测试
  cancel: async (id: string): Promise<PerformanceTest> => {
    return api.post<PerformanceTest>(`/v1/performance/${id}/cancel`);
  }
};