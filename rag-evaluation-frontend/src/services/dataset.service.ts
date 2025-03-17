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
  BatchLinkDatasetsRequest
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
  async getDatasets(params?: any): Promise<{datasets: Dataset[], total: number}> {
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
  async getDatasetQuestions(
    datasetId: string, 
    params?: { skip?: number; limit?: number; category?: string; difficulty?: string }
  ): Promise<Question[]> {
    try {
      const response = await api.get(`/v1/datasets/${datasetId}/questions`, { params });
      return response || []; // 确保返回数组
    } catch (error) {
      console.error('API error:', error);
      return []; // 出错时返回空数组
    }
  },

  // 导入数据到数据集
  async importData(request: ImportDataRequest): Promise<{ success: boolean; imported_count: number }> {
    try {
      let response;
      // 如果是文件上传，需要使用FormData
      if (request.file) {
        const formData = new FormData();
        formData.append('file', request.file);
        formData.append('dataset_id', request.dataset_id);
        
        response = await api.post('/v1/datasets/import', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
      } else {
        // 如果是直接提交问题数组
        response = await api.post('/v1/datasets/import/questions', request);
      }
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
  }
}; 