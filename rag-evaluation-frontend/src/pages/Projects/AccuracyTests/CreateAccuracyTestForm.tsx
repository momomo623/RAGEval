import React, { useEffect, useState } from 'react';
import { Form, Input, Select, Button, InputNumber, Card, message, Spin, Switch, Space, Tooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { AccuracyTestCreate, accuracyService } from '@services/accuracy/accuracy.service';
import { datasetService } from '../../../services/dataset.service';
import { AccuracyPromptGenerator } from './prompt';

const { Option } = Select;
const { TextArea } = Input;

interface CreateAccuracyTestFormProps {
  projectId: string;
  onSuccess: (testId: string) => void;
  onCancel: () => void;
}

export const CreateAccuracyTestForm: React.FC<CreateAccuracyTestFormProps> = ({
  projectId,
  onSuccess,
  onCancel
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [evaluationDimensions, setEvaluationDimensions] = useState<string[]>(['事实准确性']);
  const [weights, setWeights] = useState<Record<string, number>>({ '事实准确性': 1.0 });
  const [useCustomPrompt, setUseCustomPrompt] = useState(false);
  
  // 添加自定义评分方法状态
  const [isCustomScoring, setIsCustomScoring] = useState(false);
  
  // 添加版本相关状态
  const [versions, setVersions] = useState<any[]>([]);
  const [versionLoading, setVersionLoading] = useState(false);
  
  // 默认的自定义提示词模板
  const defaultCustomPromptTemplate = `你是一个专业的RAG系统评估专家。请根据问题、参考答案和RAG系统的回答，评估回答的质量。

问题：{{question}}
参考答案：{{reference_answer}}
RAG回答：{{rag_answer}}

请从以下维度评估RAG回答的质量：
1. 事实准确性：回答内容是否与参考答案在事实层面保持一致
2. 信息完整性：回答是否涵盖了参考答案的关键信息点

任务要求：
- 逐个维度判断回答与正确答案的匹配程度。
- 生成总体评分，并提供评估理由（不超过10个字）。
- 在分析过程中，请逐步思考，但每个步骤的描述尽量简洁（不超过10个字）。
- 使用分隔符"####"来区分思考过程与最终答案。

思考1:（不超过10个字）
思考2:（不超过10个字）
...
####

\`\`\`yaml
overall_score: [0-2的平均分]
dimension_scores:
  - 事实准确性: [0-2]
  - 信息完整性: [0-2]
evaluation_reason: |
  - 针对各维度的详细评分理由。
  - 说明回答与正确答案的匹配情况，并解释原因。
\`\`\``;
  
  // 加载数据集
  useEffect(() => {
    const fetchDatasets = async () => {
      try {
        const data = await datasetService.getProjectDatasets(projectId);
        setDatasets(data);
      } catch (error) {
        console.error('获取数据集失败:', error);
        message.error('获取数据集失败');
      }
    };
    
    fetchDatasets();
  }, [projectId]);
  
  // 处理数据集变更，加载对应版本
  const handleDatasetChange = async (datasetId: string) => {
    // 清空当前版本选择
    form.setFieldsValue({ version: undefined });
    
    if (!datasetId) {
      setVersions([]);
      return;
    }
    
    // 加载新数据集的版本
    setVersionLoading(true);
    try {
      const versionData = await accuracyService.getDatasetRagVersions(datasetId);
      setVersions(versionData || []);
      
      // 如果只有一个版本，自动选择
      if (versionData && versionData.length === 1) {
        form.setFieldsValue({ version: versionData[0] });
      }
    } catch (error) {
      console.error('获取RAG回答版本失败:', error);
      message.error('获取RAG回答版本失败');
    } finally {
      setVersionLoading(false);
    }
  };
  
  const handleEvaluationDimensionsChange = (values: string[]) => {
    setEvaluationDimensions(values);
    
    // 更新权重对象，保留已有维度的权重，为新维度设置默认权重1.0
    const newWeights: Record<string, number> = {};
    values.forEach(dim => {
      newWeights[dim] = weights[dim] || 1.0;
    });
    setWeights(newWeights);
  };
  
  const handleWeightChange = (dimension: string, value: number | null) => {
    if (value !== null) {
      const newWeights = { ...weights };
      newWeights[dimension] = value;
      setWeights(newWeights);
    }
  };
  
  // 添加一个函数来获取生成的提示词
  const getPromptTemplate = (values: any) => {
    // 将表单中的评分方法映射到AccuracyPromptGenerator中的类型
    const scoringMethodMap: Record<string, 'binary' | 'three_point' | 'five_point'> = {
      'binary': 'binary',
      'three_scale': 'three_point',
      'five_scale': 'five_point'
    };
    
    // 获取映射后的评分方法类型
    const promptType = scoringMethodMap[values.scoring_method];
    
    if (!promptType) {
      message.error('不支持的评分方法类型');
      return '';
    }
    
    // 使用AccuracyPromptGenerator生成提示词
    return AccuracyPromptGenerator.generate(
      promptType,
      {
        question: '{{question}}',
        reference_answer: '{{reference_answer}}',
        rag_answer: '{{rag_answer}}',
        dimensions: evaluationDimensions
      }
    );
  };
  
  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      // 获取提示词模板
      const promptTemplate = useCustomPrompt ? values.prompt_template : getPromptTemplate(values);
      
      // 构建提交数据
      const data: AccuracyTestCreate = {
        project_id: projectId,
        name: values.name,
        description: values.description,
        dataset_id: values.dataset_id,
        evaluation_type: values.evaluation_type,
        scoring_method: values.scoring_method,
        dimensions: evaluationDimensions,
        weights: weights,
        version: values.version,
        prompt_template: promptTemplate
      };
      
      const response = await accuracyService.create(data);
      message.success('精度测试创建成功');
      onSuccess(response.id);
    } catch (error) {
      console.error('创建精度测试失败:', error);
      message.error('创建精度测试失败: ' + (error.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };
  
  // 在自定义提示词表单项中初始化值
  useEffect(() => {
    if (useCustomPrompt && form.getFieldValue('scoring_method')) {
      // 当切换到自定义提示词时，以生成的提示词为初始值
      form.setFieldsValue({
        prompt_template: getPromptTemplate(form.getFieldsValue())
      });
    }
  }, [useCustomPrompt, form]);

  // 当评分方法或评估维度变化时，更新自定义提示词的默认值
  useEffect(() => {
    if (useCustomPrompt && form.getFieldValue('scoring_method')) {
      form.setFieldsValue({
        prompt_template: getPromptTemplate(form.getFieldsValue())
      });
    }
  }, [form.getFieldValue('scoring_method'), evaluationDimensions]);

  // 处理评分方法变更
  const handleScoringMethodChange = (value: string) => {
    setIsCustomScoring(value === 'custom');
    // 如果选择了自定义，强制开启自定义提示词并设置默认模板
    if (value === 'custom') {
      setUseCustomPrompt(true);
      form.setFieldsValue({
        custom_prompt_template: defaultCustomPromptTemplate
      });
    }
  };

  // 验证提示词是否包含必要变量
  const validatePromptTemplate = (rule: any, value: string) => {
    if (!value) {
      return Promise.reject('请输入评测提示词模板');
    }
    
    const requiredVariables = ['{{question}}', '{{reference_answer}}', '{{rag_answer}}'];
    const missingVariables = requiredVariables.filter(variable => !value.includes(variable));
    
    if (missingVariables.length > 0) {
      return Promise.reject(`提示词模板必须包含以下变量：${missingVariables.join('、')}`);
    }
    
    // 检查是否包含固定的任务要求和输出格式
    const requiredElements = [
      '任务要求',
      '逐个维度判断回答与正确答案的匹配程度',
      '生成总体评分，并提供评估理由（不超过10个字）',
      '使用分隔符"####"来区分思考过程与最终答案',
      'overall_score:',
      'dimension_scores:',
      'evaluation_reason:'
    ];
    
    const missingElements = requiredElements.filter(element => !value.includes(element));
    
    if (missingElements.length > 0) {
      return Promise.reject('提示词模板必须包含固定的任务要求和输出格式，请勿修改关键部分');
    }
    
    return Promise.resolve();
  };

  return (
    <div style={{ padding: '20px 0' }}>
      <Spin spinning={loading}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            name: `${new Date().toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' })} - 精度测试`,
            evaluation_type: 'ai',
            scoring_method: 'five_scale'
          }}
        >
          <Form.Item
            name="name"
            label="测试名称"
            rules={[{ required: true, message: '请输入测试名称' }]}
          >
            <Input placeholder="请输入测试名称" />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="测试描述"
          >
            <TextArea rows={3} placeholder="请输入测试描述" />
          </Form.Item>
          
          <Form.Item
            name="dataset_id"
            label="数据集"
            rules={[{ required: true, message: '请选择数据集' }]}
          >
            <Select 
              placeholder="请选择数据集" 
              onChange={handleDatasetChange}
            >
              {datasets.map(dataset => (
                // question_count是数据集中的问题数量
                <Option key={dataset.id} value={dataset.id}>{dataset.name}（{dataset.question_count}个问题）</Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="version"
            label="RAG回答版本"
            rules={[{ required: true, message: '请选择RAG回答版本' }]}
          >
            <Select 
              placeholder="请选择RAG回答版本" 
              loading={versionLoading}
              disabled={!form.getFieldValue('dataset_id') || versionLoading}
            >
              {versions.map((version) => (
                <Option key={version.version} value={version.version}>{version.version} ({version.count}个问题)</Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="evaluation_type"
            label="评测方式"
            rules={[{ required: true, message: '请选择评测方式' }]}
          >
            <Select placeholder="请选择评测方式">
              <Option value="ai">AI评测</Option>
              <Option value="manual">人工评测（开发中）</Option>
              <Option value="hybrid">混合评测（先AI后人工）（开发中）</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            name="scoring_method"
            label="评分方法"
            rules={[{ required: true, message: '请选择评分方法' }]}
          >
            <Select placeholder="请选择评分方法" onChange={handleScoringMethodChange}>
              <Option value="binary">二元评分（正确/错误）</Option>
              <Option value="three_scale">三分量表（0-2分）</Option>
              <Option value="five_scale">五分量表（0-4分）</Option>
              <Option value="custom">自定义评分方法</Option>
            </Select>
          </Form.Item>
          
          {/* 自定义评分方法面板 */}
          {isCustomScoring && (
            <Card title="自定义评分方法配置" size="small" style={{ marginBottom: 24 }}>
              <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f6f8fa', borderRadius: 6 }}>
                <h4 style={{ margin: 0, marginBottom: 8, color: '#1890ff' }}>配置说明</h4>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: '#666' }}>
                  <li>请自定义评测提示词，设计您需要的评测维度和评分标准</li>
                  <li>必须包含变量：<code>{'{{question}}'}</code>、<code>{'{{reference_answer}}'}</code>、<code>{'{{rag_answer}}'}</code></li>
                  <li>任务要求和输出格式（YAML部分）不可修改，确保系统能正确解析评测结果</li>
                  
                </ul>
              </div>

              <Form.Item
                name="custom_prompt_template"
                label={
                  <Space>
                    评测提示词模板
                    <Tooltip title="自定义评测提示词，必须包含指定变量和固定的输出格式">
                      <QuestionCircleOutlined />
                    </Tooltip>
                  </Space>
                }
                rules={[{ validator: validatePromptTemplate }]}
              >
                <TextArea 
                  rows={20} 
                  placeholder="请输入自定义评测提示词模板..."
                  style={{ fontFamily: 'Monaco, Consolas, "Courier New", monospace' }}
                />
              </Form.Item>

              <div style={{ marginTop: 12, padding: 12, backgroundColor: '#fff7e6', borderRadius: 6, border: '1px solid #ffd591' }}>
                <h4 style={{ margin: 0, marginBottom: 8, color: '#fa8c16' }}>重要提醒</h4>
                <p style={{ margin: 0, fontSize: 12, color: '#666' }}>
                  • 任务要求部分（包含"逐个维度判断"、"生成总体评分"等描述）不可修改<br/>
                  • YAML输出格式（overall_score、dimension_scores、evaluation_reason）不可修改<br/>
                  • 您可以自定义评测维度、评分标准和具体的评测逻辑
                </p>
              </div>
            </Card>
          )}
          
          {/* 标准评测维度（仅在非自定义模式下显示） */}
          {!isCustomScoring && (
            <Form.Item
              label={
                <Space>
                  评测维度
                  <Tooltip title="选择用于评估RAG回答质量的维度，也可输入自定义维度">
                    <QuestionCircleOutlined />
                  </Tooltip>
                </Space>
              }
              name="dimensions"
              initialValue={['事实准确性']}
            >
              <Select
                mode="tags"
                placeholder="请选择或输入评测维度"
                onChange={handleEvaluationDimensionsChange}
                tokenSeparators={[',']}
              >
                {/* 预设的评测维度选项 */}
                <Option value="事实准确性">事实准确性</Option>
                <Option value="语义匹配度">语义匹配度</Option>
                <Option value="信息完整性">信息完整性</Option>
                <Option value="逻辑一致性">逻辑一致性</Option>
              </Select>
              <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>
                💡 提示：可以自定义评测维度，输入回车即可添加
              </div>
            </Form.Item>
          )}
          
          {/* 自定义提示词开关（仅在非自定义评分模式下显示） */}
          {!isCustomScoring && (
            <Form.Item>
              <Space>
                <Switch 
                  checked={useCustomPrompt} 
                  onChange={setUseCustomPrompt} 
                />
                <span>使用自定义评测提示词</span>
                <Tooltip title="自定义提示词可以精确控制大模型的评测行为">
                  <QuestionCircleOutlined />
                </Tooltip>
              </Space>
            </Form.Item>
          )}
          
          {/* 自定义提示词输入框（仅在标准模式下的自定义提示词开启时显示） */}
          {!isCustomScoring && useCustomPrompt && (
            <Form.Item
              name="prompt_template"
              label="评测提示词模板"
              rules={[{ required: true, message: '请输入提示词模板' }]}
            >
              <TextArea rows={10} placeholder="请输入提示词模板" />
            </Form.Item>
          )}
          
          <Form.Item>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button onClick={onCancel}>取消</Button>
              <Button type="primary" htmlType="submit">
                创建测试
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Spin>
    </div>
  );
}; 