import React, { useState } from 'react';
import { Form, Input, Button, Card, Checkbox, Radio, Space, Typography, Select, Divider, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { projectService, CreateProjectRequest } from '../../services/project.service';
import styles from './CreateProject.module.css';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

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

          {/* <div className={styles.section}>
            <Title level={4}>评测配置</Title>
            <Text type="secondary">选择评测维度和方式</Text>

            <Form.Item 
              label="评测维度" 
              required
              className={styles.formItem}
            >
              <Space direction="vertical" className={styles.checkboxGroup}>
                <Form.Item name="accuracy" valuePropName="checked" noStyle>
                  <Checkbox>准确性</Checkbox>
                </Form.Item>
                <Text type="secondary">评估回答与标准答案的事实一致性</Text>
                
                <Form.Item name="relevance" valuePropName="checked" noStyle>
                  <Checkbox>相关性</Checkbox>
                </Form.Item>
                <Text type="secondary">评估回答与问题的匹配度</Text>
                
                <Form.Item name="completeness" valuePropName="checked" noStyle>
                  <Checkbox>完整性</Checkbox>
                </Form.Item>
                <Text type="secondary">评估回答的信息覆盖度</Text>
                
                <Form.Item name="conciseness" valuePropName="checked" noStyle>
                  <Checkbox>简洁性</Checkbox>
                </Form.Item>
                <Text type="secondary">评估回答是否无冗余信息</Text>
              </Space>
            </Form.Item>

            <Form.Item
              name="evaluation_method"
              label="评测方式"
              className={styles.formItem}
            >
              <Select>
                <Option value="auto">自动评测</Option>
                <Option value="manual">人工评测</Option>
                <Option value="hybrid">混合评测</Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="scoring_scale"
              label="评分规则"
              className={styles.formItem}
            >
              <Select>
                <Option value="1-3">三分量表（较差/一般/优秀）</Option>
                <Option value="binary">二元评分（正确/错误）</Option>
                <Option value="1-5">五分量表（1-5分）</Option>
              </Select>
            </Form.Item>
          </div> */}

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