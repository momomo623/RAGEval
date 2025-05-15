import React, { useEffect } from 'react';
import { Modal, Form, Input, Button, Collapse, message } from 'antd';
import { labelWithTip } from '../utils';
import { ragRequestService } from './ragRequestService';
import chatflow1 from './img/chat_flow_1.png';
import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';
const { Panel } = Collapse;

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
    }
  }, [open, initialValues, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    onSave(values);
  };

  const handleTestAndSave = async () => {
    try {
      // 1. 验证表单
      const values = await form.validateFields();

      // 2. 设置加载状态
      setLoading(true);
      message.loading({ content: '正在测试连接...', key: 'testConnection' });

      // 3. 测试配置
      const result = await ragRequestService.testConfig(values, 'dify_chatflow');

      // 4. 处理测试结果
      if (result.success) {
        message.success({ content: '测试成功!', key: 'testConnection' });
        onSave(values);
      } else {
        message.error({ content: `测试失败: ${result.error}`, key: 'testConnection' });
      }
    } catch (err: any) {
      // 5. 处理其他错误
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
      title="RAG系统配置"
      onCancel={onCancel}
      onOk={handleOk}
      destroyOnClose
      width={480}
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
          ...initialValues
        }}
      >
        <Form.Item name="name" label={labelWithTip('配置名称', '自定义本配置的名称，便于区分多个RAG系统账号')} rules={[{ required: true, message: '请输入配置名称' }]}>
          <Input placeholder="Dify-Chatflow" />
        </Form.Item>
        <Form.Item name="url" label={labelWithTip('API接口地址', 'Dify的API接口地址')} rules={[{ required: true, message: '请输入API接口地址' }]}>
          <Input placeholder="https://api.dify.ai/v1/chat-messages" />
        </Form.Item>
        <Form.Item name="apiKey" label={labelWithTip('API密钥', 'Dify的API密钥')} rules={[{ required: true, message: '请输入API密钥' }]}>
          <Input.Password placeholder="app-..." />
        </Form.Item>
      </Form>
      <Collapse style={{ marginTop: 16 }}>
        <Panel header="参数说明与获取方法（点击展开）" key="1">
          <div style={{ marginBottom: 12 }}>
            <b>API接口地址</b>：通常以 <code>https://你的域名/v1/chat-messages</code> 开头。
          </div>
          <div style={{ marginBottom: 12 }}>
            <b>API密钥</b>：在 Dify 生成并复制。
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
    </Modal>
  );
};

export default DifyChatflow;
