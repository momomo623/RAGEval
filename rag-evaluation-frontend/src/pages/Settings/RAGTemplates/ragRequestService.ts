/**
 * RAG请求服务模块
 *
 * 该模块提供了统一的RAG（检索增强生成）系统请求接口，支持多种RAG系统类型，
 * 包括RAGFlow、Dify和自定义RAG系统。所有请求均采用流式响应方式，提供更好的用户体验。
 *
 */

import { message } from 'antd';
import OpenAI from 'openai';
import { ConfigManager, RAGConfig } from '@utils/configManager';

/**
 * 从嵌套对象中提取指定路径的值
 *
 * 该函数用于从复杂的嵌套对象中，根据点分隔的路径字符串提取特定位置的值。
 * 例如，从 {data: {user: {name: 'John'}}} 中提取 'data.user.name'
 *
 * @param {any} obj - 要提取值的源对象
 * @param {string} path - 点分隔的路径字符串，如 'data.user.name'
 * @returns {any} 提取的值，如果路径无效则返回 undefined
 */
function extractFromPath(obj: any, path: string): any {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * 简单的协议适配：如果URL没有协议，添加http://
 */
function ensureProtocol(url: string): string {
  if (url.includes('://')) {
    return url;
  }
  return `http://${url}`;
}

/**
 * 智能请求：先尝试直接请求，HTTPS->HTTP失败时自动使用代理
 */
async function smartFetch(url: string, options: RequestInit): Promise<Response> {
  try {
    // 第一次尝试：直接请求
    return await fetch(url, options);
  } catch (error: any) {
    // 检查是否是HTTPS->HTTP的混合内容错误
    const isHttpsPage = window.location.protocol === 'https:';
    const isHttpRequest = url.startsWith('http://');
    const isMixedContentError = isHttpsPage && isHttpRequest && 
      (error.message?.includes('Mixed Content') || 
       error.message?.includes('ERR_SSL_PROTOCOL_ERROR') ||
       error.message?.includes('ERR_FAILED'));
    
    if (isMixedContentError) {
      console.log('直接请求失败，使用后端代理:', url);
      // 第二次尝试：使用后端代理
      return await fetch('/api/v1/rag/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url,
          method: options.method || 'POST',
          headers: Object.fromEntries(new Headers(options.headers).entries()),
          body: options.body ? JSON.parse(options.body as string) : null,
          timeout: 60
        })
      });
    }
    
    // 如果不是混合内容错误，直接抛出原错误
    throw error;
  }
}

/**
 * RAGFlowClient类 - 用于与RAGFlow API进行交互
 *
 * 该类封装了与RAGFlow API的通信逻辑，使用OpenAI SDK进行流式请求。
 * 主要用于处理RAGFlow类型的聊天请求，并提供流式响应接口。
 * 支持协议自适应，解决HTTPS环境下的混合内容问题。
 */
class RAGFlowClient {
  /** OpenAI客户端实例 */
  private client: OpenAI;
  /** 基础URL地址 */
  private baseURL: string;

  /**
   * 创建RAGFlowClient实例
   *
   * @param {string} address - RAGFlow服务器地址
   * @param {string} chatId - 聊天ID
   * @param {string} apiKey - API密钥
   * @param {string} protocol - 强制使用的协议 (http/https)，不指定则自动适配
   */
  constructor(address: string, chatId: string, apiKey: string) {
    this.baseURL = `${ensureProtocol(address)}/api/v1/chats_openai/${chatId}`;
    this.client = new OpenAI({
      apiKey,
      baseURL: this.baseURL,
      dangerouslyAllowBrowser: true,
    });
  }

  /**
   * 流式聊天完成请求
   *
   * 先尝试使用OpenAI SDK直接请求，失败时自动使用代理模式。
   *
   * @param {string} question - 用户问题
   * @yields {string} 响应内容片段
   * @throws {Error} 请求异常时抛出错误
   */
  async* streamChatCompletion(question: string) {
    try {
      // 第一次尝试：使用OpenAI SDK直接请求
      const stream = await this.client.chat.completions.create({
        model: 'model',
        messages: [{ role: 'user', content: question }],
        stream: true,
      });

      // 处理流式响应
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          yield content;
        }
      }
    } catch (err: any) {
      // 检查是否是HTTPS->HTTP的混合内容错误
      const isHttpsPage = window.location.protocol === 'https:';
      const isHttpRequest = this.baseURL.startsWith('http://');
      const isMixedContentError = isHttpsPage && isHttpRequest && 
        (err.message?.includes('Mixed Content') || 
         err.message?.includes('ERR_SSL_PROTOCOL_ERROR') ||
         err.message?.includes('ERR_FAILED'));

      if (isMixedContentError) {
        console.log('RAGFlow直接请求失败，使用代理模式');
        yield* this.streamCompletionViaProxy(question);
      } else {
        throw new Error(err.message || '请求异常');
      }
    }
  }

  /**
   * 通过代理进行流式聊天完成请求
   */
  private async* streamCompletionViaProxy(question: string) {
    const requestBody = {
      model: 'model',
      messages: [{ role: 'user', content: question }],
      stream: true,
    };

    const response = await fetch('/api/v1/rag/proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: this.baseURL,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.client.apiKey}`,
          'Accept': 'text/event-stream'
        },
        body: requestBody,
        timeout: 60
      })
    });

    if (!response.ok) {
      throw new Error(`代理请求失败: ${response.status}`);
    }

    // 处理流式响应
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('无法读取响应流');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              yield content;
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }
  }
}

/**
 * RAG请求服务类 - 统一处理各种RAG系统的请求
 *
 * 该类提供了统一的接口来处理不同类型的RAG系统请求，
 * 包括RAGFlow、Dify和自定义RAG系统。所有请求均采用流式响应方式。
 */
export class RAGRequestService {
  /** 配置管理器实例 */
  private configManager: ConfigManager;

  /**
   * 创建RAG请求服务实例
   */
  constructor() {
    this.configManager = ConfigManager.getInstance();
  }

  /**
   * 统一的流式请求接口
   *
   * 根据配置键获取RAG配置，并根据配置类型调用相应的处理函数。
   * 所有RAG系统的请求都通过这个统一接口进行，简化上层代码。
   *
   * @param {string} configKey - 格式为 "type/name" 的配置键
   * @param {string} question - 用户问题
   * @yields {string} 响应内容片段
   */
  async* streamRequest(configKey: string, question: string) {
    try {
      // 解析配置键
      const [type, name] = configKey.split('/');
      if (!type || !name) {
        throw new Error('无效的配置键格式，应为 "type/name"');
      }

      // 获取RAG配置
      const config = await this.configManager.findRAGConfigByTypeAndName(type, name);
      if (!config) {
        throw new Error(`未找到RAG配置: ${configKey}`);
      }

      // 根据RAG类型选择对应的处理函数
      switch (config.type) {
        case 'ragflow_chat':
          yield* this.streamRAGFlowChat(config as any, question);
          break;
        case 'dify_chatflow':
          yield* this.streamDifyChatflow(config, question);
          break;
        case 'dify_flow':
          yield* this.streamDifyFlow(config as any, question);
          break;
        case 'custom':
          yield* this.streamCustomRAG(config, question);
          break;
        default:
          throw new Error(`不支持的RAG系统类型: ${config.type}`);
      }
    } catch (error: any) {
      console.error('RAG请求错误:', error);
      yield `[错误] ${error.message || '未知错误'}`;
    }
  }

  /**
   * RAGFlow Chat流式请求
   *
   * 使用RAGFlowClient处理RAGFlow类型的聊天请求。
   *
   * @param {any} config - RAGFlow配置
   * @param {string} question - 用户问题
   * @yields {string} 响应内容片段
   * @throws {Error} 配置不完整时抛出错误
   */
  private async* streamRAGFlowChat(config: any, question: string) {
    // 验证必要的配置参数
    if (!config.address || !config.chatId || !config.apiKey) {
      throw new Error('RAGFlow配置不完整，需要address、chatId和apiKey');
    }

    // 创建RAGFlow客户端并发送请求
    const client = new RAGFlowClient(config.address, config.chatId, config.apiKey);
    yield* client.streamChatCompletion(question);
  }

  /**
   * 自定义RAG系统流式请求
   *
   * 处理自定义RAG系统的请求，支持SSE流式响应和普通JSON响应。
   * 增强HTTPS环境下的混合内容处理能力。
   *
   * @param {RAGConfig} config - 自定义RAG配置
   * @param {string} question - 用户问题
   * @yields {string} 响应内容片段
   * @throws {Error} 配置不完整或请求失败时抛出错误
   */
  private async* streamCustomRAG(config: RAGConfig, question: string) {
    // 验证URL配置
    if (!config.url) {
      throw new Error('自定义RAG配置缺少URL');
    }

    // 确保URL包含协议
    let requestUrl = ensureProtocol(config.url);

    // 准备请求头
    const headers = typeof config.requestHeaders === 'string'
      ? JSON.parse(config.requestHeaders || '{}')
      : (config.requestHeaders || { "Content-Type": "application/json" });

    // 准备请求体
    let requestTemplate = typeof config.requestTemplate === 'string'
      ? JSON.parse(config.requestTemplate || '{}')
      : (config.requestTemplate || {});

    // 替换模板中的{{question}}占位符
    const requestBody = JSON.stringify(
      JSON.parse(JSON.stringify(requestTemplate).replace(/{{question}}/g, question))
    );

    // 记录请求信息
    console.log(`发送自定义RAG请求:`, {
      originalUrl: config.url,
      adaptedUrl: requestUrl,
      headers: Object.keys(headers),
      hasAuthHeader: headers.Authorization ? '是' : '否',
      currentProtocol: window.location.protocol
    });

    try {
      // 使用智能请求：先直接请求，失败时自动代理
      const response = await smartFetch(requestUrl, {
        method: 'POST',
        headers,
        body: requestBody,
      });

      // 处理错误响应
      if (!response.ok) {
        let errMsg = `HTTP错误: ${response.status}`;
        try {
          const errJson = await response.json();
          errMsg = errJson.message || errJson.error || errMsg;
        } catch {}
        throw new Error(errMsg);
      }

      // 处理成功响应
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream')) {
        // SSE流式处理
        yield* this.handleStreamResponse(response, config);
      } else {
        // 非流式响应，一次性返回
        yield* this.handleNonStreamResponse(response, config);
      }
      
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * 处理流式响应
   */
  private async* handleStreamResponse(response: Response, config: RAGConfig) {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    if (!reader) {
      throw new Error('无法读取响应流');
    }

    // 循环读取流数据
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // 解码并处理数据
      buffer += decoder.decode(value, { stream: true });
      let lines = buffer.split('\n');
      buffer = lines.pop() || '';

      // 处理每一行SSE数据
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.replace('data: ', '').trim();
          if (jsonStr && jsonStr !== '[DONE]') {
            try {
              // 解析JSON数据
              const eventData = JSON.parse(jsonStr);

              // 根据事件字段和值提取内容
              if (
                config.streamEventField &&
                config.streamEventValue &&
                eventData[config.streamEventField] === config.streamEventValue
              ) {
                // 提取内容块
                const chunkText = extractFromPath(eventData, config.responsePath || '') || '';
                if (chunkText) yield chunkText;
              } else if (!config.streamEventField) {
                // 如果没有指定事件字段，直接从响应路径提取
                const chunkText = extractFromPath(eventData, config.responsePath || '') || '';
                if (chunkText) yield chunkText;
              }
            } catch (e) {
              // 忽略解析失败的行
            }
          }
        }
      }
    }
  }

  /**
   * 处理非流式响应
   */
  private async* handleNonStreamResponse(response: Response, config: RAGConfig) {
    const data = await response.json();
    const result = extractFromPath(data, config.responsePath || '');
    if (result) {
      yield result;
    } else {
      throw new Error('响应数据格式无效');
    }
  }

  /**
   * Dify Chatflow流式请求
   *
   * 处理Dify Chatflow类型的请求，将其转换为自定义RAG请求。
   * 自动处理Dify的授权头，使用Bearer Token格式。
   * 使用统一的配置格式，与CustomRAG保持一致。
   *
   * @param {any} config - Dify Chatflow配置
   * @param {string} question - 用户问题
   * @yields {string} 响应内容片段
   */
  private async* streamDifyChatflow(config: any, question: string) {
    // 解析请求头
    let headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.requestHeaders) {
      try {
        const customHeaders = typeof config.requestHeaders === 'string'
          ? JSON.parse(config.requestHeaders)
          : config.requestHeaders;
        Object.assign(headers, customHeaders);
      } catch (e) {
        console.warn('解析requestHeaders失败，使用默认值:', e);
      }
    }

    // 添加Authorization头
    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    // 组装自定义配置，使用统一格式
    const customConfig: any = {
      ...config,
      requestHeaders: JSON.stringify(headers),
      requestTemplate: config.requestTemplate || JSON.stringify({
        "inputs": {},
        "query": "{{question}}",
        "response_mode": "streaming",
        "conversation_id": "",
        "user": "user-" + Date.now().toString()
      }),
      responsePath: config.responsePath || "answer",
      streamEventField: config.streamEventField || "event",
      streamEventValue: config.streamEventValue || "message"
    };

    // 调用通用自定义RAG请求
    yield* this.streamCustomRAG(customConfig, question);
  }

  /**
   * Dify Flow流式请求
   *
   * 处理Dify Flow类型的请求，将其转换为自定义RAG请求。
   * 自动处理Dify的授权头，使用Bearer Token格式。
   * 使用统一的配置格式，与CustomRAG保持一致。
   *
   * @param {any} config - Dify Flow配置
   * @param {string} question - 用户问题
   * @yields {string} 响应内容片段
   */
  private async* streamDifyFlow(config: any, question: string) {
    // 解析请求头
    let headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.requestHeaders) {
      try {
        const customHeaders = typeof config.requestHeaders === 'string'
          ? JSON.parse(config.requestHeaders)
          : config.requestHeaders;
        Object.assign(headers, customHeaders);
      } catch (e) {
        console.warn('解析requestHeaders失败，使用默认值:', e);
      }
    }

    // 添加Authorization头
    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    // 如果没有requestTemplate，使用inputField自动生成
    let requestTemplate = config.requestTemplate;
    if (!requestTemplate || requestTemplate === '') {
      const field = config.inputField || 'query';
      requestTemplate = JSON.stringify({
        "inputs": { [field]: "{{question}}" },
        "response_mode": "streaming",
        "user": "user-" + Date.now().toString()
      });
    }

    // 组装自定义配置，使用统一格式
    const customConfig: any = {
      ...config,
      requestHeaders: JSON.stringify(headers),
      requestTemplate: requestTemplate,
      responsePath: config.responsePath || "data.text",
      streamEventField: config.streamEventField || "event",
      streamEventValue: config.streamEventValue || "text_chunk"
    };

    // 调用通用自定义RAG请求
    yield* this.streamCustomRAG(customConfig, question);
  }

  /**
   * 测试RAG配置
   *
   * 使用测试问题验证RAG配置是否有效，并返回测试结果。
   *
   * @param {string} configKey - 格式为 "type/name" 的配置键
   * @returns {Promise<Object>} 测试结果对象，包含成功状态和内容或错误信息
   */
  async testRAGConfig(configKey: string): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      const testQuestion = "测试问题";
      let content = '';

      // 使用流式接口收集响应
      for await (const chunk of this.streamRequest(configKey, testQuestion)) {
        content += chunk;
        // 收集一定量的内容后就认为测试成功
        if (content.length > 10) break;
      }

      return { success: true, content };
    } catch (error: any) {
      return { success: false, error: error.message || '测试失败' };
    }
  }

  /**
   * 测试RAG配置对象
   *
   * 直接使用配置对象进行测试，而不是通过配置键查找。
   * 这个方法主要用于在保存配置前进行测试。
   *
   * @param {any} config - RAG配置对象
   * @param {string} type - 配置类型 (ragflow_chat, dify_chatflow, dify_flow, custom)
   * @returns {Promise<Object>} 测试结果对象，包含成功状态和内容或错误信息
   */
  async testConfig(config: any, type: string): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      const testQuestion = "测试问题";
      let content = '';

      // 根据配置类型选择对应的处理函数
      switch (type) {
        case 'ragflow_chat':
          for await (const chunk of this.streamRAGFlowChat(config, testQuestion)) {
            content += chunk;
            // 收集一定量的内容后就认为测试成功
            if (content.length > 10) break;
          }
          break;
        case 'dify_chatflow':
          for await (const chunk of this.streamDifyChatflow(config, testQuestion)) {
            content += chunk;
            if (content.length > 10) break;
          }
          break;
        case 'dify_flow':
          for await (const chunk of this.streamDifyFlow(config, testQuestion)) {
            content += chunk;
            if (content.length > 10) break;
          }
          break;
        case 'custom':
          for await (const chunk of this.streamCustomRAG(config, testQuestion)) {
            content += chunk;
            if (content.length > 10) break;
          }
          break;
        default:
          throw new Error(`不支持的RAG系统类型: ${type}`);
      }

      return { success: true, content };
    } catch (error: any) {
      return { success: false, error: error.message || '测试失败' };
    }
  }
}

// 导出单例实例
export const ragRequestService = new RAGRequestService();
