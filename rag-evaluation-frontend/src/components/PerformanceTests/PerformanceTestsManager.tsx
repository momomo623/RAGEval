import React, { useState, useEffect } from 'react';
import { 
  Card, Button, Divider, Table, Tag, Space, Progress, 
  Modal, Form, Input, Select, message, Descriptions, Spin,
  Typography, InputNumber, Alert
} from 'antd';
import { 
  PlayCircleOutlined, PlusOutlined, SyncOutlined, 
  CheckCircleOutlined, CloseCircleOutlined, EyeOutlined
} from '@ant-design/icons';
import { performanceService } from '../../services/performance.service';
import { executePerformanceTest, TestProgress } from '../../services/performanceExecutor';
import { TimeAgo } from '../common/TimeAgo';
import styles from './PerformanceTests.module.css';
import { CreatePerformanceTestForm } from './CreatePerformanceTestForm';
import { datasetService } from '../../services/dataset.service';
import { useConfigContext } from '../../contexts/ConfigContext';
import ConfigButton from '../../components/ConfigButton';
import { PerformanceTestDetail } from './PerformanceTestDetail';

const { Title, Text } = Typography;
const { Option } = Select;

interface PerformanceTestsManagerProps {
  projectId: string;
}

export const PerformanceTestsManager: React.FC<PerformanceTestsManagerProps> = ({ projectId }) => {
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tests, setTests] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [runningTestId, setRunningTestId] = useState<string | null>(null);
  const [progress, setProgress] = useState<TestProgress | null>(null);
  const [testQuestions, setTestQuestions] = useState<any[]>([]);
  const { getRAGConfig } = useConfigContext();
  const [showConfigWarning, setShowConfigWarning] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);

  useEffect(() => {
    fetchTests();
  }, [projectId]);

  const fetchTests = async () => {
    try {
      setLoading(true);
      const data = await performanceService.getByProject(projectId);
      setTests(data);
    } catch (error) {
      console.error("获取性能测试列表失败:", error);
      message.error("获取性能测试列表失败");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const newTest = await performanceService.create({
        project_id: projectId,
        name: values.name,
        description: values.description,
        concurrency: values.concurrency,
        dataset_id: values.dataset_id
      });
      setModalVisible(false);
      form.resetFields();
      message.success("创建性能测试成功");
      fetchTests();
    } catch (error) {
      console.error("创建性能测试失败:", error);
      message.error("创建性能测试失败");
    }
  };

  const fetchTestQuestions = async (test: any) => {
    try {
      // 首先获取测试关联的数据集ID
      const datasetId = test.dataset_id;
      
      if (!datasetId) {
        message.error("测试没有关联数据集");
        return [];
      }
      
      // 使用datasetService获取该数据集的问题
      const result = await datasetService.getQuestions(datasetId);
      return result.questions || [];
    } catch (error) {
      console.error("获取测试问题失败:", error);
      message.error("获取测试问题失败");
      return [];
    }
  };

  const handleRunTest = async (test: any) => {
    try {
      // 检查RAG配置是否存在
      const ragConfig = getRAGConfig();
      if (!ragConfig) {
        setShowConfigWarning(true);
        message.warning("请先配置RAG系统后再运行测试");
        return;
      }
      
      setShowConfigWarning(false);
      setRunningTestId(test.id);
      setProgress({
        total: 0,
        completed: 0,
        success: 0,
        failed: 0,
        startTime: performance.now()
      });

      const questions = await fetchTestQuestions(test);
      setTestQuestions(questions);
      
      if (!questions || questions.length === 0) {
        message.error("测试中没有问题，无法执行");
        setRunningTestId(null);
        return;
      }
      
      setProgress({
        total: questions.length,
        completed: 0,
        success: 0,
        failed: 0,
        startTime: performance.now()
      });
      
      const success = await executePerformanceTest(
        // test.id,
        test,
        questions,
        // test.concurrency,
        (currentProgress: TestProgress) => {
          setProgress(currentProgress);
        }
      );
      
      if (success) {
        message.success("性能测试完成");
        fetchTests();
      } else {
        message.error("性能测试执行失败");
      }
    } catch (error) {
      console.error("执行性能测试失败:", error);
      message.error("执行性能测试失败: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setRunningTestId(null);
    }
  };

  const handleCreateNew = () => {
    setView('create');
  };

  const handleViewDetail = (id: string) => {
    setSelectedTestId(id);
    setDetailVisible(true);
  };

  const handleBackToList = () => {
    setView('list');
    setSelectedTestId(null);
  };

  const handleCreateSuccess = (testId: string) => {
    setSelectedTestId(testId);
    setView('detail');
  };

  return (
    <div className={styles.container}>
      {showConfigWarning && (
        <Alert
          message="RAG系统未配置"
          description="性能测试需要RAG系统配置才能运行，请先完成配置"
          type="warning"
          showIcon
          action={
            <ConfigButton text="立即配置" type="primary" size="small" />
          }
          style={{ marginBottom: 16 }}
        />
      )}
      
      <div className={styles.header}>
        <Title level={4}>性能测试</Title>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={() => setModalVisible(true)}
        >
          新建测试
        </Button>
      </div>
      
      {runningTestId && progress && (
        <Card className={styles.progressCard}>
          <Title level={5}>测试进行中</Title>
          <Progress 
            percent={Math.floor((progress.completed / progress.total) * 100)} 
            status="active"
          />
          <Descriptions column={2}>
            <Descriptions.Item label="总问题数">{progress.total}</Descriptions.Item>
            <Descriptions.Item label="已完成">{progress.completed}</Descriptions.Item>
            <Descriptions.Item label="成功">{progress.success}</Descriptions.Item>
            <Descriptions.Item label="失败">{progress.failed}</Descriptions.Item>
            {progress.averageResponseTime && (
              <Descriptions.Item label="平均响应时间">
                {(progress.averageResponseTime / 1000).toFixed(2)}秒
              </Descriptions.Item>
            )}
            {progress.remainingTimeEstimate && (
              <Descriptions.Item label="预计剩余时间">
                {(progress.remainingTimeEstimate / 1000).toFixed(0)}秒
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>
      )}
      
      <Table 
        loading={loading}
        dataSource={tests}
        rowKey="id"
        columns={[
          {
            title: '名称',
            dataIndex: 'name',
            key: 'name',
          },
          {
            title: '版本',
            dataIndex: 'version',
            key: 'version',
          },
          {
            title: '并发数',
            dataIndex: 'concurrency',
            key: 'concurrency',
          },
          //         "name": "1",
        // "project_id": "74cf7b69-020d-47f1-bcb9-ccd84723697c",
        // "dataset_id": "ac1d69a6-fc9a-46ef-bca6-9724b89f58b5",
        // "description": null,
        // "concurrency": 1,
        // "version": "1",
        // "config": {},
        // "id": "5dccf809-347c-44e0-bf62-8f49fee8da8c",
        // "created_at": "2025-03-26T02:41:29.225297Z",
        // "started_at": null,
        // "completed_at": null,
        // "status": "created",
        // "total_questions": 45,
        // "processed_questions": 0,
        // "success_questions": 0,
        // "failed_questions": 0,
        // "summary_metrics": {}
        // 问题数
        {
          title: '问题数',
          dataIndex: 'total_questions',
          key: 'total_questions',
        },
        // 成功率
        {
          title: '成功率',
          dataIndex: 'success_questions',
          key: 'success_questions',
        },
        // 平均响应时间
        {
          title: '平均响应时间',
          dataIndex: 'average_response_time',
          key: 'average_response_time',
        },
        // 版本
       

          {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status) => {
              let color = 'default';
              let icon = null;
              
              switch(status) {
                case 'completed':
                  color = 'success';
                  icon = <CheckCircleOutlined />;
                  break;
                case 'running':
                  color = 'processing';
                  icon = <SyncOutlined spin />;
                  break;
                case 'failed':
                  color = 'error';
                  icon = <CloseCircleOutlined />;
                  break;
              }
              
              return (
                <Tag color={color} icon={icon}>
                  {status === 'completed' ? '已完成' : 
                   status === 'running' ? '运行中' : 
                   status === 'failed' ? '失败' : status}
                </Tag>
              );
            }
          },
          {
            title: '创建时间',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (time) => <TimeAgo date={time} />
          },
          {
            title: '操作',
            key: 'action',
            width: 180,
            render: (_, record) => (
              <Space size="middle">
                <Button 
                  type="primary" 
                  icon={<PlayCircleOutlined />}
                  disabled={record.status === 'running' || runningTestId !== null}
                  onClick={() => handleRunTest(record)}
                  title="运行测试"
                />
                <Button 
                  icon={<EyeOutlined />}
                  onClick={() => handleViewDetail(record.id)}
                  title="查看详情"
                />
              </Space>
            ),
          },
        ]}
      />
      
      <Modal
        title="新建性能测试"
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        destroyOnClose
        width={600}
      >
        <CreatePerformanceTestForm 
          projectId={projectId}
          onSuccess={(testId) => {
            setModalVisible(false);
            fetchTests();
          }}
          onCancel={() => setModalVisible(false)}
        />
      </Modal>
      
      <PerformanceTestDetail
        visible={detailVisible}
        testId={selectedTestId}
        onClose={() => setDetailVisible(false)}
      />
    </div>
  );
}; 