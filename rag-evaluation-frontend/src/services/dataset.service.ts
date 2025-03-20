import { api } from '../utils/api';
import { 
  Dataset, 
  DatasetDetail,
  CreateDatasetRequest, 
  UpdateDatasetRequest,
  DatasetListParams,
  Question,
  ImportDataRequest,
  ProjectDatasetLink,
  BatchLinkDatasetsRequest,
  ImportQuestionWithRagRequest
} from '../types/dataset';

// 定义分页响应接口
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages?: number;
}

export const datasetService = {
  // 获取数据集列表
  async getDatasets(params?: {
    page?: number;
    size?: number;
    search?: string;
    filter_type?: 'all' | 'my' | 'public' | 'private';
    tags?: string;
  }): Promise<{datasets: Dataset[], total: number}> {
    try {
      // 手动构建查询参数
      let url = '/v1/datasets';
      if (params) {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            queryParams.append(key, String(value));
          }
        });
        
        const queryString = queryParams.toString();
        if (queryString) {
          url += `?${queryString}`;
        }
      }
      
      console.log('发起请求URL:', url); // 调试日志
      
      const response = await api.get<PaginatedResponse<Dataset>>(url);
      return {
        datasets: response.items || [],
        total: response.total || 0
      };
    } catch (error) {
      console.error('API error:', error);
      return { datasets: [], total: 0 };
    }
  },

  // 获取数据集详情
  async getDataset(id: string): Promise<DatasetDetail | null> {
    try {
      const response = await api.get(`/v1/datasets/${id}`);
      return response;
    } catch (error) {
      console.error('API error:', error);
      return null;
    }
  },

  // 创建数据集
  async createDataset(dataset: CreateDatasetRequest): Promise<Dataset> {
    try {
      const response = await api.post('/v1/datasets', dataset);
      return response;
    } catch (error) {
      console.error('创建数据集失败:', error);
      throw error;
    }
  },

  // 更新数据集
  async updateDataset(id: string, dataset: UpdateDatasetRequest): Promise<Dataset> {
    try {
      const response = await api.put(`/v1/datasets/${id}`, dataset);
      return response;
    } catch (error) {
      console.error('更新数据集失败:', error);
      throw error;
    }
  },

  // 删除数据集
  async deleteDataset(id: string): Promise<void> {
    await api.delete(`/v1/datasets/${id}`);
  },

  // 获取公开数据集
  async getPublicDatasets(params?: any): Promise<{datasets: Dataset[], total: number}> {
    try {
      const response = await api.get<PaginatedResponse<Dataset>>('/v1/datasets/public', { params });
      return {
        datasets: response.items || [],
        total: response.total || 0
      };
    } catch (error) {
      console.error('API error:', error);
      return { datasets: [], total: 0 };
    }
  },

  // 获取数据集的问题列表
  async getQuestions(
    datasetId: string, 
    params?: {
      page?: number;
      size?: number;
      search?: string;
      category?: string;
      difficulty?: string;
    }
  ): Promise<{questions: Question[], total: number}> {
    try {
      let url = `/v1/datasets-questions/${datasetId}/questions`;
      if (params) {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            queryParams.append(key, String(value));
          }
        });
        
        const queryString = queryParams.toString();
        if (queryString) {
          url += `?${queryString}`;
        }
      }
      
      console.log('发送请求URL:', url);
      
      const response = await api.get(url);
      console.log('API响应:', response);
      
      // 确保返回格式正确
      return {
        questions: response.items || [],
        total: response.total || 0
      };
    } catch (error) {
      console.error('API error:', error);
      return { questions: [], total: 0 };
    }
  },

  // 创建问题
  async createQuestion(datasetId: string, question: any): Promise<Question> {
    try {
      const response = await api.post(`/v1/datasets-questions/${datasetId}/questions`, question);
      return response;
    } catch (error) {
      console.error('创建问题失败:', error);
      throw error;
    }
  },

  // 更新问题
  async updateQuestion(datasetId: string, questionId: string, question: any): Promise<Question> {
    try {
      const response = await api.put(`/v1/datasets-questions/${datasetId}/questions/${questionId}`, question);
      return response;
    } catch (error) {
      console.error('更新问题失败:', error);
      throw error;
    }
  },

  // 删除问题
  async deleteQuestion(datasetId: string, questionId: string): Promise<void> {
    await api.delete(`/v1/datasets-questions/${datasetId}/questions/${questionId}`);
  },

  // 批量删除问题
  async batchDeleteQuestions(datasetId: string, questionIds: string[]): Promise<void> {
    await api.post(`/v1/datasets-questions/${datasetId}/questions/batch-delete`, { question_ids: questionIds });
  },

  // 导出问题
  async exportQuestions(datasetId: string): Promise<void> {
    const response = await api.get(`/v1/datasets-questions/${datasetId}/export`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `dataset-${datasetId}-questions.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

  // 导入问题
  async importQuestions(request: ImportDataRequest): Promise<{ success: boolean; imported_count: number; }> {
    try {
      const response = await api.post('/v1/datasets-questions/import/questions', request);
      return response;
    } catch (error) {
      console.error('导入数据失败:', error);
      throw error;
    }
  },

  // 获取项目关联的数据集
  async getProjectDatasets(projectId: string): Promise<Dataset[]> {
    try {
      const response = await api.get(`/v1/projects/${projectId}/datasets`);
      return response || []; // 确保返回数组
    } catch (error) {
      console.error('API error:', error);
      return []; // 出错时返回空数组
    }
  },

  // 关联数据集到项目
  async linkDatasetToProject(link: ProjectDatasetLink): Promise<void> {
    await api.post('/v1/projects/datasets/link', link);
  },

  // 批量关联数据集到项目
  async batchLinkDatasetsToProject(request: BatchLinkDatasetsRequest): Promise<void> {
    await api.post('/v1/datasets/link/' + request.project_id, request);
  },

  // 从项目中移除数据集
  async unlinkDatasetFromProject(link: ProjectDatasetLink): Promise<void> {
    await api.delete(`/v1/projects/${link.project_id}/datasets/${link.dataset_id}`);
  },

  // 复制数据集
  async copyDataset(datasetId: string, newName?: string): Promise<Dataset> {
    let url = `/v1/datasets/${datasetId}/copy`;
    if (newName) {
      url += `?name=${encodeURIComponent(newName)}`;
    }
    
    return api.post<Dataset>(url);
  },

  // 保留兼容性方法，避免现有代码出错
  async getDatasetQuestions(
    datasetId: string, 
    params?: { 
      skip?: number; 
      limit?: number; 
      category?: string; 
      difficulty?: string;
      search?: string;
    }
  ): Promise<Question[]> {
    try {
      // 转换参数格式以适配新的 getQuestions 方法
      const newParams = {
        page: params?.skip ? Math.floor(params.skip / (params.limit || 10)) + 1 : 1,
        size: params?.limit || 10,
        search: params?.search,
        category: params?.category,
        difficulty: params?.difficulty
      };
      
      // 调用新方法
      const response = await this.getQuestions(datasetId, newParams);
      
      // 返回兼容格式
      return response.questions || [];
    } catch (error) {
      console.error('API error:', error);
      return []; // 出错时返回空数组
    }
  },

  // 添加导入带RAG回答的问题的方法
  async importQuestionsWithRag(request: ImportQuestionWithRagRequest): Promise<{ success: boolean; imported_count: number; }> {
    try {
      const response = await api.post('/v1/datasets/import/questions_with_rag', request);
      return response;
    } catch (error) {
      console.error('导入数据失败:', error);
      throw error;
    }
  },

  // 创建带RAG回答的问题
  async createQuestionWithRag(datasetId: string, questionData: any): Promise<Question> {
    try {
      const response = await api.post(`/v1/datasets-questions/${datasetId}/questions/with-rag`, questionData);
      return response;
    } catch (error) {
      console.error('创建问题及RAG回答失败:', error);
      throw error;
    }
  },

  // 批量创建问题
  async batchCreateQuestions(datasetId: string, questions: any[]): Promise<{ success: boolean; imported_count: number }> {
    try {
      const response = await api.post(`/v1/datasets-questions/${datasetId}/questions/batch`, {
        questions: questions
      });
      return response;
    } catch (error) {
      console.error('批量创建问题失败:', error);
      throw error;
    }
  },

  // 批量创建带RAG回答的问题
  async batchCreateQuestionsWithRag(datasetId: string, questions: any[]): Promise<{ success: boolean; imported_count: number }> {
    try {
      const response = await api.post(`/v1/datasets-questions/${datasetId}/questions/batch-with-rag`, {
        questions: questions
      });
      return response;
    } catch (error) {
      console.error('批量创建带RAG回答的问题失败:', error);
      throw error;
    }
  }
}; 