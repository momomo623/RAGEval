export const RAG_TEMPLATES = [
  {
    key: 'dify_chatflow',
    name: 'Dify-CHATFLOW模式',
    desc: 'Dify对话流模式，适用于标准RAG对话API',
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
    name: 'Dify-工作流模式',
    desc: 'Dify工作流模式，适用于自定义流程API',
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
  {
    key: 'custom',
    name: '自定义RAG系统',
    desc: '自定义RAG系统配置',
    logo: '/llm_logo/ragflow_logo.png',
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
  }
]; 