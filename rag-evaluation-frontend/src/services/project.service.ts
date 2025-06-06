import { message } from 'antd';
import { api } from '../utils/api';
import { authService } from '../services/auth.service';

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string;
  evaluation_method: 'auto' | 'manual' | 'hybrid';
  scoring_scale: 'binary' | '1-3' | '1-5';
  status: 'created' | 'in_progress' | 'completed';
  settings: any;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  evaluation_method?: 'auto' | 'manual' | 'hybrid';
  scoring_scale?: 'binary' | '1-3' | '1-5';
  status?: 'created' | 'in_progress' | 'completed';
  settings?: any;
}

interface ProjectsResponse {
  items: Project[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

class ProjectService {
  async getProjects(status?: string): Promise<ProjectsResponse> {
    try {
      return await api.get<ProjectsResponse>(`/v1/projects${status ? `?status=${status}` : ''}`);
    } catch (error) {
      console.error('获取项目列表失败:', error);
      return {
        items: [],
        total: 0,
        page: 1,
        size: 10,
        pages: 0
      };
    }
  }

  async createProject(projectData: CreateProjectRequest): Promise<Project | null> {
    try {
      const result = await api.post<Project>('/v1/projects', projectData);
      return result;
    } catch (error) {
      console.error('项目创建失败:', error);
      return null;
    }
  }

  async getProjectDetails(projectId: string): Promise<any> {
    console.log('DEBUG - 获取项目详情:', {
      projectId: projectId,
      token: authService.getToken()?.substring(0, 15) + '...' // 只显示令牌前15个字符
    });

    try {
      return await api.get<Project>(`/v1/projects/${projectId}`);
    } catch (error) {
      message.error('获取项目详情失败');
      console.error('获取项目详情失败:', error);
      return null;
    }
  }

  async updateProject(projectId: string, projectData: Partial<CreateProjectRequest>): Promise<Project | null> {
    try {
      // 使用api工具类进行请求，而不是直接使用fetch
      const result = await api.put<Project>(`/v1/projects/${projectId}`, projectData);
      message.success('项目更新成功');
      return result;
    } catch (error) {
      console.error('更新项目失败:', error);
      message.error(error instanceof Error ? error.message : '更新项目失败，请重试');
      return null;
    }
  }

  async deleteProject(projectId: string): Promise<boolean> {
    try {
      console.log('发送删除请求，项目ID:', projectId);

      await api.delete(`/v1/projects/${projectId}`);

      message.success('项目删除成功');
      return true;
    } catch (error) {
      console.error('删除项目失败:', error);
      return false;
    }
  }

  async getProject(id: string): Promise<Project | null> {
    try {
      // 添加调试信息
      console.log(`正在请求项目详情, ID: ${id}`);

      const response = await api.get<Project>(`/v1/projects/${id}`);

      // 记录成功响应
      console.log('获取项目详情成功:', response);

      return response;
    } catch (error) {
      console.error('获取项目详情失败:', error);

      // 详细记录错误信息
      if (error.response) {
        console.error('错误响应状态:', error.response.status);
        console.error('错误响应数据:', error.response.data);
      }

      return null;
    }
  }
}

export const projectService = new ProjectService();