import React, { useEffect, useState } from 'react';
import { Card, Button, Form, Input, Alert, message } from 'antd';
import { useParams } from 'react-router-dom';
import ConfigButton from '../../../components/ConfigButton';
import { useConfigContext } from '../../../contexts/ConfigContext';
import styles from './RagEvaluation.module.css';

const RagEvaluation: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { getLLMConfig, getRAGConfig } = useConfigContext();
  const [form] = Form.useForm();
  const [isConfigured, setIsConfigured] = useState(false);
  
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
        <ConfigButton 
          text="系统配置" 
          type="primary"
          icon={true} 
        />
      </div>
      
      {!isConfigured && (
        <Alert
          message="系统未完全配置"
          description="请先配置大模型API和RAG系统接口，以进行评测"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          action={
            <Button size="small" type="primary" onClick={() => useConfigContext().showConfigModal()}>
              立即配置
            </Button>
          }
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