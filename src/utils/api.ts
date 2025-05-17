import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { message } from 'antd';

// 创建axios实例
const axiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
axiosInstance.interceptors.request.use(
  (config) => {
    // 从localStorage或sessionStorage获取token
    const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
    
    // 如果存在token且不是跳过认证的请求，则添加到请求头
    if (token && !config.headers.skipAuth) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
axiosInstance.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    // 处理错误响应
    if (error.response) {
      // 服务器返回错误状态码
      const { status, data } = error.response;
      
      // 处理401未授权错误
      if (status === 401) {
        // 清除token
        localStorage.removeItem('access_token');
        sessionStorage.removeItem('access_token');
        
        // 重定向到登录页
        window.location.href = '/login';
        message.error('登录已过期，请重新登录');
      } else if (status === 403) {
        message.error('权限不足，无法执行此操作');
      } else if (status === 404) {
        message.error('请求的资源不存在');
      } else if (status === 500) {
        message.error('服务器错误，请稍后重试');
      } else {
        // 显示服务器返回的错误信息
        message.error(data.detail || '请求失败');
      }
    } else if (error.request) {
      // 请求已发送但没有收到响应
      message.error('无法连接到服务器，请检查网络连接');
    } else {
      // 请求配置出错
      message.error('请求配置错误');
    }
    
    return Promise.reject(error);
  }
);

// API工具类
export const api = {
  get: <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    return axiosInstance.get(url, config);
  },
  
  post: <T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
    return axiosInstance.post(url, data, config);
  },
  
  put: <T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
    return axiosInstance.put(url, data, config);
  },
  
  delete: <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    return axiosInstance.delete(url, config);
  },
};
