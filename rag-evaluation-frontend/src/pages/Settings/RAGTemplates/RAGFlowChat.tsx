import React, { useEffect } from 'react';
import { Modal, Form, Input, Button, Collapse, Alert } from 'antd';
import { labelWithTip } from '../utils';
import { handleTestAndSaveGeneric } from './rag-request';
import ragflowKey from './img/ragflow-key.png';
import ragflowKey_1 from './img/ragflow_chat_1.png';
import ragflowKey_2 from './img/ragflow_chat_2.png';
import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';

const { Panel } = Collapse;

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
    }
  }, [open, initialValues, form]);

  const handleTestAndSave = () =>
    handleTestAndSaveGeneric({
      form,
      setLoading,
      onSave,
      key: 'ragflow_chat',
    });

  return (
    <Modal
      title="配置RAGFlow-Chat"
      open={open}
      onCancel={onCancel}
      destroyOnClose
      width={600}
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
          ...initialValues
        }}
      >
        <Form.Item
          name="name"
          label={labelWithTip('配置名称', '为这个RAG系统配置取一个名字')}
          rules={[{ required: true, message: '请输入配置名称' }]}
        >
          <Input placeholder="如：我的RAGFlow-Chat" />
        </Form.Item>

        <Form.Item
          name="address"
          label={labelWithTip('服务器地址', '服务器的IP地址或域名，如：localhost:8000')}
          rules={[{ required: true, message: '请输入服务器地址' }]}
        >
          <Input placeholder="localhost:8000" />
        </Form.Item>

        <Form.Item
          name="chatId"
          label={labelWithTip('Chat ID', '对话ID，用于标识特定的对话上下文')}
          rules={[{ required: true, message: '请输入Chat ID' }]}
        >
          <Input placeholder="default-chat" />
        </Form.Item>

        <Form.Item
          name="apiKey"
          label={labelWithTip('API密钥', 'Bearer Token形式的API密钥')}
          rules={[{ required: true, message: '请输入API密钥' }]}
        >
          <Input.Password placeholder="Bearer Token" />
        </Form.Item>
      </Form>

      <Collapse style={{ marginTop: 16 }}>
        <Panel header="参数说明与获取方法（点击展开）" key="1">
          <div style={{ marginBottom: 12 }}>
            <b>服务器地址</b>实际请求的API地址将被拼接为：
            <div style={{ color: '#000',background:"#f5f5f5",padding:5,borderRadius: 4,marginTop:10 }}>http://{`address`}/api/v1/chats_openai/{`chatId`}/chat/completions</div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <b>Chat ID</b>：用于区分不同的聊天助手。
          </div>
          <PhotoProvider>
            <div style={{ marginBottom: 12 }}>
              <PhotoView src={ragflowKey_1}>
                <img 
                  src={ragflowKey_1} 
                  alt="" 
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
                  alt="" 
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
          <div style={{ marginBottom: 12 }}>
            <b>API密钥</b>：Bearer Token形式的认证密钥，用于访问RAGFlow-Chat服务。
          </div>
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
    </Modal>
  );
};

export default RAGFlowChat;