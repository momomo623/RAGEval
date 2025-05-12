import { message } from 'antd';

// Dify Chatflow 预制模板
const DIFY_CHATFLOW_TEMPLATE = {
  requestHeaders: (apiKey: string) => ({
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  }),
  requestTemplate: {
    "inputs": {},
    "query": "{{question}}",
    "response_mode": "streaming",
    "conversation_id": "",
    "user": "abc-123"
  },
  responsePath: "answer",
  streamEventField: "event",
  streamEventValue: "message"
};

// Dify Flow 预制模板
const DIFY_FLOW_TEMPLATE = {
  requestHeaders: (apiKey: string) => ({
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  }),
  requestTemplate: {
    "inputs": { "query": "{{question}}" },
    "response_mode": "streaming",
    "user": "abc-123"
  },
  responsePath: "data.text",
  streamEventField: "event",
  streamEventValue: "text_chunk"
};

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
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/event-stream')) {
      const content = await parseSSEStreamWithConfig(response, config);
      return { success: true, content: content || '[SSE无内容]' };
    } else {
      const data = await response.json();
      const result = extractFromPath(data, config.responsePath || '');
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
  return { success: false, error: '未知RAG系统类型' };
}

export async function testRAGConfig(config: any, question: string, key: string) {
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
    const values = await form.validateFields();
    setLoading(true);
    message.loading('正在测试连接...', 0);
    const result = await testRAGConfig(values, '测试问题', key);
    message.destroy();
    if (result.success) {
      message.success('连接成功，配置已保存');
      onSave(values);
    } else {
      message.error('测试失败: ' + (result.error || '未知错误'));
    }
  } catch (err: any) {
    message.destroy();
    message.error(err.message || '表单校验失败');
  } finally {
    setLoading(false);
  }
}
