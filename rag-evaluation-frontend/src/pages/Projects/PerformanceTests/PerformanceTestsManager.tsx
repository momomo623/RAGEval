import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card, Button, Divider, Table, Tag, Progress,
  Modal, Form, Input, Select, message, Descriptions, Spin,
  Typography, InputNumber, Alert, Statistic, Tooltip
} from 'antd';
import {
  PlayCircleOutlined, PlusOutlined, SyncOutlined,
  CheckCircleOutlined, CloseCircleOutlined, EyeOutlined
} from '@ant-design/icons';
import { performanceService } from '@services/performance/performance.service';
import { executePerformanceTest, TestProgress } from '@services/performance/performanceExecutorNew';
import { TimeAgo } from '../../../components/common/TimeAgo';
import styles from './PerformanceTests.module.css';
import { CreatePerformanceTestForm } from './CreatePerformanceTestForm';
import { datasetService } from '../../../services/dataset.service';
// import ConfigButton from '../../../components/ConfigButton';
import { PerformanceTestDetail } from './PerformanceTestDetail';
import { ConfigManager, RAGConfig } from '../../../utils/configManager';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

interface PerformanceTestsManagerProps {
  projectId: string;
}

export const PerformanceTestsManager: React.FC<PerformanceTestsManagerProps> = ({ projectId }) => {
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [selectedRagSystemInfo, setSelectedRagSystemInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tests, setTests] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [runningTestId, setRunningTestId] = useState<string | null>(null);
  const [progress, setProgress] = useState<TestProgress | null>(null);
  const progressRef = useRef<TestProgress | null>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout>();
  const [detailVisible, setDetailVisible] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [datasets, setDatasets] = useState<any[]>([]);
  const navigate = useNavigate();

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

    // 加载项目关联的数据集
    const fetchDatasets = async () => {
      try {
        const data = await datasetService.getProjectDatasets(projectId);
        setDatasets(data);
      } catch (error) {
        console.error('获取数据集失败:', error);
      }
    };

    fetchDatasets();

    // 检查是否有运行中的测试
    const checkRunningTests = async () => {
      try {
        const runningTests = tests.filter(test => test.status === 'running');
        if (runningTests.length > 0) {
          // 将运行中的测试标记为中断
          for (const test of runningTests) {
            await performanceService.markInterrupted(test.id);
          }
          // 刷新测试列表
          fetchTests();
        }
      } catch (error) {
        console.error('检查运行中测试失败:', error);
      }
    };

    checkRunningTests();
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



  const handleProgressUpdate = useCallback((newProgress: TestProgress) => {
    progressRef.current = newProgress;

    // 清除之前的定时器
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // 设置新的定时器，确保UI更新
    updateTimeoutRef.current = setTimeout(() => {
      setProgress(newProgress);
    }, 0);
  }, []);

  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  const handleRunTest = async (test: any) => {
    if (runningTestId) {
      message.warning('已有测试正在运行，请等待完成');
      return;
    }

    try {
      setRunningTestId(test.id);
      setSelectedTestId(test.id);
      setProgress(null);

      if (!isConfigured) {
        setRunningTestId(null);
        message.warning('未配置RAG系统，请先配置RAG系统才能使用性能测试功能');
        return;
      }

      // 如果测试状态为中断，先重置测试
      if (test.status === 'interrupted') {
        await performanceService.resetTest(test.id);
      }

      const success = await executePerformanceTest(
        test,
        [], // 传递空数组，让函数使用缓冲区方式
        handleProgressUpdate
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


  const handleViewDetail = (id: string) => {
    // 查找当前测试
    const test = tests.find(t => t.id === id);
    if (test) {

      // 设置RAG系统信息
      if (test.rag_config) {
        // 如果rag_config是形如"type/name"的格式，提取name部分
        const configName = test.rag_config.includes('/') ? test.rag_config.split('/').pop() : test.rag_config;
        setSelectedRagSystemInfo({ name: configName });
      }
    }

    setSelectedTestId(id);
    setDetailVisible(true);
  };


  const formatTime = (milliseconds: number): string => {
    if (!milliseconds || isNaN(milliseconds)) return '计算中...';

    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    const formattedHours = hours.toString().padStart(2, '0');
    const formattedMinutes = (minutes % 60).toString().padStart(2, '0');
    const formattedSeconds = (seconds % 60).toString().padStart(2, '0');

    if (hours > 0) {
      return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
    } else {
      return `${formattedMinutes}:${formattedSeconds}`;
    }
  };


  return (
    <div className={styles.container}>
      {!isConfigured && (
        <Alert
          message="RAG系统接口未配置"
          description="性能测试需要RAG系统接口配置才能运行，请先完成配置"
          action={
            <Button
              type="primary"
              size="small"
              onClick={() => navigate('/user/settings')}
            >
              立即配置
            </Button>
          }
          type="warning"
          showIcon
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
          <div className={styles.progressHeader}>
            <div>
              <Typography.Title level={5}>正在执行性能测试</Typography.Title>
              <Typography.Text type="secondary">
                {tests.find(t => t.id === runningTestId)?.name || ""}
              </Typography.Text>
            </div>
          </div>

          <Progress
            percent={Math.round(((progress.success + progress.failed) / (progress.total || 1)) * 100)}
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
                {progress.averageResponseTime ?
                  progress.averageResponseTime.toFixed(2) + ' 秒' :
                  '计算中...'}
              </div>
            </div>
            <div className={styles.progressStat}>
              <div className={styles.progressLabel}>已用时间</div>
              <div className={styles.progressValue}>
                {formatTime(progress.elapsedTime || 0)}
              </div>
            </div>
            <div className={styles.progressStat}>
              <div className={styles.progressLabel}>预计剩余</div>
              <div className={styles.progressValue}>
                {formatTime(progress.remainingTimeEstimate || 0)}
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className={styles.tableContainer}>
        <Table
          loading={loading}
          dataSource={tests}
          rowKey="id"
          scroll={{ x: 'max-content' }}
          columns={[
          {
            title: '名称',
            dataIndex: 'name',
            key: 'name',
            width: 100,
            ellipsis: true,
            render: (text) => <Tooltip title={text}><span style={{ maxWidth: '100%', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span></Tooltip>
          },
          {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 90,
            align: 'center',
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
                case 'terminated':
                  color = 'warning';
                  icon = <CloseCircleOutlined />;
                  break;
              }

              return (
                <Tag color={color} icon={icon} style={{ whiteSpace: 'nowrap' }}>
                  {status === 'completed' ? '已完成' :
                   status === 'running' ? '运行中' :
                   status === 'failed' ? '失败' :
                   status === 'terminated' ? '已中断' : status}
                </Tag>
              );
            }
          },
          {
            title: '数据集',
            dataIndex: 'dataset_id',
            key: 'dataset_id',
            align: 'center',
            render: (dataset_id) => {
              const dataset = datasets.find((d: any) => d.id === dataset_id);
              return (
                <Tooltip title={dataset ? dataset.name : '未知数据集'}>
                  <Tag style={{ whiteSpace: 'nowrap' }}>
                    {dataset ? dataset.name : '未知数据集'}
                  </Tag>
                </Tooltip>
              );
            }
          },
          {
            title: '问题数',
            dataIndex: 'total_questions',
            key: 'total_questions',
            width: 90,
            render: (total_questions, record) => (
              <Tooltip title={`总问题数：${total_questions}，已处理：${record.processed_questions}`}>
                <Tag style={{ minWidth: '45px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {total_questions}
                </Tag>
              </Tooltip>
            )
          },
          {
            title: '并发数',
            dataIndex: 'concurrency',
            key: 'concurrency',
            width: 100,
            render: (concurrency) => (
              <Tooltip title={`并发请求数：${concurrency}`}>
                <Tag style={{ minWidth: '45px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {concurrency}
                </Tag>
              </Tooltip>
            )
          },{
            title: '版本',
            dataIndex: 'version',
            key: 'version',
            width: 85,
            align: 'center',
            render: (version) => (
              <Tooltip title={`版本：${version}`}>
                <Tag style={{
                  textAlign: 'center',
                  whiteSpace: 'nowrap'
                }}>
                  {version}
                </Tag>
              </Tooltip>
            )
          },{
            title: 'RAG系统',
            dataIndex: 'rag_config',
            key: 'rag_config',
            width: 130,
            render: (rag_config) => {
              if (!rag_config) return <Tag color="default">未设置</Tag>;
              const configName = rag_config.includes('/') ? rag_config.split('/').pop() : rag_config;
              return (
                <Tooltip title={rag_config}>
                  <Tag color="orange" style={{ whiteSpace: 'nowrap' }}>
                    {configName}
                  </Tag>
                </Tooltip>
              );
            }
          },


          {
            title: '成功率',
            key: 'success_rate',
            width: 90,
            render: (_: any, record: any) => {
              if (record.status === 'completed' && record.processed_questions > 0) {
                const successRate = (record.success_questions / record.processed_questions * 100).toFixed(0);
                return <Tag color="green" style={{ minWidth: '40px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {successRate}%</Tag>;
              }
              return '-';
            },
          },
          {
            title: '平均响应',
            key: 'avg_response_time',
            width: 120,
            render: (_, record: any) => {
              if (record.status === 'completed' && record.summary_metrics?.response_time?.total_time?.avg) {
                return <Tag color="blue" style={{ minWidth: '40px', textAlign: 'center', whiteSpace: 'nowrap' }}>{record.summary_metrics.response_time.total_time.avg.toFixed(2)} 秒</Tag>;
              }
              return '-';
            },
          },

          {
            title: '创建时间',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (time) => <span style={{ whiteSpace: 'nowrap' }}><TimeAgo date={time} /></span>
          },
          {
            title: '操作',
            key: 'action',
            render: (_, record) => (
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  disabled={
                    record.status === 'running' ||
                    record.status === 'completed' ||
                    runningTestId !== null
                  }
                  onClick={() => handleRunTest(record)}
                  title={
                    record.status === 'completed' ? '测试已完成' :
                    record.status === 'running' ? '测试运行中' :
                    runningTestId !== null ? '有其他测试正在运行' :
                    '运行测试'
                  }
                />
                <Button

                  icon={<EyeOutlined />}
                  onClick={() => handleViewDetail(record.id)}
                  title="查看详情"
                />
              </div>
            )
          },
        ]}
        />
      </div>

      <Modal
        title="新建性能测试"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        destroyOnClose
        width={600}
      >
        <CreatePerformanceTestForm
          projectId={projectId}
          onSuccess={() => {
            setModalVisible(false);
            fetchTests();
          }}
          onCancel={() => setModalVisible(false)}
        />
      </Modal>

      <PerformanceTestDetail
        visible={detailVisible}
        testId={selectedTestId}
        onClose={() => {
          setDetailVisible(false);
          setSelectedRagSystemInfo(null);
        }}
        datasets={datasets}
        ragSystemInfo={selectedRagSystemInfo}
      />
    </div>
  );
};