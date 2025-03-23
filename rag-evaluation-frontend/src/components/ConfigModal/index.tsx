import React, { useState, useEffect } from 'react';
import {
  Modal,
  Tabs,
  Form,
  Input,
  Select,
  Button,
  Switch,
  Space,
  message,
  Tooltip,
  Collapse,
  Card,
  Alert,
  Divider,
  Popconfirm
} from 'antd';
import { 
  QuestionCircleOutlined, 
  PlusOutlined, 
  MinusCircleOutlined, 
  ExperimentOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import OpenAI from 'openai';
import styles from './ConfigModal.module.css';

const { TabPane } = Tabs;
const { Panel } = Collapse;
const { Option } = Select;
const { TextArea } = Input;

// 本地存储键
const LLM_CONFIG_KEY = 'rag_eval_llm_config';
const RAG_CONFIG_KEY = 'rag_eval_rag_config';

// 类型定义
interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  modelName: string;
  additionalParams: Record<string, any>;
}

interface RAGConfig {
  url: string;
  requestHeaders: string; // 存储为字符串格式
  requestTemplate: string;
  responsePath: string;
}

interface ConfigModalProps {
  visible: boolean;
  onClose: () => void;
}

const ConfigModal: React.FC<ConfigModalProps> = ({ visible, onClose }) => {
  const [activeTab, setActiveTab] = useState<string>('llm');
  const [llmForm] = Form.useForm();
  const [ragForm] = Form.useForm();
  const [testLoading, setTestLoading] = useState<boolean>(false);
  const [useCustomParams, setUseCustomParams] = useState<boolean>(false);

  // 从本地存储加载配置
  useEffect(() => {
    if (visible) {
      try {
        const savedLLMConfig = localStorage.getItem(LLM_CONFIG_KEY);
        if (savedLLMConfig) {
          const config = JSON.parse(savedLLMConfig);
          llmForm.setFieldsValue({
            ...config,
            additionalParams: config.additionalParams ? 
              JSON.stringify(config.additionalParams, null, 2) : 
              '{}'
          });
          setUseCustomParams(!!config.additionalParams);
        }

        const savedRAGConfig = localStorage.getItem(RAG_CONFIG_KEY);
        if (savedRAGConfig) {
          const config = JSON.parse(savedRAGConfig);
          ragForm.setFieldsValue(config);
        }
      } catch (error) {
        console.error('加载配置失败:', error);
      }
    }
  }, [visible, llmForm, ragForm]);

  // 清除所有配置
  const clearAllConfigs = () => {
    localStorage.removeItem(LLM_CONFIG_KEY);
    localStorage.removeItem(RAG_CONFIG_KEY);
    
    // 重置表单
    llmForm.resetFields();
    ragForm.resetFields();
    
    message.success('所有配置已清除');
  };
  
  // 清除LLM配置
  const clearLLMConfig = () => {
    localStorage.removeItem(LLM_CONFIG_KEY);
    llmForm.resetFields();
    message.success('LLM配置已清除');
  };
  
  // 清除RAG配置
  const clearRAGConfig = () => {
    localStorage.removeItem(RAG_CONFIG_KEY);
    ragForm.resetFields();
    message.success('RAG系统配置已清除');
  };

  // 保存LLM配置
  const saveLLMConfig = (values: any) => {
    try {
      const config: LLMConfig = {
        baseUrl: values.baseUrl,
        apiKey: values.apiKey,
        modelName: values.modelName,
        additionalParams: useCustomParams ? JSON.parse(values.additionalParams) : {}
      };
      localStorage.setItem(LLM_CONFIG_KEY, JSON.stringify(config));
      message.success('大模型配置已保存');
    } catch (error) {
      message.error('保存配置失败，请检查参数格式');
      console.error('保存配置失败:', error);
    }
  };

  // 保存RAG配置
  const saveRAGConfig = (values: any) => {
    try {
      // 确保requestHeaders是字符串
      const requestHeaders = typeof values.requestHeaders === 'string' 
        ? values.requestHeaders 
        : JSON.stringify(values.requestHeaders, null, 2);
        
      const config: RAGConfig = {
        url: values.url,
        requestHeaders: requestHeaders, // 存储为字符串
        requestTemplate: values.requestTemplate,
        responsePath: values.responsePath
      };
      localStorage.setItem(RAG_CONFIG_KEY, JSON.stringify(config));
      message.success('RAG系统配置已保存');
    } catch (error) {
      message.error('保存配置失败，请检查JSON格式');
      console.error('保存配置失败:', error);
    }
  };

  // 填充Dify样例
  const fillDifyExample = () => {
    ragForm.setFieldsValue({
      url: 'http://localhost/v1/chat-messages',
      requestHeaders: JSON.stringify({
        "Authorization": "Bearer 你的密钥",
        "Content-Type": "application/json"
      }, null, 2),
      requestTemplate: JSON.stringify({
        "inputs": {},
        "query": "{{question}}",
        "response_mode": "blocking",
        "conversation_id": "",
        "user": "abc-123"
      }, null, 2),
      responsePath: "answer"
    });
    message.info(<p>已填充Dify API样例配置</p>, 5); // 设置显示时间为5秒
    message.info(<p>本样例为工作流类型，其他类型接口请参考Dify文档</p>,5);
  };

  // 测试LLM接口
  const testLLMAPI = async () => {
    try {
      const values = await llmForm.validateFields();
      setTestLoading(true);
      message.loading('正在测试连接...', 0);

      // 创建OpenAI客户端实例
      const openai = new OpenAI({
        apiKey: values.apiKey,
        baseURL: values.baseUrl,
        dangerouslyAllowBrowser: true, // 允许在浏览器环境中使用API密钥（仅用于测试）
      });

      // 构建请求参数
      const params = {
        model: values.modelName,
        messages: [
          { role: "user", content: "Hello!" }
        ],
        max_tokens: 20, // 限制响应长度，加快测试速度
        ...(useCustomParams ? JSON.parse(values.additionalParams) : {})
      };

      // 发送测试请求
      const completion = await openai.chat.completions.create(params);
      
      message.destroy(); // 销毁加载提示
      
      if (completion) {
        message.success('连接成功！收到响应: ' + completion.choices[0]?.message?.content?.substring(0, 20) + '...');
        saveLLMConfig(values);
      } else {
        message.warning('连接成功但响应异常');
      }
      
    } catch (error) {
      message.destroy(); // 销毁加载提示
      console.error('测试LLM API失败:', error);
      
      let errorMessage = '连接失败';
      if (error instanceof Error) {
        // 提取有用的错误信息
        if (error.message.includes('Unauthorized')) {
          errorMessage = 'API密钥无效或未授权';
        } else if (error.message.includes('timeout')) {
          errorMessage = '连接超时，请检查网络或API基础URL';
        } else if (error.message.includes('not found')) {
          errorMessage = '模型名称不存在或API基础URL错误';
        } else {
          errorMessage = `连接失败: ${error.message}`;
        }
      }
      
      message.error(errorMessage);
    } finally {
      setTestLoading(false);
    }
  };

  // 测试RAG接口
  const testRAGAPI = async () => {
    try {
      const values = await ragForm.validateFields();
      setTestLoading(true);
      message.loading('正在测试连接...', 0);
      
      // 解析请求头
      const requestHeaders = JSON.parse(values.requestHeaders || '{}');
      
      // 构建测试请求体
      const requestTemplate = JSON.parse(values.requestTemplate);
      const requestBody = JSON.stringify(
        // 替换占位符
        JSON.parse(
          JSON.stringify(requestTemplate).replace('{{question}}', '这是一个RAG系统测试问题，请简短回复。')
        )
      );
      
      // 构建请求头
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...requestHeaders
      };
      
      // 发送请求
      const response = await fetch(values.url, {
        method: 'POST',
        headers,
        body: requestBody,
      });
      
      if (!response.ok) {
        throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
      }
      
      // 解析响应
      const data = await response.json();
      
      // 从响应中提取答案
      const paths = values.responsePath.split('.');
      let result = data;
      for (const path of paths) {
        if (result && result[path] !== undefined) {
          result = result[path];
        } else {
          throw new Error(`响应路径 "${values.responsePath}" 无效，无法找到回答`);
        }
      }
      
      message.destroy(); // 销毁加载提示
      message.success('连接成功！收到响应: ' + (typeof result === 'string' ? result.substring(0, 20) + '...' : '成功'));
      saveRAGConfig(values);
      
    } catch (error) {
      message.destroy(); // 销毁加载提示
      
      let errorMessage = '连接失败';
      if (error instanceof Error) {
        errorMessage = `测试失败: ${error.message}`;
      }
      
      message.error(errorMessage);
      console.error('测试RAG API失败:', error);
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <Modal
      title="系统配置"
      open={visible}
      onCancel={onClose}
      width={900}
      footer={
       <></>
      }
      destroyOnClose
    >
      <Alert 
        message="隐私说明" 
        description={
          <div>
            <p>所有配置（包括API密钥）仅存储在您的浏览器本地存储中，<strong>不会</strong>上传至任何服务器。这些数据将永久保存在您的设备上，直到您主动清除浏览器数据或使用此页面的"清除配置"功能。</p>
            <p>测试请求直接从您的浏览器发送至相应的API服务，不经过我们的服务器。</p>
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="LLM模型配置" key="llm">
          <div className={styles.tabHeader}>
            <div>LLM模型配置（OpenAI接口规范）</div>
          </div>

          <Form
            form={llmForm}
            layout="vertical"
            initialValues={{
              baseUrl: 'https://api.openai.com/v1',
              apiKey: '',
              modelName: 'gpt-3.5-turbo',
              additionalParams: '{\n  "temperature": 0.7\n}'
            }}
          >
            <Form.Item
              name="baseUrl"
              label="API基础URL"
              rules={[{ required: true, message: '请输入API基础URL' }]}
            >
              <Input placeholder="https://api.openai.com/v1" />
            </Form.Item>
            
            <Form.Item
              name="apiKey"
              label="API密钥"
              rules={[{ required: true, message: '请输入API密钥' }]}
            >
              <Input.Password placeholder="sk-..." />
            </Form.Item>
            <Form.Item
              name="modelName"
              label="模型名称"
              rules={[{ required: true, message: '请输入模型名称' }]}
            >
              <Input placeholder="gpt-4" />
            </Form.Item>

            <Form.Item label="高级参数">
              <Switch
                checked={useCustomParams}
                onChange={setUseCustomParams}
                checkedChildren="自定义"
                unCheckedChildren="默认"
              />
              {useCustomParams && (
                <Form.Item
                  name="additionalParams"
                  rules={[
                    { required: true, message: '请输入额外参数' },
                    {
                      validator: (_, value) => {
                        try {
                          JSON.parse(value);
                          return Promise.resolve();
                        } catch (error) {
                          return Promise.reject('请输入有效的JSON格式');
                        }
                      }
                    }
                  ]}
                  className={styles.nestedFormItem}
                >
                  <TextArea
                    rows={4}
                    placeholder='{"temperature": 0.7, "max_tokens": 1000}'
                  />
                </Form.Item>
              )}
            </Form.Item>

            <div className={styles.formActionsWithClear}>
              <Popconfirm
                title="确定要清除LLM配置吗？"
                onConfirm={clearLLMConfig}
                okText="确定"
                cancelText="取消"
              >
                <Button 
                  type="text" 
                  danger
                  icon={<DeleteOutlined />}
                  size="small"
                >
                  清除配置
                </Button>
              </Popconfirm>
              <Space>
                <Button type="primary" onClick={testLLMAPI} loading={testLoading}>
                  测试并保存
                </Button>
                <Button onClick={() => saveLLMConfig(llmForm.getFieldsValue())}>
                  保存
                </Button>
              </Space>
            </div>
          </Form>
        </TabPane>
        
        <TabPane tab="RAG系统配置" key="rag">
          <div className={styles.headerWithSample}>
            <div>RAG系统配置</div>
            <Button 
              type="link" 
              icon={<ExperimentOutlined />} 
              onClick={fillDifyExample}
              size="small"
            >
              Dify样例
            </Button>
          </div>

          <Form
            form={ragForm}
            layout="vertical"
            initialValues={{
              url: '',
              requestHeaders: '{\n  "Content-Type": "application/json"\n}',
              requestTemplate: '{\n  "query": "{{question}}",\n  "options": {\n    "stream": false\n  }\n}',
              responsePath: 'answer'
            }}
          >
            <Form.Item
              name="url"
              label="API接口地址"
              rules={[{ required: true, message: '请输入RAG系统API地址' }]}
            >
              <Input placeholder="https://your-rag-system.com/api/query" />
            </Form.Item>
            
            <Form.Item
              name="requestHeaders"
              label={
                <span>
                  请求头 
                  <Tooltip title="配置HTTP请求头，包括认证信息">
                    <QuestionCircleOutlined className={styles.infoIcon} />
                  </Tooltip>
                </span>
              }
              rules={[
                { required: true, message: '请输入请求头' },
                {
                  validator: (_, value) => {
                    try {
                      JSON.parse(value);
                      return Promise.resolve();
                    } catch (error) {
                      return Promise.reject('请输入有效的JSON格式');
                    }
                  }
                }
              ]}
            >
              <TextArea
                rows={4}
                placeholder='{"Content-Type": "application/json", "Authorization": "Bearer your-token"}'
              />
            </Form.Item>
            
            <Form.Item
              name="requestTemplate"
              label={
                <span>
                  请求模板 
                  <Tooltip title="使用{{question}}作为问题占位符">
                    <QuestionCircleOutlined className={styles.infoIcon} />
                  </Tooltip>
                </span>
              }
              rules={[
                { required: true, message: '请输入请求模板' },
                {
                  validator: (_, value) => {
                    try {
                      JSON.parse(value);
                      return Promise.resolve();
                    } catch (error) {
                      return Promise.reject('请输入有效的JSON格式');
                    }
                  }
                }
              ]}
            >
              <TextArea
                rows={4}
                placeholder='{"query": "{{question}}", "options": {"temperature": 0.7}}'
              />
            </Form.Item>
            
            <Form.Item
              name="responsePath"
              label={
                <span>
                  响应路径 
                  <Tooltip title="从响应JSON中提取回答的路径（例如：data.answer，其中data代表响应的根节点）">
                    <QuestionCircleOutlined className={styles.infoIcon} />
                  </Tooltip>
                </span>
              }
              rules={[{ required: true, message: '请输入响应路径' }]}
            >
              <Input placeholder="data.answer" />
            </Form.Item>

            <div className={styles.formActionsWithClear}>
              <Popconfirm
                title="确定要清除RAG配置吗？"
                onConfirm={clearRAGConfig}
                okText="确定"
                cancelText="取消"
              >
                <Button 
                  type="text" 
                  danger
                  icon={<DeleteOutlined />}
                  size="small"
                >
                  清除配置
                </Button>
              </Popconfirm>
              <Space>
                <Button type="primary" onClick={testRAGAPI} loading={testLoading}>
                  测试并保存
                </Button>
                <Button onClick={() => saveRAGConfig(ragForm.getFieldsValue())}>
                  保存
                </Button>
              </Space>
            </div>
          </Form>
        </TabPane>
      </Tabs>
    </Modal>
  );
};

export default ConfigModal; 