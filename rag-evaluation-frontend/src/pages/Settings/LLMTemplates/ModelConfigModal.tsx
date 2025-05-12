import React, { useEffect } from 'react';
import { Modal, Form, Input, Button, message } from 'antd';
import JsonEditorField from '@components/JsonEditorField';
import { labelWithTip } from '../utils';
import { requestLLM, ChatCompletionMessageParam } from './llm-request';

const ModelConfigModal: React.FC<{
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

  // 使用 requestLLM 进行测试
  const handleTestAndSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      message.loading('正在测试模型连通性...', 0);
      const messages: ChatCompletionMessageParam[] = [
        { role: 'user', content: '你好' }
      ];
      let additionalParams: any = {};
      if (values.additionalParams) {
        try {
          additionalParams = JSON.parse(values.additionalParams);
        } catch {
          additionalParams = {};
        }
      }
      const result = await requestLLM({
        baseUrl: values.baseUrl,
        apiKey: values.apiKey,
        modelName: values.modelName,
        messages,
        additionalParams
      });
      message.destroy();
      if (result.success) {
        const content = result.data.choices?.[0]?.message?.content;
        message.success('连接成功！收到响应: ' + (content ? content.substring(0, 20) + '...' : '无内容'));
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
  };

  const handleOk = async () => {
    const values = await form.validateFields();
    onSave(values);
  };
  return (
    <Modal
      open={open}
      title="大模型配置"
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
          <Input placeholder="如：OpenAI主账号" />
        </Form.Item>
        <Form.Item
          name="baseUrl"
          label={labelWithTip('BASE_URL', 'OpenAI API的基础URL，如 https://api.openai.com/v1')}
          rules={[{ required: true, message: '请输入BASE_URL' }]}
        >
          <Input placeholder="https://api.openai.com/v1" />
        </Form.Item>
        <Form.Item
          name="apiKey"
          label={labelWithTip('API_KEY', 'OpenAI或兼容API的密钥')}
          rules={[{ required: true, message: '请输入API_KEY' }]}
        >
          <Input.Password placeholder="sk-..." />
        </Form.Item>
        <Form.Item
          name="modelName"
          label={labelWithTip('模型名称', '如gpt-4、deepseek等，具体见API文档')}
          rules={[{ required: true, message: '请输入模型名称' }]}
        >
          <Input placeholder="gpt-4" />
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
          <JsonEditorField placeholder='{"temperature": 0.1}' height='auto' />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ModelConfigModal; 