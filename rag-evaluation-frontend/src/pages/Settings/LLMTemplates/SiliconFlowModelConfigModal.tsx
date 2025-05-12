import React, { useEffect } from 'react';
import { Modal, Form, Input, Button, message } from 'antd';
import JsonEditorField from '@components/JsonEditorField';
import { labelWithTip } from '../utils';
import { LLMClient, ChatCompletionMessageParam } from './llm-request';

const API_URL = 'https://api.siliconflow.cn/v1';

const SiliconFlowModelConfigModal: React.FC<{
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
      const { baseUrl, ...rest } = initialValues || {};
      form.setFieldsValue(rest);
    }
  }, [open, initialValues, form]);

  const handleTestAndSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      message.loading('正在测试模型连通性...', 0);
      let additionalParams: any = {};
      if (values.additionalParams) {
        try {
          additionalParams = JSON.parse(values.additionalParams);
        } catch {
          additionalParams = {};
        }
      }
      const client = new LLMClient({
        baseUrl: API_URL,
        apiKey: values.apiKey,
        modelName: values.modelName,
      });
      const content = await client.chatCompletion({
        userMessage: '你好',
        additionalParams,
      });
      message.destroy();
      message.success('连接成功！收到响应: ' + (content ? content.substring(0, 20) + '...' : '无内容'));
      
      onSave({
        ...values,
        baseUrl: API_URL,
        additionalParams: values.additionalParams ? JSON.parse(values.additionalParams) : undefined
      });
    } catch (err: any) {
      message.destroy();
      message.error(err.message || '表单校验失败');
    } finally {
      setLoading(false);
    }
  };

  const handleOk = async () => {
    const values = await form.validateFields();
    onSave({
      ...values,
      baseUrl: API_URL,
      additionalParams: values.additionalParams ? JSON.parse(values.additionalParams) : undefined
    });
  };
  return (
    <Modal
      open={open}
      title="硅基流动大模型配置"
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
      >
        <Form.Item
          name="name"
          label={labelWithTip('配置名称', '自定义本配置的名称，便于区分多个模型账号')}
          rules={[{ required: true, message: '请输入配置名称' }]}
        >
          <Input placeholder="如：硅基流动" />
        </Form.Item>
        <Form.Item
          name="apiKey"
          label={labelWithTip('API_KEY', '硅基流动的API密钥')}
          rules={[{ required: true, message: '请输入API密钥' }]}>
          <Input.Password placeholder="token..." />
        </Form.Item>
        <Form.Item
          name="modelName"
          label={labelWithTip('模型名称', '如 Qwen/QwQ-32B，具体见API文档')}
          rules={[{ required: true, message: '请输入模型名称' }]}>
          <Input placeholder="Qwen/QwQ-32B" />
        </Form.Item>
        <Form.Item
          name="additionalParams"
          label={labelWithTip('高级参数(JSON)', '如temperature、max_tokens等，需为合法JSON格式')}
          rules={[{
            validator: (_, value) => {
              if (!value) return Promise.resolve();
              try { JSON.parse(value); return Promise.resolve(); } catch { return Promise.reject('请输入有效的JSON格式'); }
            }
          }]}
          valuePropName="value"
          getValueFromEvent={v => v}
        >
          <JsonEditorField placeholder='{"temperature": 0.7, "max_tokens": 2048}'/>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default SiliconFlowModelConfigModal; 