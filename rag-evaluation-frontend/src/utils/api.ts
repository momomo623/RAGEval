import { message } from 'antd';
import { authService } from '../services/auth.service';

// 获取环境变量中的API基础URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

interface RequestOptions extends RequestInit {
  skipAuth?: boolean; // 是否跳过认证
  params?: Record<string, string | number>; // 可选的查询参数
}

/**
 * 发送API请求的通用函数
 * @param endpoint API路径
 * @param options 请求选项
 * @returns 响应数据
 */
export async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuth = false, params, ...fetchOptions } = options;
  
  // 构建完整的URL
  const buildApiUrl = (endpoint: string): string => {
    // 确保endpoint不以/api开头，因为API_BASE_URL已经包含了
    if (endpoint.startsWith('/api/')) {
      endpoint = endpoint.substring(4); // 去掉/api前缀
    }
    
    // 处理/v1前缀，确保路径格式为/api/v1/...
    if (endpoint.startsWith('/v1/')) {
      return `${API_BASE_URL}${endpoint}`;
    }
    
    // 其他情况，添加/api/v1前缀
    return `${API_BASE_URL}/v1${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  };

  const url = buildApiUrl(endpoint);
  
  // 准备请求头
  const headers = new Headers(fetchOptions.headers);
  
  // 如果未指定Content-Type且是POST/PUT请求，默认设置为JSON
  if (!headers.has('Content-Type') && 
      (options.method === 'POST' || options.method === 'PUT')) {
    headers.set('Content-Type', 'application/json');
  }
  
  // 添加认证信息
  if (!skipAuth) {
    const token = authService.getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
      console.log('DEBUG - 添加认证头:', {
        url: url,
        token: token.substring(0, 15) + '...' // 只显示令牌前15个字符，保护安全
      });
    } else {
      console.log('DEBUG - 未找到令牌，请求将发送无认证头:', url);
    }
  }
  
  // 执行请求前添加详细调试信息
  console.log('DEBUG - 完整请求信息:', {
    method: fetchOptions.method || 'GET',
    url: url,
    params: options.params ? JSON.stringify(options.params) : undefined,
    hasAuthHeader: headers.has('Authorization')
  });
  
  // 执行请求
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers
    });
    
    // 在接收到响应后添加
    console.log('DEBUG - 收到响应:', {
      status: response.status,
      url: url
    });
    
    // 处理常见HTTP错误
    if (!response.ok) {
      let errorMessage = `请求失败: ${response.status}`;
      
      // 尝试解析错误详情
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorMessage;
      } catch (e) {
        // 忽略解析错误
      }
      
      // 特殊处理401错误（未授权）
      if (response.status === 401) {
        // 清除过期的认证信息
        authService.logout();
      }
      
      throw new Error(errorMessage);
    }
    
    // 对于204 No Content响应，返回空对象
    if (response.status === 204) {
      return {} as T;
    }
    
    // 解析响应数据
    return await response.json() as T;
  } catch (error) {
    console.error('API请求错误:', error);
    // 将错误以更友好的方式显示给用户
    message.error(error instanceof Error ? error.message : '请求失败，请稍后重试');
    throw error;
  }
}

// 常用HTTP方法的简化函数
export const api = {
  /**
   * 发送GET请求
   */
  get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    // 确保params参数被正确附加到URL
    if (options && options.params) {
      // 转换params对象为查询字符串
      const queryParams = new URLSearchParams();
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
      
      // 如果有参数，附加到URL
      const queryString = queryParams.toString();
      if (queryString) {
        endpoint += (endpoint.includes('?') ? '&' : '?') + queryString;
      }
      
      // 移除params防止重复添加
      const { params, ...restOptions } = options;
      return apiRequest<T>(endpoint, { ...restOptions, method: 'GET' });
    }
    
    return apiRequest<T>(endpoint, { ...options, method: 'GET' });
  },
  
  /**
   * 发送POST请求
   */
  post<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<T> {
    return apiRequest<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
  },
  
  /**
   * 发送PUT请求
   */
  put<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<T> {
    return apiRequest<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    });
  },
  
  /**
   * 发送DELETE请求
   */
  delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return apiRequest<T>(endpoint, { ...options, method: 'DELETE' });
  }
}; 