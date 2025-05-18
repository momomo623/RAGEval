import React from 'react';
import { Modal, Form, Input, Select, Row, Col } from 'antd';

const { TextArea } = Input;
const { Option } = Select;

interface RagAnswerModalProps {
  visible: boolean;
  editingRagAnswer: any | null;
  onCancel: () => void;
  onSubmit: () => void;
  form: any;
}

const RagAnswerModal: React.FC<RagAnswerModalProps> = ({
  visible,
  editingRagAnswer,
  onCancel,
  onSubmit,
  form
}) => {
  return (
    <Modal
      title={editingRagAnswer ? "编辑RAG回答" : "添加RAG回答"}
      visible={visible}
      onOk={onSubmit}
      onCancel={onCancel}
      width={700}
      okText={editingRagAnswer ? "更新" : "添加"}
      cancelText="取消"
    >
      <Form
        form={form}
        layout="vertical"
      >
        <Form.Item
          name="answer"
          label="回答内容"
          rules={[{ required: true, message: '请输入回答内容' }]}
        >
          <TextArea rows={8} placeholder="请输入RAG系统回答内容" />
        </Form.Item>
        
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item
              name="version"
              label="版本"
              initialValue="v1"
              rules={[{ required: true, message: '请输入版本' }]}
            >
              <Input placeholder="如：v1, v2, gpt-4等" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="collection_method"
              label="收集方式"
              initialValue="manual"
              rules={[{ required: true, message: '请选择收集方式' }]}
            >
              <Select>
                <Option value="manual">手动输入</Option>
                <Option value="api">API调用</Option>
                <Option value="import">导入</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};

export default RagAnswerModal;
