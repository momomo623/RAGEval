import React, { useEffect } from 'react';
import { Modal, Form, Input, Button, message } from 'antd';
import { labelWithTip } from '../utils';
import JsonEditorField from '@components/JsonEditorField';
import { ragRequestService } from '../../../services/ragRequestService';

const CustomRAG: React.FC<{
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
      const result = await ragRequestService.testConfig(values, 'custom');

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
      title="自定义RAG系统配置"
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
      >
        <Form.Item name="name" label={labelWithTip('配置名称', '自定义本配置的名称')} rules={[{ required: true, message: '请输入配置名称' }]}>
          <Input placeholder="自定义RAG系统" />
        </Form.Item>
        <Form.Item name="url" label={labelWithTip('API接口地址', 'RAG系统的API接口地址')} rules={[{ required: true, message: '请输入API接口地址' }]}>
          <Input placeholder="https://your-rag-api.com" />
        </Form.Item>
        <Form.Item
          name="requestHeaders"
          label={labelWithTip('请求头', '配置HTTP请求头，包括认证信息')}
          rules={[
            { required: true, message: '请输入请求头' },
            {
              validator: (_, value) => {
                try {
                  JSON.parse(value);
                  return Promise.resolve();
                } catch {
                  return Promise.reject('请输入有效的JSON格式');
                }
              }
            }
          ]}
          valuePropName="value"
          getValueFromEvent={v => v}
        >
          <JsonEditorField placeholder='{"Content-Type": "application/json"}'  />
        </Form.Item>
        <Form.Item
          name="requestTemplate"
          label={labelWithTip('请求模板', '使用{{question}}作为问题占位符')}
          rules={[
            { required: true, message: '请输入请求模板' },
            {
              validator: (_, value) => {
                try {
                  JSON.parse(value);
                  return Promise.resolve();
                } catch {
                  return Promise.reject('请输入有效的JSON格式');
                }
              }
            }
          ]}
          valuePropName="value"
          getValueFromEvent={v => v}
        >
          <JsonEditorField placeholder='{"query": "{{question}}"}'  />
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
          label={labelWithTip('事件类型字段', '有些RAG系统会流式返回多种类型的数据（如图表、文本），这里填写类型的字段名称，如：event。如没有，则留空。')}
          rules={[]}
        >
          <Input placeholder="event（可选）" />
        </Form.Item>
        <Form.Item
          name="streamEventValue"
          label={labelWithTip('事件类型值', '文本类型字段对应的值，如：message/text_chunk')}
          rules={[]}
        >
          <Input placeholder="message（可选）" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CustomRAG;