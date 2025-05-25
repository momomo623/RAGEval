import React, { useState, useEffect } from 'react';
import { Card, Button, Modal, Form, Input, Select, Space, message, Popconfirm, Divider, Typography, Row, Col, Tooltip, Alert } from 'antd';
import { PlusOutlined, DeleteOutlined, SettingOutlined, InfoCircleOutlined, QuestionCircleOutlined, DownOutlined, RightOutlined, ClearOutlined } from '@ant-design/icons';
import { RAG_TEMPLATES } from './RAGTemplates';
import DifyChatflow from './RAGTemplates/Dify-CHATFLOW';
import DifyFlow from './RAGTemplates/Dify-FLOW';
import CustomRAG from './RAGTemplates/CustomRAG';
import RAGFlowChat from './RAGTemplates/RAGFlowChat';
import { labelWithTip } from './utils';
import OpenAIModelConfigModal from './LLMTemplates/OpenAIModelConfigModal';
import SiliconFlowModelConfigModal from './LLMTemplates/SiliconFlowModelConfigModal';
import { ConfigManager } from '@utils/configManager';

const { Title } = Typography;

// 仅支持OpenAI接口规范的大模型
const MODEL_TEMPLATES = [
  {
    key: 'openai',
    name: '通用大模型',
    desc: 'OpenAI API接口规范',
    logo: '/llm_logo/openai_logo.png',
    defaultConfig: {
      name: '',
      baseUrl: '',
      apiKey: '',
      modelName: '',
      additionalParams: `{
  "temperature": 0.1,
  "max_tokens": 2048
}`,
    }
  },
  {
    key: 'siliconflow',
    name: '硅基流动',
    desc: '硅基流动大模型API',
    logo: '/llm_logo/siliconflow_logo.png', // 需准备logo
    defaultConfig: {
      name: '硅基流动',
      baseUrl: 'https://api.siliconflow.cn',
      apiKey: '',
      modelName: 'Qwen/QwQ-32B',
      additionalParams: `{
  "temperature": 0.7,
  "max_tokens": 2048
}`,
    }
  }
];

const LOCAL_MODEL_KEY = 'rag_eval_model_configs';
const LOCAL_RAG_KEY = 'rag_eval_rag_configs';

const cardStyle: React.CSSProperties = {
  textAlign: 'center',
  minHeight: 200,
  borderRadius: 10,
  boxShadow: '0 2px 8px #f0f1f2',
  transition: 'box-shadow 0.2s',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  marginRight: 20,
};
const logoStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  marginBottom: 8,
  objectFit: 'contain',
  borderRadius: 6,
  background: '#f5f6fa',
  boxShadow: '0 1px 4px #e0e0e0',
};

// 1. 新增：定义RagConfigModal组件，专门处理rag弹窗内容和保存
const RagConfigModal = ({
  open,
  onCancel,
  onSave,
  template,
  editValue
}: {
  open: boolean;
  onCancel: () => void;
  onSave: (values: any) => void;
  template: any;
  editValue: any;
}) => {
  if (!template) return null;
  if (template.key === 'dify_chatflow') {
    return <DifyChatflow open={open} onCancel={onCancel} onSave={onSave} initialValues={editValue} />;
  }
  if (template.key === 'dify_flow') {
    return <DifyFlow open={open} onCancel={onCancel} onSave={onSave} initialValues={editValue} />;
  }
  if (template.key === 'custom') {
    return <CustomRAG open={open} onCancel={onCancel} onSave={onSave} initialValues={editValue} />;
  }
  if (template.key === 'ragflow_chat') {
    return <RAGFlowChat open={open} onCancel={onCancel} onSave={onSave} initialValues={editValue} />;
  }
  // 其他RAG模板可在此扩展
  return null;
};

const ProviderPanel: React.FC = () => {
  const configManager = ConfigManager.getInstance();
  const [modelConfigs, setModelConfigs] = useState<any[]>([]);
  const [ragConfigs, setRagConfigs] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'model' | 'rag'>('model');
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [form] = Form.useForm();
  const [currentTemplate, setCurrentTemplate] = useState<any>(null);
  const [currentEditValue, setCurrentEditValue] = useState<any>({});
  const [marketOpen, setMarketOpen] = useState(true); // 控制配置市场展开/收起

  // 加载配置
  useEffect(() => {
    const loadConfigs = async () => {
      try {
        const models = await configManager.getAllConfigs('model');
        const rags = await configManager.getAllConfigs('rag');
        setModelConfigs(models);
        setRagConfigs(rags);
      } catch (error) {
        console.error('加载配置失败:', error);
        message.error('加载配置失败');
      }
    };
    loadConfigs();
  }, []);

  // 添加模型
  const handleAddModel = (tplKey = 'openai') => {
    setModalType('model');
    const tpl = MODEL_TEMPLATES.find(t => t.key === tplKey) || MODEL_TEMPLATES[0];
    setCurrentTemplate(tpl);
    setEditIndex(null);
    form.setFieldsValue({ ...tpl.defaultConfig });
    setModalOpen(true);
  };

  // 编辑模型配置
  const handleEditModel = (idx: number) => {
    setModalType('model');
    const model = modelConfigs[idx];
    const template = MODEL_TEMPLATES.find(t => t.key === model.type) || MODEL_TEMPLATES[0];
    setCurrentTemplate(template);
    setEditIndex(idx);
    form.setFieldsValue(model);
    setModalOpen(true);
  };

  // 保存模型配置
  const handleModelSave = async (values: any) => {
    try {
      if (editIndex !== null) {
        const updatedConfig = await configManager.updateConfig(
          modelConfigs[editIndex].id,
          { ...values, type: currentTemplate?.key },
          'model'
        );
        if (updatedConfig) {
          setModelConfigs(prev => prev.map((config, i) => i === editIndex ? updatedConfig : config));
        }
      } else {
        const newConfig = await configManager.createConfig({
          ...values,
          type: currentTemplate?.key,
        }, 'model');
        setModelConfigs(prev => [...prev, newConfig]);
      }
      setEditIndex(null);
      setModalOpen(false);
      message.success('模型配置已保存');
    } catch (error) {
      console.error('保存配置失败:', error);
      message.error('保存配置失败');
    }
  };

  // 删除模型配置
  const handleDeleteModel = async (configId: string) => {
    try {
      if (await configManager.deleteConfig(configId, 'model')) {
        setModelConfigs(prev => prev.filter(c => c.id !== configId));
        message.success('已删除模型配置');
      }
    } catch (error) {
      console.error('删除配置失败:', error);
      message.error('删除配置失败');
    }
  };

  // 修改 handleAddRag/handleEditRag 只控制弹窗开关和传递模板/初始值
  const handleAddRag = (template: any) => {
    console.log("template", template);

    setModalType('rag');
    setCurrentTemplate(template);
    setEditIndex(null);
    // 针对dify_chatflow和dify_flow设置默认url
    let defaultConfig = template.defaultConfig;
    if (template.key === 'dify_chatflow') {
      defaultConfig = {
        ...defaultConfig,
        name: 'Dify-Chatflow',
        url: 'https://localhost/v1/chat-messages',
      };
    }
    if (template.key === 'dify_flow') {
      defaultConfig = {
        ...defaultConfig,
        name: 'Dify-工作流',
        url: 'http://localhost/v1/workflows/run',
      };
    }
    if (template.key === 'ragflow'){
      defaultConfig = {
        ...defaultConfig,
        name: 'RAGFlow-Chat',
        url: 'http://localhost/v1/workflows/run',
      };
    }
    setCurrentEditValue(defaultConfig);
    setModalOpen(true);
  };
  const handleEditRag = (idx: number) => {
    setModalType('rag');
    const rag = ragConfigs[idx];
    const template = RAG_TEMPLATES.find(t => t.key === rag.type) || RAG_TEMPLATES[0];
    console.log("修改 template ", template);
    console.log("修改 rag ", rag);

    setCurrentTemplate(template);
    setEditIndex(idx);
    setCurrentEditValue(rag);
    setModalOpen(true);
  };
  const handleDeleteRag = (idx: number) => {
    const newList = [...ragConfigs];
    newList.splice(idx, 1);
    configManager.deleteConfig(ragConfigs[idx].id, 'rag');
    setRagConfigs(newList);
    message.success('已删除RAG系统配置');
  };

  // 新增rag保存回调
  const handleRagSave = async (values: any) => {
    try {
      let newList = [...ragConfigs];
      if (editIndex !== null) {
        const updatedConfig = await configManager.updateConfig(ragConfigs[editIndex].id, { ...values, type: currentTemplate.key }, 'rag');
        if (updatedConfig) {
          newList[editIndex] = updatedConfig;
        }
      } else {
        const newConfig = await configManager.createConfig({ ...values, type: currentTemplate.key }, 'rag');
        newList.push(newConfig);
      }
      setRagConfigs(newList);
      setModalOpen(false);
      message.success('RAG系统配置已保存');
    } catch (error) {
      console.error('保存RAG配置失败:', error);
      message.error('保存配置失败');
    }
  };


  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <div style={{ height: '100%', overflowY: 'auto', padding: '0 1px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Title level={4} style={{ margin: 0, marginRight: 8 }}>模型提供商</Title>
          <Tooltip
          placement="right"
          title={
            <div style={{ maxWidth: 300 }}>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>隐私说明</div>
              <div style={{ color: '#fff', fontSize: 13, lineHeight: '1.5' }}>
                <div style={{ marginBottom: 4 }}>• 所有配置（包括API密钥）仅存储在您的浏览器本地</div>
                <div style={{ marginBottom: 4 }}>• 数据保存在您的设备上，直到主动清除</div>
                <div>• 测试请求直接从浏览器发送至API服务</div>
              </div>
            </div>
          }
        >
          <InfoCircleOutlined style={{ color: '#8c8c8c', cursor: 'help' }} />
          </Tooltip>
        </div>
        <Popconfirm
          title="清除所有配置"
          description="确定要清除所有模型和RAG系统配置吗？此操作不可恢复。"
          onConfirm={async () => {
            try {
              await configManager.clearUserConfigs();
              setModelConfigs([]);
              setRagConfigs([]);
              message.success('已清除所有配置');
            } catch (error) {
              console.error('清除配置失败:', error);
              message.error('清除配置失败');
            }
          }}
          okText="确定"
          cancelText="取消"
        >
          <Button icon={<ClearOutlined />} danger>清除所有配置</Button>
        </Popconfirm>
      </div>
      <div style={{ marginBottom: 24, fontSize: 15, color: '#666' }}>
        在此设置模型参数和API KEY，用于【AI生成问答对】和【AI精度评测】功能。
      </div>
      {/* 已添加模型和RAG系统（合并展示） */}
      {/* <Divider orientation="left"></Divider> */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 15, margin: '12px 0 8px 0', color: '#3b3b3b' }}>大模型配置</div>
        {modelConfigs.length === 0 ? <div style={{ color: '#aaa', marginBottom: 16 }}>暂无已添加模型</div> :
          modelConfigs.map((item, idx) => {
            const tpl = MODEL_TEMPLATES.find(t => t.key === item.type) || MODEL_TEMPLATES[0];
            return (
              <Card key={idx} style={{ marginBottom: 10, borderRadius: 10 ,background:"#f6f7f9",border:0}} bodyStyle={{ padding: 0,paddingRight:20 }}>
              <Row align="middle" justify="start" style={{ minHeight: 64 }}>
                <Col flex="64px" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <img src={tpl.logo} alt="logo" style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 8 }} />
                </Col>
                <Col flex="auto" style={{ padding: '12px 0 12px 12px' }}>
                  <div style={{ fontWeight: 600, fontSize: 18 }}>{item.name}</div>
                  <div style={{ fontSize: 13, color: '#888' }}>{item.modelName}</div>
                </Col>
                <Col>
                  <Space>
                    <Button icon={<SettingOutlined />} onClick={() => handleEditModel(idx)}>编辑</Button>
                    <Popconfirm title="确定删除该模型配置？" onConfirm={() => handleDeleteModel(item.id)}><Button icon={<DeleteOutlined />} danger>删除</Button></Popconfirm>
                  </Space>
                </Col>
              </Row>
              </Card>
            );
          })}
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 15, margin: '12px 0 8px 0', color: '#3b3b3b' }}>RAG系统配置</div>
        {ragConfigs.length === 0 ? <div style={{ color: '#aaa', marginBottom: 16 }}>暂无已添加RAG系统</div> :
          ragConfigs.map((item, idx) => {
            // 获取logo和类型名
            const tpl = RAG_TEMPLATES.find(t => t.key === item.type) || RAG_TEMPLATES[0];
            return (
              <Card key={idx} style={{ marginBottom: 10, borderRadius: 10 ,background:"#f6f7f9",border:0}} bodyStyle={{ padding: 0 ,paddingRight:20}}>
                <Row align="middle" justify="start" style={{ minHeight: 64 }}>
                  <Col flex="64px" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <img src={tpl.logo} alt="logo" style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 8 }} />
                  </Col>
                  <Col flex="auto" style={{ padding: '12px 0 12px 12px' }}>
                    <div style={{ fontWeight: 600, fontSize: 18 }}>{item.name}</div>
                    <div style={{ fontSize: 13, color: '#888' }}>{tpl.name}</div>
                  </Col>
                  <Col>
                    <Space>
                      <Button icon={<SettingOutlined />} onClick={() => handleEditRag(idx)}>编辑</Button>
                      <Popconfirm title="确定删除该RAG系统配置？" onConfirm={() => handleDeleteRag(idx)}><Button icon={<DeleteOutlined />} danger>删除</Button></Popconfirm>
                    </Space>
                  </Col>
                </Row>
              </Card>
            );
          })}
      </div>
      {/* 配置市场（可收起/展开） */}
      <div style={{ marginBottom: 24, overflow: 'hidden' }}>
        <div
          style={{ cursor: 'pointer', fontWeight: 600, fontSize: 18, padding: '10px 0 10px 2px', borderBottom: marketOpen ? '1px solid #f0f0f0' : 'none', display: 'flex', alignItems: 'center' }}
          onClick={() => setMarketOpen(v => !v)}
        >
          {marketOpen ? <DownOutlined style={{ marginRight: 8 }} /> : <RightOutlined style={{ marginRight: 8 }} />}
          配置市场
        </div>
        {marketOpen && (
          <div style={{ padding: '8px 0 0 0', overflow: 'visible' }}>
            <div style={{ fontWeight: 500, fontSize: 15, margin: '0 0 12px 2px', color: '#3b3b3b' }}>模型配置</div>
            <Row gutter={[24, 24]} justify="start" align="top" style={{ marginBottom: 24 }}>
              {MODEL_TEMPLATES.map((tpl, idx) => (
                <Col key={tpl.key} xs={24} sm={12} md={8} lg={8} xl={8} style={{ display: 'flex' }}>
                  <Card hoverable style={{ ...cardStyle, padding: 0, width: '100%', minHeight: 180 }} bodyStyle={{ padding: 0, width: '100%' }}>
                    <div style={{ display: 'flex', padding: 16, alignItems: 'flex-start' }}>
                      <img src={tpl.logo} alt={tpl.name} style={{ width: 40, height: 40, borderRadius: 8, background: '#f5f6fa', boxShadow: '0 1px 4px #e0e0e0' }} />
                      <div style={{ marginLeft: 20 }}>
                        <div style={{ fontWeight: 600, fontSize: 17, lineHeight: '22px' }}>{tpl.name}</div>
                        <div style={{ fontSize: 13, color: '#888', marginTop: 2, textAlign: 'left' }}>{tpl.key}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: '#888', minHeight: 18, padding: '0 16px 8px 16px', textAlign: 'left' }}>{tpl.desc}</div>
                    <div style={{ padding: '0 16px 16px 16px', textAlign: 'left' }}>
                      <Button type="link" icon={<PlusOutlined />} onClick={() => handleAddModel(tpl.key)} style={{ marginTop: 6, padding: 0 }}>添加模型</Button>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
            <div style={{ fontWeight: 500, fontSize: 15, margin: '0 0 12px 2px', color: '#3b3b3b' }}>RAG系统配置</div>
            <Row gutter={[24, 24]} justify="start" align="top" style={{ marginBottom: 8 }}>
              {RAG_TEMPLATES.map((tpl, idx) => (
                <Col key={tpl.key} xs={24} sm={12} md={8} lg={8} xl={8} style={{ display: 'flex' }}>
                  <Card hoverable style={{ ...cardStyle, padding: 0, width: '100%', minHeight: 180 }} bodyStyle={{ padding: 0, width: '100%' }}>
                    <div style={{ display: 'flex', padding: 16, alignItems: 'flex-start' }}>
                      <img src={tpl.logo} alt={tpl.name} style={{ width: 40, height: 40, borderRadius: 8, background: '#f5f6fa', boxShadow: '0 1px 4px #e0e0e0' }} />
                      <div style={{ marginLeft: 20 }}>
                        <div style={{ fontWeight: 600, fontSize: 17, lineHeight: '22px' }}>{tpl.name}</div>
                        <div style={{ fontSize: 13, color: '#888', marginTop: 2, textAlign: 'left' }}>{tpl.key}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: '#888', minHeight: 18, padding: '0 16px 8px 16px', textAlign: 'left' }}>{tpl.desc}</div>
                    <div style={{ padding: '0 16px 16px 16px', textAlign: 'left' }}>
                      <Button type="link" icon={<PlusOutlined />} onClick={() => handleAddRag(tpl)} style={{ marginTop: 6, padding: 0 }}>添加RAG系统</Button>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        )}
        </div>
      </div>
      {/* 配置弹窗 */}
      {modalType === 'model' ? (
        currentTemplate?.key === 'siliconflow' ? (
          <SiliconFlowModelConfigModal
            open={modalOpen}
            onCancel={() => setModalOpen(false)}
            onSave={handleModelSave}
            initialValues={editIndex !== null ? modelConfigs[editIndex] : currentTemplate?.defaultConfig}
          />
        ) : (
          <OpenAIModelConfigModal
            open={modalOpen}
            onCancel={() => setModalOpen(false)}
            onSave={handleModelSave}
            initialValues={editIndex !== null ? modelConfigs[editIndex] : currentTemplate?.defaultConfig}
          />
        )
      ) : (
        <RagConfigModal
          open={modalOpen}
          onCancel={() => setModalOpen(false)}
          onSave={handleRagSave}
          template={currentTemplate}
          editValue={currentEditValue}
        />
      )}
    </div>
  );
};

export default ProviderPanel; 