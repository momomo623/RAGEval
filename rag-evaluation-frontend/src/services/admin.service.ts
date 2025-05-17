import { api } from '../../../src/utils/api';
import { message } from 'antd';

// 数据集接口
interface Dataset {
  id: string;
  user_id: string;
  name: string;
  description: string;
  is_public: boolean;
  tags: string[];
  dataset_metadata: Record<string, any>;
  question_count: number;
  created_at: string;
  updated_at: string;
  user_name?: string; // 添加用户名字段，方便在UI中显示
}

// 项目接口
interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string;
  status: string;
  scoring_scale: string;
  created_at: string;
  updated_at: string;
  user_name?: string; // 添加用户名字段，方便在UI中显示
}

// 用户接口
interface User {
  id: string;
  name: string;
  email: string;
  company: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

class AdminService {
  // 获取所有用户列表
  async getUsers(): Promise<User[]> {
    try {
      return await api.get<User[]>('/v1/users');
    } catch (error) {
      console.error('获取用户列表失败:', error);
      message.error('获取用户列表失败');
      throw error;
    }
  }

  // 获取所有数据集
  async getAllDatasets(): Promise<Dataset[]> {
    try {
      // 获取所有数据集
      const datasets = await api.get<Dataset[]>('/v1/datasets/admin');

      // 获取所有用户，用于关联用户名
      const users = await this.getUsers();

      // 为每个数据集添加用户名
      return datasets.map(dataset => ({
        ...dataset,
        user_name: users.find(user => user.id === dataset.user_id)?.name || '未知用户'
      }));
    } catch (error) {
      console.error('获取所有数据集失败:', error);
      message.error('获取所有数据集失败');
      throw error;
    }
  }

  // 获取所有项目
  async getAllProjects(): Promise<Project[]> {
    try {
      // 获取所有项目
      const projects = await api.get<Project[]>('/v1/projects/admin');

      // 获取所有用户，用于关联用户名
      const users = await this.getUsers();

      // 为每个项目添加用户名
      return projects.map(project => ({
        ...project,
        user_name: users.find(user => user.id === project.user_id)?.name || '未知用户'
      }));
    } catch (error) {
      console.error('获取所有项目失败:', error);
      message.error('获取所有项目失败');
      throw error;
    }
  }

  // 获取系统统计信息
  async getSystemStats(): Promise<any> {
    try {
      const [users, datasets, projects] = await Promise.all([
        this.getUsers(),
        this.getAllDatasets(),
        this.getAllProjects()
      ]);

      return {
        totalUsers: users.length,
        activeUsers: users.filter(u => u.is_active).length,
        adminUsers: users.filter(u => u.is_admin).length,
        totalDatasets: datasets.length,
        publicDatasets: datasets.filter(d => d.is_public).length,
        totalProjects: projects.length
      };
    } catch (error) {
      console.error('获取系统统计信息失败:', error);
      message.error('获取系统统计信息失败');
      throw error;
    }
  }
}

export const adminService = new AdminService();
