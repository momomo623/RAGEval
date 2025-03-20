import React, { useEffect } from 'react';
import { Form, Button, Alert } from 'antd';
import { useParams } from 'react-router-dom';
import ConfigButton from '../../../components/ConfigButton';
import { useConfigContext } from '../../../contexts/ConfigContext';

const AutoEvaluation: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { getLLMConfig } = useConfigContext();
  const [form] = Form.useForm();
  
  useEffect(() => {
    // 检查是否已配置LLM
    const llmConfig = getLLMConfig();
    if (!llmConfig) {
      // 显示警告
    }
  }, [getLLMConfig]);
  
  return (
    <div>
      <div className="page-header">
        <h1>自动评测</h1>
        <ConfigButton icon={true} text="" type="link" />
      </div>
      
      {!getLLMConfig() && (
        <Alert
          message="未配置大模型API"
          description="请先配置大模型API以进行自动评测"
          type="warning"
          action={<ConfigButton text="立即配置" type="primary" size="small" />}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      
      {/* 评测表单内容 */}
    </div>
  );
};

export default AutoEvaluation; 