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
import { ConfigManager, RAGConfig } from '../../../utils/configManager';

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
  const [isConfigured, setIsConfigured] = useState(false);
  const [stoppingTest, setStoppingTest] = useState(false);

  useEffect(() => {
    // 使用ConfigManager检查RAG系统配置
    const checkRAGConfig = async () => {
      const configManager = ConfigManager.getInstance();
      const configs = await configManager.getAllConfigs<RAGConfig>('rag');
      setIsConfigured(configs.length > 0);
    };
    checkRAGConfig();
  }, []);

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
      // const ragConfig = getRAGConfig();
      if (!isConfigured) {
        setShowConfigWarning(true);
        setRunningTestId(null);
        message.warning('未配置RAG系统，请先配置RAG系统才能使用性能测试功能');
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

  const formatTime = (milliseconds: number): string => {
    if (!milliseconds || isNaN(milliseconds)) return '计算中...';
    
    // 确保毫秒值是一个有效的数字
    const ms = Math.abs(Math.floor(milliseconds));
    
    // 转换为秒
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    // 格式化为时:分:秒
    const formattedHours = hours.toString().padStart(2, '0');
    const formattedMinutes = (minutes % 60).toString().padStart(2, '0');
    const formattedSeconds = (seconds % 60).toString().padStart(2, '0');
    
    if (hours > 0) {
      return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
    } else {
      return `${formattedMinutes}:${formattedSeconds}`;
    }
  };

  const handleStopTest = async () => {
    if (!runningTestId) return;
    
    try {
      setStoppingTest(true);
      await performanceService.cancel(runningTestId);
      message.success('已停止测试');
      fetchTests(); // 刷新测试列表以更新状态
    } catch (error) {
      console.error('停止测试失败:', error);
      message.error('停止测试失败');
    } finally {
      setStoppingTest(false);
      setRunningTestId(null);
    }
  };

  return (
    <div className={styles.container}>
      {/* {showConfigWarning && (
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
      )} */}
      
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
      {!isConfigured && (
        <Alert
          message="RAG系统接口未配置"
          description="性能测试需要RAG系统接口配置才能运行，请先完成配置"
          action={
            <ConfigButton text="立即配置" type="primary" size="small" />
          }
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      
      
      {runningTestId && progress && (
        <Card className={styles.progressCard}>
          <div className={styles.progressHeader}>
            <div>
              <Typography.Title level={5}>正在执行性能测试</Typography.Title>
              <Typography.Text type="secondary">
                {tests.find(t => t.id === runningTestId)?.name || ""}
              </Typography.Text>
            </div>
            {/* <Button 
              danger 
              onClick={handleStopTest}
            >
              停止测试
            </Button> */}
          </div>
          
          <Progress 
            percent={Math.round((progress.completed / (progress.total || 1)) * 100)} 
            status="active"
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068',
            }}
          />
          
          <div className={styles.progressDetails}>
            <div className={styles.progressStat}>
              <div className={styles.progressLabel}>总问题数</div>
              <div className={styles.progressValue}>{progress.total || '计算中...'}</div>
            </div>
          
            <div className={styles.progressStat}>
              <div className={styles.progressLabel}>成功</div>
              <div className={styles.progressValue}>{progress.success}</div>
            </div>
            <div className={styles.progressStat}>
              <div className={styles.progressLabel}>失败</div>
              <div className={styles.progressValue}>{progress.failed}</div>
            </div>
            
            <div className={styles.progressStat}>
              <div className={styles.progressLabel}>平均响应时间</div>
              <div className={styles.progressValue}>
              {progress.averageResponseTime ? (
                progress.averageResponseTime.toFixed(2) + ' 秒'
              ) : (
                '计算中...'
              )}
              </div>
            </div>
            <div className={styles.progressStat}>
              <div className={styles.progressLabel}>已用时间</div>
              <div className={styles.progressValue}>{formatTime(progress.elapsedTime || 0)}</div>
            </div>
            <div className={styles.progressStat}>
              <div className={styles.progressLabel}>预计剩余</div>
              <div className={styles.progressValue}>{formatTime(progress.remainingTimeEstimate || 0)}</div>
            </div>
            {/* <Statistic 
                  title="平均响应时间" 
                  value={progress.averageResponseTime.toFixed(2)} 
                  suffix="秒" 
                /> */}
            
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
          dataIndex: 'processed_questions',
          key: 'processed_questions',
          render: (processed_questions) => <Tag  style={{ minWidth: '40px', textAlign: 'center' }}>{processed_questions}</Tag>
        },
        {
          title: '成功率',
          key: 'success_rate',
          // 标签 内部居中
          render: (_: any, record: any) => {
            if (record.status === 'completed' && record.total_questions > 0) {
              const successRate = (record.success_questions / record.processed_questions * 100).toFixed(0);
              return <Tag color="green" style={{ minWidth: '40px', textAlign: 'center' }}>
                {successRate}%</Tag>;
            }
            return '-';
          },
        },
        {
          title: '平均响应时间',
          key: 'avg_response_time',
          render: (_, record: any) => {
            if (record.status === 'completed' && record.summary_metrics?.response_time?.total_time?.avg) {
              return <Tag color="blue" style={{ minWidth: '40px', textAlign: 'center' }}>{record.summary_metrics.response_time.total_time.avg.toFixed(2)} 秒</Tag>;
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