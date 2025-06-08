import React, { useEffect } from 'react';
import { Modal, Form, Input, Button, Collapse, Alert, message, Typography } from 'antd';
import { labelWithTip } from '../utils';
import { ragRequestService } from './ragRequestService';
import ragflowKey from './img/ragflow-key.png';
import ragflowKey_1 from './img/ragflow_chat_1.png';
import ragflowKey_2 from './img/ragflow_chat_2.png';
import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';

const { Panel } = Collapse;
const { Text } = Typography;

interface RAGFlowChatProps {
  open: boolean;
  onCancel: () => void;
  onSave: (values: any) => void;
  initialValues?: any;
}

const RAGFlowChat: React.FC<RAGFlowChatProps> = ({
  open,
  onCancel,
  onSave,
  initialValues
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);

  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue(initialValues || {});
      // 初始化时同步配置
      syncConfigurations();
    }
  }, [open, initialValues, form]);

  // 同步简单配置到高级配置
  const syncConfigurations = () => {
    const address = form.getFieldValue('address') || 'localhost:8000';
    const chatId = form.getFieldValue('chatId') || 'default-chat';
    const apiKey = form.getFieldValue('apiKey') || '';
    
    // 自动生成完整URL
    const fullUrl = `http://${address}/api/v1/chats_openai/${chatId}/chat/completions`;
    
    // 生成请求头
    const headers = {
      "Content-Type": "application/json",
      ...(apiKey && { "Authorization": `Bearer ${apiKey}` })
    };
    
    // 生成请求体模板（RAGFlow使用OpenAI格式）
    const template = {
      "model": "model",
      "messages": [{ "role": "user", "content": "{{question}}" }],
      "stream": true
    };
    
    form.setFieldsValue({
      url: fullUrl,
      requestHeaders: JSON.stringify(headers, null, 2),
      requestTemplate: JSON.stringify(template, null, 2)
    });
  };

  // 监听配置变化，自动同步
  const handleConfigChange = () => {
    // 延迟同步，确保表单值已更新
    setTimeout(() => {
      syncConfigurations();
    }, 0);
  };

  const handleTestAndSave = async () => {
    try {
      // 1. 验证表单
      const values = await form.validateFields();

      // 2. 确保配置已同步
      syncConfigurations();
      const finalValues = form.getFieldsValue();

      // 3. 设置加载状态
      setLoading(true);
      message.loading({ content: '正在测试连接...', key: 'testConnection' });

      // 4. 测试配置
      const result = await ragRequestService.testConfig(finalValues, 'ragflow_chat');

      // 5. 处理测试结果
      if (result.success) {
        message.success({ content: '测试成功!', key: 'testConnection' });
        onSave(finalValues);
      } else {
        message.error({ content: `测试失败: ${result.error}`, key: 'testConnection' });
      }
    } catch (err: any) {
      // 6. 处理其他错误
      message.destroy('testConnection');

      const errorMessage = err.message
        ? `错误: ${err.message}`
        : '发生未知错误，请检查网络连接或联系管理员';

      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleOk = async () => {
    const values = await form.validateFields();
    // 保存前确保配置已同步
    syncConfigurations();
    const finalValues = form.getFieldsValue();
    onSave(finalValues);
  };

  return (
    <Modal
      title="RAG系统配置 - RAGFlow Chat"
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      destroyOnClose
      width={720}
      okText="保存"
      footer={[
        <Button key="test" type="primary" loading={loading} onClick={handleTestAndSave}>测试并保存</Button>,
        <Button key="cancel" onClick={onCancel}>取消</Button>,
      ]}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          name: 'RAGFlow对话',
          address: 'localhost:8000',
          chatId: 'default-chat',
          url: 'http://localhost:8000/api/v1/chats_openai/default-chat/chat/completions',
          requestHeaders: '{"Content-Type": "application/json"}',
          requestTemplate: '{"model": "model", "messages": [{"role": "user", "content": "{{question}}"}], "stream": true}',
          ...initialValues
        }}
      >
        {/* 基础配置 */}
        <Form.Item
          name="name"
          label={labelWithTip('配置名称', '为这个RAG系统配置取一个名字')}
          rules={[{ required: true, message: '请输入配置名称' }]}
        >
          <Input placeholder="如：我的RAGFlow-Chat" />
        </Form.Item>

        <Form.Item
          name="address"
          label={labelWithTip('服务器地址', '服务器的IP地址或域名，修改后会自动生成完整的API地址')}
          rules={[{ required: true, message: '请输入服务器地址' }]}
        >
          <Input 
            placeholder="localhost:8000" 
            onChange={handleConfigChange}
          />
        </Form.Item>

        <Form.Item
          name="chatId"
          label={labelWithTip('Chat ID', '对话ID，用于标识特定的对话上下文，修改后会自动生成完整的API地址')}
          rules={[{ required: true, message: '请输入Chat ID' }]}
        >
          <Input 
            placeholder="default-chat" 
            onChange={handleConfigChange}
          />
        </Form.Item>

        <Form.Item
          name="apiKey"
          label={labelWithTip('API密钥', 'Bearer Token形式的API密钥，修改后会自动同步到下方高级配置中')}
          rules={[{ required: true, message: '请输入API密钥' }]}
        >
          <Input.Password 
            placeholder="Bearer Token" 
            onChange={handleConfigChange}
          />
        </Form.Item>



        {/* 高级配置面板 */}
        <Collapse style={{ marginTop: 16 }}>
          <Panel header="高级配置" key="advanced">
            <div style={{ marginBottom: 12, padding: '8px', background: '#f0f8ff', borderRadius: '4px', fontSize: '13px' }}>
              <Text type="secondary">
                💡 RAGFlow Chat 使用 OpenAI 兼容的接口规范，如需完全自定义配置，请使用"自定义RAG系统"。
              </Text>
            </div>

            <Form.Item
              name="url"
              label={labelWithTip('完整API地址', '由服务器地址和Chat ID自动拼接生成，使用OpenAI兼容的接口路径')}
            >
              <Input.TextArea 
                rows={2}
                readOnly
                style={{ 
                  fontFamily: 'monospace', 
                  backgroundColor: '#f5f5f5',
                  color: '#666'
                }}
              />
            </Form.Item>

            <Form.Item
              name="requestHeaders"
              label={labelWithTip('请求头', '由API密钥自动生成，包含Authorization字段（OpenAI标准）')}
            >
              <Input.TextArea 
                rows={4}
                readOnly
                style={{ 
                  fontFamily: 'monospace', 
                  backgroundColor: '#f5f5f5',
                  color: '#666'
                }}
              />
            </Form.Item>

            <Form.Item
              name="requestTemplate"
              label={labelWithTip('请求体模板', '标准的OpenAI Chat Completions格式，RAGFlow完全兼容')}
            >
              <Input.TextArea 
                rows={6}
                readOnly
                style={{ 
                  fontFamily: 'monospace', 
                  backgroundColor: '#f5f5f5',
                  color: '#666'
                }}
              />
            </Form.Item>
          </Panel>
        </Collapse>

        {/* 参数说明面板 */}
        <Collapse style={{ marginTop: 16 }}>
          <Panel header="参数说明与获取方法（点击展开）" key="help">
            <div style={{ marginBottom: 12, padding: '8px', background: '#e8f5e8', borderRadius: '4px', fontSize: '13px' }}>
              <b>🔄 OpenAI 兼容接口</b>：RAGFlow Chat 使用标准的 OpenAI Chat Completions API 格式，与 OpenAI GPT 接口完全兼容。
            </div>
            <div style={{ marginBottom: 12 }}>
              <b>服务器地址</b>：RAGFlow服务的地址，如 <code>localhost:8000</code> 或 <code>your-domain.com</code>
            </div>
            <div style={{ marginBottom: 12 }}>
              <b>Chat ID</b>：用于区分不同的聊天助手，修改后会自动生成完整的API地址。
            </div>
            <div style={{ marginBottom: 12 }}>
              <b>完整API地址</b>：最终请求的地址，使用OpenAI标准路径格式：
              <div style={{ color: '#000', background: "#f5f5f5", padding: 5, borderRadius: 4, marginTop: 10, fontFamily: 'monospace' }}>
                http://{`{address}`}/api/v1/chats_openai/{`{chatId}`}/chat/completions
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <b>API密钥</b>：Bearer Token形式的认证密钥，修改后会自动生成对应的请求头配置（符合OpenAI标准）。
            </div>
            <div style={{ marginBottom: 12 }}>
              <b>请求格式</b>：使用标准的OpenAI Chat Completions格式：
              <pre style={{ color: '#000', background: "#f5f5f5", padding: 8, borderRadius: 4, marginTop: 8, fontSize: '12px', margin: 0 }}>
{`{
  "model": "model",
  "messages": [{"role": "user", "content": "用户问题"}],
  "stream": true
}`}
              </pre>
            </div>
            <div style={{ marginBottom: 12, padding: '8px', background: '#fff7e6', borderRadius: '4px', fontSize: '13px' }}>
              <b>⚠️ 注意</b>：RAGFlow Chat完全兼容OpenAI接口标准，如果您需要完全自定义请求头和请求体模板，建议使用"自定义RAG系统"配置类型。
            </div>
            
            <PhotoProvider>
              <div style={{ marginBottom: 12 }}>
                <PhotoView src={ragflowKey_1}>
                  <img
                    src={ragflowKey_1}
                    alt="Chat ID获取示例1"
                    style={{
                      width: '100%',
                      maxWidth: 400,
                      borderRadius: 6,
                      boxShadow: '0 1px 4px #e0e0e0',
                      cursor: 'pointer'
                    }}
                  />
                </PhotoView>
                <PhotoView src={ragflowKey_2}>
                  <img
                    src={ragflowKey_2}
                    alt="Chat ID获取示例2"
                    style={{
                      width: '100%',
                      maxWidth: 400,
                      borderRadius: 6,
                      boxShadow: '0 1px 4px #e0e0e0',
                      cursor: 'pointer'
                    }}
                  />
                </PhotoView>
                <div style={{ color: '#888', fontSize: 13 }}>如上图，获取Chat ID的方法说明</div>
              </div>
            </PhotoProvider>
            
            <PhotoProvider>
              <div style={{ marginBottom: 12 }}>
                <PhotoView src={ragflowKey}>
                  <img
                    src={ragflowKey}
                    alt="API密钥获取示例"
                    style={{
                      width: '100%',
                      maxWidth: 400,
                      borderRadius: 6,
                      boxShadow: '0 1px 4px #e0e0e0',
                      cursor: 'pointer'
                    }}
                  />
                </PhotoView>
                <div style={{ color: '#888', fontSize: 13 }}>如上图，获取API密钥的方法说明</div>
              </div>
            </PhotoProvider>
          </Panel>
        </Collapse>
      </Form>
    </Modal>
  );
};

export default RAGFlowChat;