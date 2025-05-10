import React from 'react';
import { Modal, Form, Input } from 'antd';
import { labelWithTip } from '../utils';

const DifyChatflow: React.FC<{
  open: boolean;
  onCancel: () => void;
  onSave: (values: any) => void;
  initialValues: any;
}> = ({ open, onCancel, onSave, initialValues }) => {
  const [form] = Form.useForm();

  const handleOk = async () => {
    const values = await form.validateFields();
    onSave(values);
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
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={initialValues || {}}
      >
        <Form.Item name="name" label={labelWithTip('配置名称', '自定义本配置的名称，便于区分多个RAG系统账号')} rules={[{ required: true, message: '请输入配置名称' }]}>
          <Input placeholder="Dify-FLOW" />
        </Form.Item>
        <Form.Item name="url" label={labelWithTip('API接口地址', 'Dify的API接口地址')} rules={[{ required: true, message: '请输入API接口地址' }]}>
          <Input placeholder="https://api.dify.ai/v1/chat-messages" />
        </Form.Item>
        <Form.Item name="apiKey" label={labelWithTip('API密钥', 'Dify的API密钥')} rules={[{ required: true, message: '请输入API密钥' }]}>
          <Input.Password placeholder="sk-..." />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default DifyChatflow;
