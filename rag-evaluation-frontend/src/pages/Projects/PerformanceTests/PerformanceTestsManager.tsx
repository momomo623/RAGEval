import React, { useState, useEffect } from 'react';
import { 
  Card, Button, Divider, Table, Tag, Space, Progress, 
  Modal, Form, Input, Select, message, Descriptions, Spin,
  Typography, InputNumber, Alert, Statistic
} from 'antd';
import { 
  PlayCircleOutlined, PlusOutlined, SyncOutlined, 
  CheckCircleOutlined, CloseCircleOutlined, EyeOutlined
} from '@ant-design/icons';
import { performanceService } from '../../../services/performance.service';
import { executePerformanceTest, TestProgress } from '../../../services/performanceExecutor';
import { TimeAgo } from '../../../components/common/TimeAgo';
import styles from './PerformanceTests.module.css';
import { CreatePerformanceTestForm } from './CreatePerformanceTestForm';
import { datasetService } from '../../../services/dataset.service';
import { useConfigContext } from '../../../contexts/ConfigContext';
import ConfigButton from '../../../components/ConfigButton';
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
    if (runningTestId) {
      message.warning('已有测试正在运行，请等待完成');
      return;
    }

    try {
      setRunningTestId(test.id);
      setSelectedTestId(test.id);
      setProgress(null);

      // 检查RAG配置
      const ragConfig = getRAGConfig();
      if (!ragConfig) {
        setShowConfigWarning(true);
        setRunningTestId(null);
        return;
      }

      // 防止total被覆盖的进度状态管理器
      let progressState = {
        total: 0,
        completed: 0,
        success: 0,
        failed: 0,
        startTime: performance.now()
      };

      // 直接使用新的缓冲区方式执行测试，无需预先获取全部问题
      const success = await executePerformanceTest(
        test,
        [], // 传递空数组，让函数使用缓冲区方式
        (currentProgress: TestProgress) => {
          console.log('currentProgress', currentProgress);
          
          // 确保total被正确保留
          if (currentProgress.total > 0) {
            progressState.total = currentProgress.total;
          }
          
          // 确保其他字段也被更新
          progressState = {
            ...progressState,
            ...currentProgress,
            total: progressState.total > 0 ? progressState.total : currentProgress.total
          };
          
          console.log('设置到UI的进度状态', progressState);
          setProgress({...progressState});
        }
      );

      if (success) {
        message.success('测试执行完成');
        fetchTests(); // 刷新测试列表
      } else {
        message.error('测试执行失败');
      }
    } catch (error) {
      console.error('运行测试失败:', error);
      message.error('运行测试失败: ' + (error as any).message);
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
          <Progress 
            percent={Math.round((progress.completed / (progress.total || 1)) * 100)} 
            status="active"
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068',
            }}
          />
          <div style={{ marginTop: 12 }}>
            <Space>
              <Statistic title="总问题数" value={progress.total || '计算中...'} />
              <Statistic title="已完成" value={progress.completed} />
              <Statistic title="成功率" value={`${Math.round((progress.success / (progress.completed || 1)) * 100)}%`} />
              {progress.averageResponseTime && (
                <Statistic 
                  title="平均响应时间" 
                  value={progress.averageResponseTime.toFixed(2)} 
                  suffix="秒" 
                />
              )}
            </Space>
          </div>
        </Card>
      )}
      
      <Table 
        loading={loading}
        dataSource={tests}
        rowKey="id"
        // 内容居中显示
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
            // tag 固定长度 内部居中  
            render: (version) => <Tag color="blue" style={{ minWidth: '40px', textAlign: 'center' }}>{version}</Tag>
          },
          {
            title: '并发数',
            dataIndex: 'concurrency',
            key: 'concurrency',
            render: (concurrency) => <Tag color="" style={{ minWidth: '40px', textAlign: 'center' }}>{concurrency}</Tag>
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
        {
          title: '成功率',
          key: 'success_rate',
          render: (_: any, record: any) => {
            if (record.status === 'completed' && record.total_questions > 0) {
              const successRate = (record.success_questions / record.total_questions * 100).toFixed(2);
              return <span>{successRate}%</span>;
            }
            return '-';
          },
        },
        {
          title: '平均响应时间',
          key: 'avg_response_time',
          render: (_, record: any) => {
            if (record.status === 'completed' && record.summary_metrics?.response_time?.total_time?.avg) {
              return <span>{record.summary_metrics.response_time.total_time.avg.toFixed(2)} 秒</span>;
            }
            return '-';
          },
        },
        // 成功率
        // {
        //   title: '成功率',
        //   dataIndex: 'success_questions',
        //   key: 'success_questions',
        // },
        // // 平均响应时间
        // {
        //   title: '平均响应时间',
        //   dataIndex: 'average_response_time',
        //   key: 'average_response_time',
        // },
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