import React, { useState, useEffect } from 'react';
import { Card, Button, Modal, Form, Input, Select, Space, message, Popconfirm, Divider, Typography, Row, Col, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined, SettingOutlined, InfoCircleOutlined, QuestionCircleOutlined, DownOutlined, RightOutlined } from '@ant-design/icons';
import ReactJson from 'react-json-view';
import { RAG_TEMPLATES } from './RAGTemplates';
import DifyChatflow from './RAGTemplates/Dify-CHATFLOW';
import DifyFlow from './RAGTemplates/Dify-FLOW';
import CustomRAG from './RAGTemplates/CustomRAG';
import { labelWithTip } from './utils';
import ModelConfigModal from './LLMTemplates/ModelConfigModal';

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
      additionalParams: '{"temperature": 0.1}'
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

// JSON编辑器表单项
const JsonEditorField: React.FC<{
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  height?: number;
}> = ({ value, onChange, placeholder, height = 120 }) => {
  let json: any = {};
  let error = false;
  try {
    json = value ? JSON.parse(value) : {};
  } catch {
    error = true;
  }
  return (
    <div style={{ border: error ? '1px solid #ff4d4f' : '1px solid #d9d9d9', borderRadius: 4, padding: 4, background: '#fafafa', minHeight: height }}>
      <ReactJson
        src={json}
        name={false}
        displayDataTypes={false}
        displayObjectSize={false}
        enableClipboard={false}
        style={{ fontSize: 13, background: 'transparent' }}
        onEdit={e => onChange && onChange(JSON.stringify(e.updated_src, null, 2))}
        onAdd={e => onChange && onChange(JSON.stringify(e.updated_src, null, 2))}
        onDelete={e => onChange && onChange(JSON.stringify(e.updated_src, null, 2))}
        collapsed={false}
      />
      {error && <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 4 }}>请输入有效的JSON格式</div>}
      {!value && <div style={{ color: '#aaa', fontSize: 12, marginTop: 4 }}>{placeholder}</div>}
    </div>
  );
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
  // 其他RAG模板可在此扩展
  return null;
};

const ProviderPanel: React.FC = () => {
  // 大模型配置
  const [modelConfigs, setModelConfigs] = useState<any[]>([]);
  // RAG系统配置
  const [ragConfigs, setRagConfigs] = useState<any[]>([]);
  // 控制弹窗
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'model' | 'rag'>('model');
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [form] = Form.useForm();
  const [currentTemplate, setCurrentTemplate] = useState<any>(null);
  const [currentEditValue, setCurrentEditValue] = useState<any>({});
  const [marketOpen, setMarketOpen] = useState(true); // 控制配置市场展开/收起

  // 加载本地配置
  useEffect(() => {
    console.log('ragConfigs', ragConfigs);

    const models = JSON.parse(localStorage.getItem(LOCAL_MODEL_KEY) || '[]');
    setModelConfigs(models);
    const rags = JSON.parse(localStorage.getItem(LOCAL_RAG_KEY) || '[]');
    setRagConfigs(rags);
  }, []);

  // 保存到本地
  const saveModelConfigs = (configs: any[]) => {
    setModelConfigs(configs);
    localStorage.setItem(LOCAL_MODEL_KEY, JSON.stringify(configs));
  };
  const saveRagConfigs = (configs: any[]) => {
    setRagConfigs(configs);
    localStorage.setItem(LOCAL_RAG_KEY, JSON.stringify(configs));
  };

  // 添加/编辑模型
  const handleAddModel = () => {
    setModalType('model');
    setCurrentTemplate(MODEL_TEMPLATES[0]);
    setEditIndex(null);
    form.setFieldsValue({ ...MODEL_TEMPLATES[0].defaultConfig });
    setModalOpen(true);
  };
  const handleEditModel = (idx: number) => {
    setModalType('model');
    setCurrentTemplate(MODEL_TEMPLATES[0]);
    setEditIndex(idx);
    form.setFieldsValue({ ...modelConfigs[idx] });
    setModalOpen(true);
  };
  const handleDeleteModel = (idx: number) => {
    const newList = [...modelConfigs];
    newList.splice(idx, 1);
    saveModelConfigs(newList);
    message.success('已删除模型配置');
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
        url: 'https://localhost/v1/chat-messages',
      };
    }
    else if (template.key === 'dify_flow') {
      defaultConfig = {
        ...defaultConfig,
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
    saveRagConfigs(newList);
    message.success('已删除RAG系统配置');
  };

  // 新增rag保存回调
  const handleRagSave = (values: any) => {
    let newList = [...ragConfigs];
    if (editIndex !== null) {
      newList[editIndex] = { ...values, type: currentTemplate.key };
    } else {
      newList.push({ ...values, type: currentTemplate.key });
    }
    saveRagConfigs(newList);
    setModalOpen(false);
    message.success('RAG系统配置已保存');
  };

  // 新增大模型保存回调
  const handleModelSave = (values: any) => {
    let newList = [...modelConfigs];
    if (editIndex !== null) {
      newList[editIndex] = values;
    } else {
      newList.push(values);
    }
    saveModelConfigs(newList);
    setModalOpen(false);
    message.success('模型配置已保存');
  };

  // 渲染表单内容
  const renderFormFields = () => {
    if (modalType === 'model') {
      return <>
        <Form.Item name="name" label={labelWithTip('配置名称', '自定义本配置的名称，便于区分多个模型账号')} rules={[{ required: true, message: '请输入配置名称' }]}> <Input placeholder="如：OpenAI主账号" /> </Form.Item>
        <Form.Item name="baseUrl" label={labelWithTip('BASE_URL', 'OpenAI API的基础URL，如 https://api.openai.com/v1')} rules={[{ required: true, message: '请输入BASE_URL' }]}> <Input placeholder="https://api.openai.com/v1" /> </Form.Item>
        <Form.Item name="apiKey" label={labelWithTip('API_KEY', 'OpenAI或兼容API的密钥')} rules={[{ required: true, message: '请输入API_KEY' }]}> <Input.Password placeholder="sk-..." /> </Form.Item>
        <Form.Item name="modelName" label={labelWithTip('模型名称', '如gpt-4、deepseek等，具体见API文档')} rules={[{ required: true, message: '请输入模型名称' }]}> <Input placeholder="gpt-4" /> </Form.Item>
        <Form.Item
          name="additionalParams"
          label={labelWithTip('高级参数(JSON)', '如temperature、max_tokens等，需为合法JSON格式')}
          rules={[{
            validator: (_, value) => {
              if (!value) return Promise.resolve();
              try { JSON.parse(value); return Promise.resolve(); } catch { return Promise.reject('请输入有效的JSON格式'); }
            }
          }]}
          valuePropName="value"
          getValueFromEvent={v => v}
        >
          <JsonEditorField
            value={form.getFieldValue('additionalParams')}
            onChange={v => form.setFieldsValue({ additionalParams: v })}
            placeholder='{"temperature": 0.1}'
            height={120}
          />
        </Form.Item>
      </>;
    } else if (modalType === 'rag') {
      return null;
    }
    return null;
  };

  return (
    <div style={{ width: '100%' }}>
      <Title level={4}>模型提供商</Title>
      <div style={{ marginBottom: 16, color: '#888' }}>在此设置模型参数和API KEY。
        大模型配置用于【AI生成问答对】、【AI精度评测】。
        

      </div>
      {/* 已添加模型和RAG系统（合并展示） */}
      {/* <Divider orientation="left"></Divider> */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 15, margin: '12px 0 8px 0', color: '#3b3b3b' }}>大模型配置</div>
        {modelConfigs.length === 0 ? <div style={{ color: '#aaa', marginBottom: 16 }}>暂无已添加模型</div> :
          modelConfigs.map((item, idx) => (
            <Card key={idx} style={{ marginBottom: 10, borderRadius: 10 ,background:"#f6f7f9",border:0}} bodyStyle={{ padding: 0,paddingRight:20 }}>
              <Row align="middle" justify="start" style={{ minHeight: 64 }}>
                <Col flex="64px" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <img src={MODEL_TEMPLATES[0].logo} alt="logo" style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 8 }} />
                </Col>
                <Col flex="auto" style={{ padding: '12px 0 12px 12px' }}>
                  <div style={{ fontWeight: 600, fontSize: 18 }}>{item.name}</div>
                  <div style={{ fontSize: 13, color: '#888' }}>{item.modelName}</div>
                </Col>
                <Col>
                  <Space>
                    <Button icon={<SettingOutlined />} onClick={() => handleEditModel(idx)}>编辑</Button>
                    <Popconfirm title="确定删除该模型配置？" onConfirm={() => handleDeleteModel(idx)}><Button icon={<DeleteOutlined />} danger>删除</Button></Popconfirm>
                  </Space>
                </Col>
              </Row>
            </Card>
          ))}
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 15, margin: '12px 0 8px 0', color: '#3b3b3b' }}>RAG系统配置</div>
        {ragConfigs.length === 0 ? <div style={{ color: '#aaa', marginBottom: 16 }}>暂无已添加RAG系统</div> :
          ragConfigs.map((item, idx) => {
            // 获取logo和类型名
            const tpl = RAG_TEMPLATES.find(t => t.key === item.type) || RAG_TEMPLATES[0];
            return (
              <Card key={idx} style={{ marginBottom: 10, borderRadius: 10 }} bodyStyle={{ padding: 0 }}>
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
      <div style={{ marginBottom: 24 }}>
        <div
          style={{ cursor: 'pointer', fontWeight: 600, fontSize: 18, padding: '10px 0 10px 2px', borderBottom: marketOpen ? '1px solid #f0f0f0' : 'none', display: 'flex', alignItems: 'center' }}
          onClick={() => setMarketOpen(v => !v)}
        >
          {marketOpen ? <DownOutlined style={{ marginRight: 8 }} /> : <RightOutlined style={{ marginRight: 8 }} />}
          配置市场
        </div>
        {marketOpen && (
          <div style={{ padding: '8px 0 0 0' }}>
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
                      <Button type="link" icon={<PlusOutlined />} onClick={() => handleAddModel()} style={{ marginTop: 6, padding: 0 }}>添加模型</Button>
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
      {/* 配置弹窗 */}
      {modalType === 'model' ? (
        <ModelConfigModal
          open={modalOpen}
          onCancel={() => setModalOpen(false)}
          onSave={handleModelSave}
          initialValues={editIndex !== null ? modelConfigs[editIndex] : MODEL_TEMPLATES[0].defaultConfig}
        />
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