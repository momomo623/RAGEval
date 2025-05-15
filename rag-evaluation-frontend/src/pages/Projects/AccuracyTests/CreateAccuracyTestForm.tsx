import React, { useEffect, useState } from 'react';
import { Form, Input, Select, Button, InputNumber, Card, message, Spin, Switch, Space, Tooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { AccuracyTestCreate, accuracyService } from '@services/accuracy/accuracy.service';
import { datasetService } from '../../../services/dataset.service';
import { AccuracyPromptGenerator } from './prompt';
import { useConfigContext } from '../../../contexts/ConfigContext';

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
  
  // 添加配置上下文
  const { getLLMConfig } = useConfigContext();
  const config = getLLMConfig();
  // useEffect(() => {
  //   // 检查LLM配置
  //   const llmConfig = getLLMConfig();
  // }, [getLLMConfig]);

      
  // 添加版本相关状态
  const [versions, setVersions] = useState<string[]>([]);
  const [versionLoading, setVersionLoading] = useState(false);
  
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

  return (
    <div style={{ padding: '20px 0' }}>
      <Spin spinning={loading}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            name: `精度测试-${new Date().toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' })}`,
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
              {versions.map(version => (
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
            <Select placeholder="请选择评分方法">
              <Option value="binary">二元评分（正确/错误）</Option>
              <Option value="three_scale">三分量表（0-2分）</Option>
              <Option value="five_scale">五分量表（1-5分）</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            label={
              <Space>
                评测维度
                <Tooltip title="选择用于评估RAG回答质量的维度">
                  <QuestionCircleOutlined />
                </Tooltip>
              </Space>
            }
            name="dimensions"
            initialValue={['事实准确性']}
          >
            <Select
              mode="multiple"
              placeholder="请选择评测维度"
              onChange={handleEvaluationDimensionsChange}
            >
            {/* 语义匹配度、事实准确性、信息完整性等 */}
            <Option value="事实准确性">事实准确性</Option>
            <Option value="语义匹配度">语义匹配度</Option>
              <Option value="信息完整性">信息完整性</Option>

            </Select>
          </Form.Item>
          
          {/* 权重设置 */}
          {/* <Card title="维度权重设置" size="small" style={{ marginBottom: 24 }}>
            {evaluationDimensions.map(dimension => (
              <Form.Item 
                key={dimension} 
                label={`${dimension} 权重`}
                style={{ marginBottom: 12 }}
              >
                <InputNumber 
                  min={0.1}
                  max={10.0}
                  step={0.1}
                  defaultValue={1.0}
                  value={weights[dimension]}
                  onChange={(value) => handleWeightChange(dimension, value)}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            ))}
          </Card> */}
          
          {/* 自定义提示词开关 */}
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
          
          {/* 自定义提示词输入框 */}
          {useCustomPrompt && (
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