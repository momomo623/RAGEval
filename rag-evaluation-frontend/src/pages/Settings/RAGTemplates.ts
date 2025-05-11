export const RAG_TEMPLATES = [
  {
    key: 'custom',
    name: '自定义RAG系统',
    desc: '自定义RAG系统配置',
    logo: '/logo.png',
    defaultConfig: {
      name: '',
      url: '',
      requestHeaders: '{"Content-Type": "application/json"}',
      requestTemplate: '{"query": "{{question}}"}',
      responsePath: 'answer',
      streamEventField: '',
      streamEventValue: '',
      type: 'custom'
    }
  },
  {
    key: 'dify_chatflow',
    name: 'Dify-Chatflow',
    desc: '支持记忆的复杂多轮对话工作流',
    logo: '/llm_logo/dify_logo.png',
    defaultConfig: {
      name: '',
      url: '',
      apiKey: '',
      type: 'dify_chatflow',
      requestHeaders: '{"Authorization": "Bearer 你的密钥", "Content-Type": "application/json"}',
      requestTemplate: '{"inputs": {}, "query": "{{question}}", "response_mode": "streaming", "conversation_id": "", "user": "abc-123"}',
      responsePath: 'answer',
      streamEventField: 'event',
      streamEventValue: 'message',
    }
  },
  {
    key: 'dify_flow',
    name: 'Dify-工作流',
    desc: '面向单轮自动化任务的编排工作流',
    logo: '/llm_logo/dify_logo.png',
    defaultConfig: {
      name: '',
      url: '',
      apiKey: '',
      type: 'dify_flow',
      requestHeaders: '{"Authorization": "Bearer 你的密钥", "Content-Type": "application/json"}',
      requestTemplate: '{"inputs": { "query": "{{question}}" }, "response_mode": "streaming", "user": "abc-123"}',
      responsePath: 'data.text',
      streamEventField: 'event',
      streamEventValue: 'text_chunk',
    }
  },

]; 