import React, { useEffect } from 'react';
import { Form, Button, Alert } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { useConfigContext } from '../../../contexts/ConfigContext';
import { SettingOutlined } from '@ant-design/icons';

const AutoEvaluation: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { getLLMConfig } = useConfigContext();
  const [form] = Form.useForm();
  const navigate = useNavigate();
  
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
        <Button 
          type="link"
          icon={<SettingOutlined />}
          onClick={() => navigate('/user/settings')}
          title="系统设置"
        />
      </div>
      
      {!getLLMConfig() && (
        <Alert
          message="未配置大模型API"
          description="请先配置大模型API以进行自动评测"
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
      
      {/* 评测表单内容 */}
    </div>
  );
};

export default AutoEvaluation; 