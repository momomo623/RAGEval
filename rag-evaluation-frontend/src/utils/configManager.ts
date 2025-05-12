import { v4 as uuidv4 } from 'uuid';
import { authService } from '../services/auth.service';

// 配置类型定义
export interface BaseConfig {
  id: string;           // 配置的唯一标识
  name: string;         // 配置名称
  type: string;         // 配置类型（如 'openai', 'dify_chatflow' 等）
  userId: string;       // 用户ID
  createdAt: number;    // 创建时间
  updatedAt: number;    // 更新时间
}

export interface ModelConfig extends BaseConfig {
  baseUrl: string;
  apiKey: string;
  modelName: string;
  additionalParams?: Record<string, any>;
}

export interface RAGConfig extends BaseConfig {
  url: string;
  apiKey?: string;
  requestHeaders?: Record<string, any>;
  requestTemplate?: Record<string, any>;
  responsePath?: string;
  streamEventField?: string;
  streamEventValue?: string;
}

// 用户配置存储结构
interface UserConfigs {
  models: ModelConfig[];
  rags: RAGConfig[];
}

export class ConfigManager {
  private static instance: ConfigManager;
  private readonly STORAGE_KEY = 'rag_eval_user_configs';
  private currentUserId: string | null = null;

  private constructor() {
    this.initializeUserId();
  }

  private async initializeUserId() {
    const userInfo = await authService.getCurrentUser();
    this.currentUserId = userInfo?.id || null;
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  // 更新当前用户ID
  public async updateCurrentUserId(): Promise<void> {
    const userInfo = await authService.getCurrentUser();
    this.currentUserId = userInfo?.id || null;
  }

  // 获取当前用户ID
  public getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  // 获取用户所有配置
  private getUserConfigs(): UserConfigs {
    if (!this.currentUserId) {
      return { models: [], rags: [] };
    }
    const configs = localStorage.getItem(`${this.STORAGE_KEY}_${this.currentUserId}`);
    return configs ? JSON.parse(configs) : { models: [], rags: [] };
  }

  // 保存用户所有配置
  private saveUserConfigs(configs: UserConfigs): void {
    if (!this.currentUserId) {
      console.warn('Attempting to save configs without user ID');
      return;
    }
    localStorage.setItem(`${this.STORAGE_KEY}_${this.currentUserId}`, JSON.stringify(configs));
  }

  // 创建新配置
  public async createConfig<T extends BaseConfig>(config: Omit<T, 'id' | 'userId' | 'createdAt' | 'updatedAt'>, type: 'model' | 'rag'): Promise<T> {
    await this.updateCurrentUserId();
    const newConfig = {
      ...config,
      id: uuidv4(),
      userId: this.currentUserId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as T;

    const userConfigs = this.getUserConfigs();
    if (type === 'model') {
      userConfigs.models.push(newConfig as unknown as ModelConfig);
    } else {
      userConfigs.rags.push(newConfig as unknown as RAGConfig);
    }
    this.saveUserConfigs(userConfigs);
    return newConfig;
  }

  // 更新配置
  public async updateConfig<T extends ModelConfig | RAGConfig>(configId: string, updates: Partial<T>, type: 'model' | 'rag'): Promise<T | null> {
    await this.updateCurrentUserId();
    const userConfigs = this.getUserConfigs();
    const configs = type === 'model' ? userConfigs.models : userConfigs.rags;
    const index = configs.findIndex(c => c.id === configId);
    
    if (index === -1) return null;
    
    // 验证配置是否属于当前用户
    if (configs[index].userId !== this.currentUserId) {
      return null;
    }
    
    // 移除不应该被更新的字段
    const { id, userId, createdAt, ...safeUpdates } = updates as any;
    
    const updatedConfig = {
      ...configs[index],
      ...safeUpdates,
      updatedAt: Date.now(),
    } as T;

    configs[index] = updatedConfig;
    this.saveUserConfigs(userConfigs);
    return updatedConfig;
  }

  // 删除配置
  public async deleteConfig(configId: string, type: 'model' | 'rag'): Promise<boolean> {
    await this.updateCurrentUserId();
    const userConfigs = this.getUserConfigs();
    const configs = type === 'model' ? userConfigs.models : userConfigs.rags;
    const index = configs.findIndex(c => c.id === configId);
    
    if (index === -1) return false;

    configs.splice(index, 1);
    this.saveUserConfigs(userConfigs);
    return true;
  }

  // 获取配置
  public async getConfig<T extends BaseConfig>(configId: string, type: 'model' | 'rag'): Promise<T | null> {
    await this.updateCurrentUserId();
    const userConfigs = this.getUserConfigs();
    const configs = type === 'model' ? userConfigs.models : userConfigs.rags;
    return  configs.find(c => c.id === configId) as unknown as T || null;
  }

  // 获取所有配置
  public async getAllConfigs<T extends BaseConfig>(type: 'model' | 'rag'): Promise<T[]> {
    await this.updateCurrentUserId();
    const userConfigs = this.getUserConfigs();
    return (type === 'model' ? userConfigs.models : userConfigs.rags) as unknown as T[];
  }

  // 根据名称和类型查找配置
  public async findConfigByNameAndType(name: string, type: string, configType: 'model' | 'rag'): Promise<BaseConfig | null> {
    await this.updateCurrentUserId();
    const userConfigs = this.getUserConfigs();
    const configs = configType === 'model' ? userConfigs.models : userConfigs.rags;
    return configs.find(c => c.name === name && c.type === type) || null;
  }

  // 清除当前用户所有配置
  public async clearUserConfigs(): Promise<void> {
    if (!this.currentUserId) return;
    localStorage.removeItem(`${this.STORAGE_KEY}_${this.currentUserId}`);
  }
}
