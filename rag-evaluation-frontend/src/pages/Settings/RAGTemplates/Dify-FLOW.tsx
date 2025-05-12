import React, { useEffect } from 'react';
import { Modal, Form, Input, Button, Collapse } from 'antd';
import { labelWithTip } from '../utils';
import { handleTestAndSaveGeneric } from './rag-request';
import flow1 from './img/flow_1.png';
import flow2 from './img/flow_2.png';
import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';

const { Panel } = Collapse;

const DifyFlow: React.FC<{
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
    // 自动组装inputs为{"字段名": "{{question}}"}
    const field = values.inputField || 'query';
    const newValues = { ...values, inputs: JSON.stringify({ [field]: '{{question}}' }) };
    onSave(newValues);
  };

  const handleTestAndSave = () =>
    handleTestAndSaveGeneric({
      form,
      setLoading,
      onSave: (values) => {
        const field = values.inputField || 'query';
        const newValues = { ...values, inputs: JSON.stringify({ [field]: '{{question}}' }) };
        onSave(newValues);
      },
      key: 'dify_flow',
    });

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
          inputField: 'query',
          ...initialValues
        }}
      >
        <Form.Item name="name" label={labelWithTip('配置名称', '自定义本配置的名称，便于区分多个RAG系统账号')} rules={[{ required: true, message: '请输入配置名称' }]}>
          <Input placeholder="Dify-FLOW" />
        </Form.Item>
        <Form.Item name="url" label={labelWithTip('API接口地址', 'Dify的API接口地址')} rules={[{ required: true, message: '请输入API接口地址' }]}>
          <Input placeholder="https://api.dify.ai/v1/chat-messages" />
        </Form.Item>
        <Form.Item name="apiKey" label={labelWithTip('API密钥', 'Dify的API密钥')} rules={[{ required: true, message: '请输入API密钥' }]}>
          <Input.Password placeholder="app-..." />
        </Form.Item>
        <Form.Item
          name="inputField"
          label={labelWithTip('输入字段', '目前只支持一个输入字段，评测时问题会作为输入字段的值')}
          rules={[{ required: true, message: '请输入输入字段名' }]}
        >
          <Input placeholder="query" />
        </Form.Item>
      </Form>
      <Collapse style={{ marginTop: 16 }}>
        <Panel header="参数说明与获取方法（点击展开）" key="1">
          <div style={{ marginBottom: 12 }}>
            <b>API接口地址</b>：请在 Dify 控制台的应用详情页获取，通常以 <code>https://api.dify.ai/v1/chat-messages</code> 开头。
          </div>
          <div style={{ marginBottom: 12 }}>
            <b>API密钥</b>：在 Dify 控制台"API密钥"页面生成并复制。
          </div>
          <div style={{ marginBottom: 12 }}>
            <b>输入字段</b>：如 <code>query</code>，评测时问题会作为该字段的值。
          </div>
          {/* 示例图片，工作流API Key说明 */}
          <PhotoProvider>
            <div style={{ marginBottom: 12 }}>
              <PhotoView src={flow1}>
                <img src={flow1} alt="API密钥获取示例" style={{ width: '100%', maxWidth: 400, borderRadius: 6, boxShadow: '0 1px 4px #e0e0e0', cursor: 'pointer' }} />
              </PhotoView>
              <div style={{ color: '#888', fontSize: 13 }}>如上图，复制API Key填入表单</div>
            </div>
            {/* 示例图片，输入字段说明 */}
            <div style={{ marginBottom: 12 }}>
              <PhotoView src={flow2}>
                <img src={flow2} alt="输入字段说明" style={{ width: '100%', maxWidth: 400, borderRadius: 6, boxShadow: '0 1px 4px #e0e0e0', cursor: 'pointer' }} />
              </PhotoView>
              <div style={{ color: '#888', fontSize: 13 }}>如上图，查看工作流输入字段的配置方法</div>
            </div>
          </PhotoProvider>
        </Panel>
      </Collapse>
    </Modal>
  );
};

export default DifyFlow;
