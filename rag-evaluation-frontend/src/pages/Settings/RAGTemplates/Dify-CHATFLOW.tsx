import React, { useEffect } from 'react';
import { Modal, Form, Input, Button, Collapse, message, Typography } from 'antd';
import { labelWithTip } from '../utils';
import { ragRequestService } from './ragRequestService';
import chatflow1 from './img/chat_flow_1.png';
import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';
const { Panel } = Collapse;
const { Text } = Typography;

const DifyChatflow: React.FC<{
  open: boolean;
  onCancel: () => void;
  onSave: (values: any) => void;
  initialValues: any;
}> = ({ open, onCancel, onSave, initialValues }) => {
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
    const apiKey = form.getFieldValue('apiKey') || '';
    
    // 同步请求头
    const headers = {
      "Content-Type": "application/json",
      ...(apiKey && { "Authorization": `Bearer ${apiKey}` })
    };
    
    // 同步请求体模板
    const template = {
      "inputs": {},
      "query": "{{question}}",
      "response_mode": "streaming",
      "conversation_id": "",
      "user": "user"
    };
    
    form.setFieldsValue({
      requestHeaders: JSON.stringify(headers, null, 2),
      requestTemplate: JSON.stringify(template, null, 2)
    });
  };

  // 监听API密钥变化，自动同步到请求头
  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 延迟同步，确保表单值已更新
    setTimeout(() => {
      syncConfigurations();
    }, 0);
  };

  const handleOk = async () => {
    const values = await form.validateFields();
    // 保存前确保配置已同步
    syncConfigurations();
    const finalValues = form.getFieldsValue();
    onSave(finalValues);
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
      const result = await ragRequestService.testConfig(finalValues, 'dify_chatflow');

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

  return (
    <Modal
      open={open}
      title="RAG系统配置 - Dify Chatflow"
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
          url: 'https://api.dify.ai/v1/chat-messages',
          requestHeaders: '{"Content-Type": "application/json"}',
          requestTemplate: '{"inputs": {}, "query": "{{question}}", "response_mode": "streaming", "conversation_id": "", "user": "user"}',
          responsePath: 'answer',
          streamEventField: 'event',
          streamEventValue: 'message',
          ...initialValues
        }}
      >
        {/* 基础配置 */}
        <Form.Item name="name" label={labelWithTip('配置名称', '自定义本配置的名称，便于区分多个RAG系统账号')} rules={[{ required: true, message: '请输入配置名称' }]}>
          <Input placeholder="Dify-Chatflow" />
        </Form.Item>
        <Form.Item name="url" label={labelWithTip('API接口地址', 'Dify的API接口地址')} rules={[{ required: true, message: '请输入API接口地址' }]}>
          <Input placeholder="https://api.dify.ai/v1/chat-messages" />
        </Form.Item>
        <Form.Item name="apiKey" label={labelWithTip('API密钥', 'Dify的API密钥，修改后会自动同步到下方高级配置中')} rules={[{ required: true, message: '请输入API密钥' }]}>
          <Input.Password 
            placeholder="app-..." 
            onChange={handleApiKeyChange}
          />
        </Form.Item>

        {/* 高级配置面板 */}
        <Collapse style={{ marginTop: 16 }}>
          <Panel header="高级配置" key="advanced">
            <div style={{ marginBottom: 12, padding: '8px', background: '#f0f8ff', borderRadius: '4px', fontSize: '13px' }}>
              <Text type="secondary">
                💡 如需完全自定义配置，请使用"自定义RAG系统"。
              </Text>
            </div>

            <Form.Item
              name="requestHeaders"
              label={labelWithTip('请求头', '由API密钥自动生成，包含Authorization字段')}
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
              label={labelWithTip('请求体模板', '标准的Dify Chatflow请求格式')}
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

            <Form.Item
              name="responsePath"
              label={labelWithTip('响应数据路径', '从响应JSON中提取回答的路径')}
              rules={[{ required: true, message: '请输入响应路径' }]}
            >
              <Input placeholder="answer" />
            </Form.Item>

            <Form.Item
              name="streamEventField"
              label={labelWithTip('事件类型字段', '流式响应中的事件类型字段名，如：event。如没有，则留空。')}
            >
              <Input placeholder="event（可选）" />
            </Form.Item>

            <Form.Item
              name="streamEventValue"
              label={labelWithTip('事件类型值', '需要处理的事件类型值，如：message')}
            >
              <Input placeholder="message（可选）" />
            </Form.Item>
          </Panel>
        </Collapse>

        {/* 参数说明面板 */}
        <Collapse style={{ marginTop: 16 }}>
          <Panel header="参数说明与获取方法（点击展开）" key="help">
            <div style={{ marginBottom: 12 }}>
              <b>API接口地址</b>：通常以 <code>https://你的域名/v1/chat-messages</code> 开头。
            </div>
            <div style={{ marginBottom: 12 }}>
              <b>API密钥</b>：在 Dify 生成并复制，修改后会自动生成对应的请求头和请求体配置。
            </div>
            <div style={{ marginBottom: 12 }}>
              <b>高级配置</b>：请求头和请求体模板由基础配置自动生成，确保配置的正确性和一致性。
            </div>
            <div style={{ marginBottom: 12, padding: '8px', background: '#fff7e6', borderRadius: '4px', fontSize: '13px' }}>
              <b>⚠️ 注意</b>：如果您需要完全自定义请求头和请求体模板，建议使用"自定义RAG系统"配置类型，它提供了完全的配置自由度。
            </div>
            {/* 示例图片，Chatflow相关 */}
            <PhotoProvider>
              <div style={{ marginBottom: 12 }}>
                <PhotoView src={chatflow1}>
                  <img src={chatflow1} alt="Chatflow参数说明" style={{ width: '100%', maxWidth: 400, borderRadius: 6, boxShadow: '0 1px 4px #e0e0e0', cursor: 'pointer' }} />
                </PhotoView>
                <div style={{ color: '#888', fontSize: 13 }}>如上图，获取Chatflow相关参数和API Key</div>
              </div>
            </PhotoProvider>
          </Panel>
        </Collapse>
      </Form>
    </Modal>
  );
};

export default DifyChatflow;
