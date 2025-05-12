import { message } from 'antd';
import { ConfigManager, RAGConfig } from '@utils/configManager';
import OpenAI from 'openai';

// RAGFlow请求客户端封装
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

// custom RAG系统请求
export async function requestCustomRAG(config: any, question: string) {
  try {
    const headers = JSON.parse(config.requestHeaders || '{}');
    const requestTemplate = JSON.parse(config.requestTemplate || '{}');
    // 替换模板中的{{question}}
    const requestBody = JSON.stringify(
      JSON.parse(
        JSON.stringify(requestTemplate).replace(/{{question}}/g, question)
      )
    );
    const response = await fetch(config.url, {
      method: 'POST',
      headers,
      body: requestBody,
    });
    if (!response.ok) {
      let errMsg = `HTTP错误: ${response.status}`;
      try {
        const errJson = await response.json();
        errMsg = errJson.message || errMsg;
      } catch {}
      throw new Error(errMsg);
    }
    // 如果状态码不是2xx,直接返回错误
    if (!response.ok) {
      let errMsg = `HTTP错误: ${response.status}`;
      try {
        const errJson = await response.json();
        errMsg = errJson.message || errMsg;
      } catch {}
      return { success: false, error: errMsg };
    }

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
    return { success: false, error: err.message || '请求异常' };
  }
}

// Dify-Chatflow请求
export async function requestDifyChatflow(config: any, question: string) {
  // 组装 customRAG 参数
  const customConfig = {
    url: config.url,
    requestHeaders: JSON.stringify({
      "Authorization": `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    }),
    requestTemplate: JSON.stringify({
      "inputs": {},
      "query": "{{question}}",
      "response_mode": "streaming",
      "conversation_id": "",
      "user": "abc-123"
    }),
    responsePath: "answer",
    streamEventField: "event",
    streamEventValue: "message",
    ...config // 保留其他自定义参数
  };
  return await requestCustomRAG(customConfig, question);
}

// Dify-FLOW请求
export async function requestDifyFlow(config: any, question: string) {
  // 组装 inputs 字段
  let inputs = { query: "{{question}}" };
  if (config.inputs) {
    try {
      inputs = JSON.parse(config.inputs);
    } catch {}
  }
  // 替换 inputs 内的 {{question}}
  const replaceInObj = (obj: any) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = obj[key].replace(/{{question}}/g, question);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        replaceInObj(obj[key]);
      }
    }
  };
  // 组装 customRAG 参数
  const customConfig = {
    url: config.url,
    requestHeaders: JSON.stringify({
      "Authorization": `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    }),
    requestTemplate: JSON.stringify({
      "inputs": inputs,
      "response_mode": "streaming",
      "user": "abc-123"
    }),
    responsePath: "data.text",
    streamEventField: "event",
    streamEventValue: "text_chunk",
    ...config // 保留其他自定义参数
  };
  return await requestCustomRAG(customConfig, question);
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
    let buffer = '';
    // 这里假设RAGFlowClient支持流式for await
    // 如果不支持，需要在RAGFlowClient中实现
    for await (const chunk of client.streamChatCompletion(question)) {
      yield chunk;
    }
    return;
  }
  if (config.type === 'custom' || config.type === 'dify_chatflow' || config.type === 'dify_flow') {
    // 通用流式SSE
    const headers = JSON.parse(config.requestHeaders || '{}');
    const requestTemplate = JSON.parse(config.requestTemplate || '{}');
    const requestBody = JSON.stringify(
      JSON.parse(JSON.stringify(requestTemplate).replace(/{{question}}/g, question))
    );
    const response = await fetch(config.url, {
      method: 'POST',
      headers,
      body: requestBody,
    });
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
