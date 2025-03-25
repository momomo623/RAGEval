import React, { useEffect, useState } from 'react';
import { Form, Input, Select, Button, InputNumber, Card, message, Spin } from 'antd';
import { PerformanceTestCreate, performanceService } from '../../services/performance.service';
import { datasetService } from '../../services/dataset.service';

const { Option } = Select;
const { TextArea } = Input;

interface CreatePerformanceTestFormProps {
  projectId: string;
  onSuccess: (testId: string) => void;
  onCancel: () => void;
}

export const CreatePerformanceTestForm: React.FC<CreatePerformanceTestFormProps> = ({
  projectId,
  onSuccess,
  onCancel
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loadingDatasets, setLoadingDatasets] = useState(false);

  // 加载项目的数据集
  useEffect(() => {
    const fetchDatasets = async () => {
      if (!projectId) return;
      
      setLoadingDatasets(true);
      try {
        const data = await datasetService.getProjectDatasets(projectId);
        setDatasets(data);
      } catch (error) {
        console.error('获取数据集失败:', error);
        message.error('获取数据集失败');
      } finally {
        setLoadingDatasets(false);
      }
    };

    fetchDatasets();
  }, [projectId]);

  const handleSubmit = async (values: any) => {
    if (!projectId) {
      message.error('未找到项目ID');
      return;
    }

    setLoading(true);
    try {
      const testData: PerformanceTestCreate = {
        ...values,
        project_id: projectId,
      };

      const result = await performanceService.create(testData);
      message.success('性能测试创建成功');
      onSuccess(result.id);
    } catch (error) {
      console.error('创建性能测试失败:', error);
      message.error('创建性能测试失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="创建性能测试" bordered={false}>
      <Spin spinning={loading || loadingDatasets}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            concurrency: 1,
          }}
        >
          <Form.Item
            name="name"
            label="测试名称"
            rules={[{ required: true, message: '请输入测试名称' }]}
          >
            <Input placeholder="例如：产品知识库性能测试" />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="测试描述"
          >
            <TextArea rows={3} placeholder="描述此次性能测试的目的和内容" />
          </Form.Item>
          
          <Form.Item
            name="dataset_id"
            label="数据集"
            rules={[{ required: true, message: '请选择数据集' }]}
          >
            <Select placeholder="选择要测试的数据集">
              {datasets.map(dataset => (
                <Option key={dataset.id} value={dataset.id}>
                  {dataset.name} ({dataset.question_count || 0}个问题)
                </Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="version"
            label="版本标识"
            rules={[{ required: true, message: '请输入版本标识' }]}
          >
            <Input placeholder="例如：v1.0.0" />
          </Form.Item>
          
          <Form.Item
            name="concurrency"
            label="并发请求数"
            rules={[{ required: true, message: '请输入并发请求数' }]}
          >
            <InputNumber min={1} max={50} style={{ width: '100%' }} />
          </Form.Item>
          
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
    </Card>
  );
}; 