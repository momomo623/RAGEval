import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Divider, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { projectService, CreateProjectRequest } from '../../services/project.service';
import styles from './CreateProject.module.css';

const { Title, Text } = Typography;
const { TextArea } = Input;

const CreateProject: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      // 构建维度设置
      const dimensions = [];
      if (values.accuracy) dimensions.push('accuracy');
      if (values.relevance) dimensions.push('relevance');
      if (values.completeness) dimensions.push('completeness');
      if (values.conciseness) dimensions.push('conciseness');

      const projectData: CreateProjectRequest = {
        name: values.name,
        description: values.description,
        evaluation_method: values.evaluation_method,
        scoring_scale: values.scoring_scale,
        settings: {
          default_dimensions: dimensions
        }
      };

      const result = await projectService.createProject(projectData);
      if (result) {
        message.success('项目创建成功');
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('创建项目失败:', error);
      message.error('创建项目失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Button 
          type="text" 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate('/dashboard')}
        >
          返回
        </Button>
        <Title level={2}>创建新项目</Title>
        <Text type="secondary">输入基本信息，快速创建一个RAG评测项目</Text>
      </div>

      <Card className={styles.formCard}>
        <Form 
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            evaluation_method: 'auto',
            scoring_scale: '1-5',
            accuracy: true,
            relevance: true
          }}
        >
          <div className={styles.section}>
            <Title level={4}>基本信息</Title>
            <Text type="secondary">请填写项目的基本信息</Text>

            <Form.Item
              name="name"
              label="项目名称"
              rules={[{ required: true, message: '请输入项目名称' }]}
              className={styles.formItem}
            >
              <Input placeholder="给项目起一个名字" />
            </Form.Item>

            <Form.Item
              name="description"
              label="项目描述"
              className={styles.formItem}
            >
              <TextArea 
                rows={4} 
                placeholder="简单描述这个项目的目的和内容" 
              />
            </Form.Item>
          </div>

          <Divider />

          <div className={styles.formActions}>
            <Button onClick={() => navigate('/dashboard')}>取消</Button>
            <Button type="primary" htmlType="submit" loading={loading}>创建项目</Button>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default CreateProject; 