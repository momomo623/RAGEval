import React, { useEffect, useState } from 'react';
import { Card, Button, Form, Input, Alert, message } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { SettingOutlined } from '@ant-design/icons';
// import ConfigButton from '../../../components/ConfigButton';
import { useConfigContext } from '../../../contexts/ConfigContext';
import styles from './RagEvaluation.module.css';

const RagEvaluation: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { getLLMConfig, getRAGConfig } = useConfigContext();
  const [form] = Form.useForm();
  const [isConfigured, setIsConfigured] = useState(false);
  const navigate = useNavigate();
  
  useEffect(() => {
    // 检查配置状态
    checkConfigurations();
  }, []);
  
  const checkConfigurations = () => {
    const llmConfig = getLLMConfig();
    const ragConfig = getRAGConfig();
    setIsConfigured(!!llmConfig && !!ragConfig);
  };
  
  const handleStartEvaluation = async () => {
    try {
      const values = await form.validateFields();
      
      // 获取存储的配置
      const llmConfig = getLLMConfig();
      const ragConfig = getRAGConfig();
      
      if (!llmConfig || !ragConfig) {
        message.error('请先完成系统配置');
        return;
      }
      
      // 这里是实际评测逻辑
      message.info('开始评测...');
      console.log('评测配置：', { llmConfig, ragConfig, formValues: values });
      
      // 示例代码：调用RAG系统API
      // const response = await fetch(ragConfig.url, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     ... 根据ragConfig.authType添加认证头
      //   },
      //   body: JSON.stringify({
      //     query: values.testQuestion
      //   })
      // });
      
    } catch (error) {
      console.error('评测出错:', error);
    }
  };
  
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>RAG系统评测</h1>
        <Button 
          type="link"
          icon={<SettingOutlined />}
          onClick={() => navigate('/user/settings')}
          title="系统设置"
        />
      </div>
      
      {!isConfigured && (
        <Alert
          message="未配置RAG系统"
          description="请先配置RAG系统以进行评测"
          type="warning"
          action={
            <Button 
              type="primary" 
              size="small"
              onClick={() => navigate('/user/settings')}
            >
              立即配置
            </Button>
          }
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      
      <Card title="评测参数" className={styles.card}>
        <Form
          form={form}
          layout="vertical"
          initialValues={{ testCount: 10 }}
        >
          <Form.Item
            name="testCount"
            label="评测样本数量"
            rules={[{ required: true, message: '请输入评测样本数量' }]}
          >
            <Input type="number" min={1} max={100} />
          </Form.Item>
          
          <Form.Item>
            <Button 
              type="primary" 
              onClick={handleStartEvaluation}
              disabled={!isConfigured}
            >
              开始评测
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default RagEvaluation; 