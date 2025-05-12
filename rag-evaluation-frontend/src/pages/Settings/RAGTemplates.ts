// 拼接RAGFlow的完整URL
export const getRAGFlowUrl = (address: string, chatId: string) => {
  return `http://${address}/api/v1/chats_openai/${chatId}/chat/completions`;
};

export const RAG_TEMPLATES = [
  {
    key: 'custom',
    name: '自定义RAG系统',
    desc: '自定义RAG系统配置',
    logo: '/logo.png',
    defaultConfig: {
      requestHeaders: `{
  "Content-Type": "application/json"
}`,
      requestTemplate: `{
  "query": "{{question}}"
}`,
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
  {
    key: 'ragflow_chat',
    name: 'RAGFlow-Chat',
    desc: '支持流式输出的OpenAI兼容RAG对话系统',
    logo: '/llm_logo/ragflow_logo.png',
    defaultConfig: {
      name: 'RAGFlow对话',
      address: 'localhost',
      chatId: '',
      apiKey: '',
      type: 'ragflow_chat',
      requestHeaders: `{
  "Authorization": "Bearer 你的密钥",
  "Content-Type": "application/json"
}`,
      requestTemplate: `{
  "model": "model",
  "messages": [{"role": "user", "content": "{{question}}"}],
  "stream": true
}`,
      responsePath: 'choices[0].delta.content',
      streamEventField: 'choices',
      streamEventValue: 'delta'
    }
  }
];

// RAGFlow-Chat API文档：
// POST /api/v1/chats_openai/{chat_id}/chat/completions
// 请求头：
// - Content-Type: application/json
// - Authorization: Bearer <YOUR_API_KEY>
// 请求体：
// {
//   "model": "model",
//   "messages": [{"role": "user", "content": "问题内容"}],
//   "stream": true
// }