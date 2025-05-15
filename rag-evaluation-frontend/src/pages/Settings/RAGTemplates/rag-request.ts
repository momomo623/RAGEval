import { message } from 'antd';
import { ConfigManager, RAGConfig } from '@utils/configManager';
import OpenAI from 'openai';

/*
  * RAGFlowClient类用于与RAGFlow API进行交互
  * 主要功能包括发送聊天请求和处理流式响应
  * 使用OpenAI SDK进行API调用
*/
class RAGFlowClient {
  private client: OpenAI;
  private baseURL: string;

  constructor(address: string, chatId: string, apiKey: string) {
    this.baseURL = `http://${address}/api/v1/chats_openai/${chatId}`;
    this.client = new OpenAI({
      apiKey,
      baseURL: this.baseURL,
      dangerouslyAllowBrowser: true,
    });
  }

  async chatCompletion(question: string, onChunk: (text: string) => void) {
    try {
      const stream = await this.client.chat.completions.create({
        model: 'model',
        messages: [{ role: 'user', content: question }],
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          onChunk(content);
        }
      }
    } catch (err: any) {
      throw new Error(err.message || '请求异常');
    }
  }

  async* streamChatCompletion(question: string) {
    try {
      const stream = await this.client.chat.completions.create({
        model: 'model',
        messages: [{ role: 'user', content: question }],
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          yield content;
        }
      }
    } catch (err: any) {
      throw new Error(err.message || '请求异常');
    }
  }
}

// RAGFlow-Chat 请求处理
export async function requestRAGFlowChat(config: any, question: string) {
  try {
    let content = '';
    const client = new RAGFlowClient(config.address, config.chatId, config.apiKey);

    await client.chatCompletion(
      question,
      (chunk) => {
        content += chunk;
      }
    );

    return { success: true, content };
  } catch (err: any) {
    return { success: false, error: err.message || '请求异常' };
  }
}

// 测试RAGFlow配置
export async function testRAGFlowChat(config: any) {
  try {
    const client = new RAGFlowClient(config.address, config.chatId, config.apiKey);
    const testContent = await new Promise<string>((resolve, reject) => {
      let content = '';
      client.chatCompletion(
        '测试问题',
        (chunk) => {
          content += chunk;
        }
      )
      .then(() => resolve(content))
      .catch(reject);
    });

    return { success: true, content: testContent };
  } catch (err: any) {
    return { success: false, error: err.message || '连接测试失败' };
  }
}

// 通用：从嵌套对象提取值
function extractFromPath(obj: any, path: string): any {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

// 通用SSE流式响应处理，支持多配置
async function parseSSEStreamWithConfig(response: Response, config: any) {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let content = '';
  if (!reader) return '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.replace('data: ', '').trim();
        if (jsonStr && jsonStr !== '[DONE]') {
          try {
            const eventData = JSON.parse(jsonStr);
            if (
              config.streamEventField &&
              config.streamEventValue &&
              eventData[config.streamEventField] === config.streamEventValue
            ) {
              // 提取内容块
              const chunkText = extractFromPath(eventData, config.responsePath || '') || '';
              if (chunkText) content += chunkText;
            }
          } catch (e) {
            // 忽略解析失败的行
          }
        }
      }
    }
  }
  return content;
}

/**
 * 处理请求头，根据配置类型设置不同的授权方式
 * @param config 配置对象
 * @param configType 配置类型，如 'custom', 'dify_flow', 'dify_chatflow'
 * @returns 处理后的请求头对象
 */
function prepareRequestHeaders(config: any, configType: string = 'custom'): Record<string, string> {
  // 如果是Dify类型，使用Bearer授权
  if (configType.startsWith('dify_') && config.apiKey) {
    return {
      "Authorization": `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      ...(config.additionalHeaders || {})
    };
  }

  // 如果是自定义类型，直接使用用户提供的请求头
  if (configType === 'custom' && config.requestHeaders) {
    try {
      return JSON.parse(config.requestHeaders || '{}');
    } catch (e) {
      console.error('解析请求头失败:', e);
      return { "Content-Type": "application/json" };
    }
  }

  // 默认返回基本请求头
  return { "Content-Type": "application/json" };
}

// custom RAG系统请求
export async function requestCustomRAG(config: any, question: string, configType: string = 'custom') {
  try {
    // 根据配置类型准备请求头
    const headers = configType === 'custom'
      ? JSON.parse(config.requestHeaders || '{}')
      : prepareRequestHeaders(config, configType);

    // 获取请求模板
    let requestTemplate = JSON.parse(config.requestTemplate || '{}');

    // 确保Dify请求包含必要的参数
    if (configType.startsWith('dify_')) {
      // 确保有user参数
      if (!requestTemplate.user) {
        requestTemplate.user = "user-" + Date.now().toString();
      }

      // 确保有response_mode参数
      if (!requestTemplate.response_mode) {
        requestTemplate.response_mode = "blocking";
      }

      // 对于dify_flow类型，确保有inputs参数
      if (configType === 'dify_flow' && !requestTemplate.inputs) {
        const inputField = config.inputField || 'query';
        requestTemplate.inputs = { [inputField]: "{{question}}" };
      }

      // 对于dify_chatflow类型，确保有query参数
      if (configType === 'dify_chatflow' && !requestTemplate.query) {
        requestTemplate.query = "{{question}}";
      }
    }

    // 替换模板中的{{question}}
    const requestBody = JSON.stringify(
      JSON.parse(
        JSON.stringify(requestTemplate).replace(/{{question}}/g, question)
      )
    );

    console.log(`发送${configType}请求:`, {
      url: config.url,
      headers: Object.keys(headers),
      hasAuthHeader: headers.Authorization ? '是' : '否'
    });

    const response = await fetch(config.url, {
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
        console.error('请求失败:', errMsg);
      } catch {}
      return { success: false, error: errMsg };
    }

    // 处理成功响应
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/event-stream')) {
      const content = await parseSSEStreamWithConfig(response, config);
      if (!content) {
        return { success: false, error: 'SSE响应无有效内容' };
      }
      return { success: true, content };
    } else {
      const data = await response.json();
      const result = extractFromPath(data, config.responsePath || '');
      if (!result) {
        return { success: false, error: '响应数据格式无效' };
      }
      return { success: true, content: result };
    }
  } catch (err: any) {
    console.error('请求异常:', err); 
    return { success: false, error: err.message || '请求异常' };
  }
}

// Dify-Chatflow请求
export async function requestDifyChatflow(config: any, question: string) {
  // 组装请求模板
  const requestTemplate = {
    "inputs": {},
    "query": "{{question}}",
    "response_mode": "streaming",
    "conversation_id": "",
    "user": "abc-123"
  };

  // 组装 customRAG 参数
  const customConfig = {
    url: config.url,
    requestTemplate: JSON.stringify(requestTemplate),
    responsePath: "answer",
    streamEventField: "event",
    streamEventValue: "message",
    apiKey: config.apiKey, // 直接传递apiKey，让prepareRequestHeaders处理
    ...config // 保留其他自定义参数
  };

  // 调用通用请求函数，指定为dify_chatflow类型
  return await requestCustomRAG(customConfig, question, 'dify_chatflow');
}

// Dify-FLOW请求
export async function requestDifyFlow(config: any, question: string) {
  // 组装 inputs 字段
  let inputs = { query: "{{question}}" };
  if (config.inputs) {
    try {
      inputs = JSON.parse(config.inputs);
    } catch (e) {
      console.warn('解析inputs失败，使用默认值:', e);
    }
  }

  // 组装请求模板
  const requestTemplate = {
    "inputs": inputs,
    "response_mode": "streaming",
    "user": "abc-123"
  };

  // 组装 customRAG 参数
  const customConfig = {
    url: config.url,
    requestTemplate: JSON.stringify(requestTemplate),
    responsePath: "data.text",
    streamEventField: "event",
    streamEventValue: "text_chunk",
    apiKey: config.apiKey, // 直接传递apiKey，让prepareRequestHeaders处理
    ...config // 保留其他自定义参数
  };

  // 调用通用请求函数，指定为dify_flow类型
  return await requestCustomRAG(customConfig, question, 'dify_flow');
}

// 统一入口
export async function requestRAGByKey(key: string, config: any, question: string) {
  if (key === 'custom') {
    return await requestCustomRAG(config, question);
  }
  if (key === 'dify_chatflow') {
    return await requestDifyChatflow(config, question);
  }
  if (key === 'dify_flow') {
    return await requestDifyFlow(config, question);
  }
  if (key === 'ragflow_chat') {
    return await requestRAGFlowChat(config, question);
  }
  return { success: false, error: '未知RAG系统类型' };
}

// 新增通过配置ID请求RAG的函数
export async function requestRAGByConfigId(configId: string, question: string) {
  const configManager = ConfigManager.getInstance();
  const config = await configManager.getConfig<RAGConfig>(configId, 'rag');
  if (!config) {
    throw new Error('Configuration not found');
  }
  return await requestRAGByKey(config.type, config, question);
}

export async function testRAGConfig(config: any, question: string, key: string) {
  if (key === 'ragflow_chat') {
    return await testRAGFlowChat(config);
  }
  return await requestRAGByKey(key, config, question);
}

export async function handleTestAndSaveGeneric({
  form,
  setLoading,
  onSave,
  key,
}: {
  form: any;
  setLoading: (v: boolean) => void;
  onSave: (values: any) => void;
  key: string;
}) {
  try {
    // 1. 首先验证表单
    const values = await form.validateFields();
    setLoading(true);
    message.loading({ content: '正在测试连接...', key: 'testConnection' });

    // 2. 测试连接
    const result = await testRAGConfig(values, '测试问题', key);

    // 3. 清除加载提示
    message.destroy('testConnection');

    // 4. 处理测试结果
    if (result.success && result.content) {
      // 确保返回的内容存在且有效
      message.success('连接成功，配置已保存');
      onSave(values);
    } else {
      // 提供更详细的错误信息
      const errorMessage = result.error
        ? `测试失败: ${result.error}`
        : '测试失败: 服务器返回的数据格式无效';
      message.error(errorMessage);
    }
  } catch (err: any) {
    // 5. 处理其他错误（如网络错误、表单验证错误等）
    message.destroy('testConnection');

    const errorMessage = err.message
      ? `错误: ${err.message}`
      : '发生未知错误，请检查网络连接或联系管理员';

    message.error(errorMessage);
  } finally {
    setLoading(false);
  }
}

// 新增：流式 async generator 接口
export async function* streamRAGResponse(config: any, question: string) {
  // 兼容多种RAG类型
  if (config.type === 'ragflow_chat') {
    // RAGFlow流式
    const client = new RAGFlowClient(config.address, config.chatId, config.apiKey);
    // 这里假设RAGFlowClient支持流式for await
    // 如果不支持，需要在RAGFlowClient中实现
    for await (const chunk of client.streamChatCompletion(question)) {

      console.log("RAGFlow流式 ",chunk)
      yield chunk;
    }
    return;
  }

  if (config.type === 'custom' || config.type === 'dify_chatflow' || config.type === 'dify_flow') {
    // 根据配置类型准备请求头
    const headers = config.type.startsWith('dify_')
      ? prepareRequestHeaders(config, config.type)
      : JSON.parse(config.requestHeaders || '{}');

    // 获取请求模板
    let requestTemplate = JSON.parse(config.requestTemplate || '{}');

    // 确保Dify请求包含必要的参数
    if (config.type.startsWith('dify_')) {
      // 确保有user参数
      if (!requestTemplate.user) {
        requestTemplate.user = "user-" + Date.now().toString();
      }

      // 确保有response_mode参数
        requestTemplate.response_mode = "blocking";

      // 对于dify_flow类型，确保有inputs参数
      if (config.type === 'dify_flow' && !requestTemplate.inputs) {
        const inputField = config.inputField || 'query';
        requestTemplate.inputs = { [inputField]: "{{question}}" };
      }

      // 对于dify_chatflow类型，确保有query参数
      if (config.type === 'dify_chatflow' && !requestTemplate.query) {
        requestTemplate.query = "{{question}}";
      }
    }

    // 替换模板中的{{question}}
    const requestBody = JSON.stringify(
      JSON.parse(JSON.stringify(requestTemplate).replace(/{{question}}/g, question))
    );

    console.log(`流式请求${config.type}:`, {
      url: config.url,
      headers: Object.keys(headers),
      hasAuthHeader: headers.Authorization ? '是' : '否'
    });

    const response = await fetch(config.url, {
      method: 'POST',
      headers,
      body: requestBody,
    });

    if (!response.ok) {
      console.error(`流式请求失败: HTTP ${response.status}`);
      let errorMsg = `HTTP错误: ${response.status}`;
      try {
        const errJson = await response.json();
        errorMsg = errJson.message || errJson.error || errorMsg;
      } catch {}
      yield `[错误] ${errorMsg}`;
      return;
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/event-stream')) {
      // SSE流式
      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      if (!reader) return;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.replace('data: ', '').trim();
            if (jsonStr && jsonStr !== '[DONE]') {
              try {
                const eventData = JSON.parse(jsonStr);
                if (
                  config.streamEventField &&
                  config.streamEventValue &&
                  eventData[config.streamEventField] === config.streamEventValue
                ) {
                  // 提取内容块
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
      return;
    } else {
      // 非流式，直接yield一次
      const data = await response.json();
      const result = extractFromPath(data, config.responsePath || '');
      if (result) yield result;
      return;
    }
  }
  // 其他类型可扩展
}
