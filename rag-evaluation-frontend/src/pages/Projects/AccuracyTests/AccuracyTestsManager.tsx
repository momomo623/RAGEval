import React, { useState, useEffect, version, useRef } from 'react';
import {
  Card, Button, Table, Tag, Space, Modal, message,
  Typography, Progress, Alert, Spin, Row, Col, Statistic,
  Tooltip, Select, Form
} from 'antd';
import {
  PlusOutlined, PlayCircleOutlined, EyeOutlined, SyncOutlined,
  CheckCircleOutlined, CloseCircleOutlined, FileTextOutlined, ExclamationCircleOutlined
} from '@ant-design/icons';
import { accuracyService } from '@services/accuracy/accuracy.service';
import { executeAccuracyTest, TestProgress } from '@services/accuracy/accuracyExecutorNew';
import { TimeAgo } from '../../../components/common/TimeAgo';
import styles from './AccuracyTests.module.css';
import { datasetService } from '../../../services/dataset.service';
import { CreateAccuracyTestForm } from './CreateAccuracyTestForm';
import { AccuracyTestDetail } from './AccuracyTestDetail';
import { ConfigManager, RAGConfig, ModelConfig } from '@utils/configManager';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

interface AccuracyTestsManagerProps {
  projectId: string;
}

// 本地存储的键名
const CONCURRENCY_STORAGE_KEY = 'accuracy_test_concurrency';

export const AccuracyTestsManager: React.FC<AccuracyTestsManagerProps> = ({ projectId }) => {
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [runningTestId, setRunningTestId] = useState<string | null>(null);
  const [progress, setProgress] = useState<TestProgress | null>(null);
  const [showConfigWarning, setShowConfigWarning] = useState(false);
  // 添加数据集状态
  const [datasets, setDatasets] = useState<any[]>([]);
  // 添加并发数设置状态
  const [concurrency, setConcurrency] = useState<number>(10);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [availableModels, setAvailableModels] = useState<ModelConfig[]>([]);
  const [isConfigured, setIsConfigured] = useState(false);
  const navigate = useNavigate();
  const isFirstRun = useRef(true);

  useEffect(() => {
    // 使用ConfigManager检查RAG系统配置
    const checkRAGConfig = async () => {
      const configManager = ConfigManager.getInstance();
      const models = await configManager.getAllConfigs<ModelConfig>('model');
      setIsConfigured(models.length > 0);
    };

    checkRAGConfig();
  }, []);

  // 初始加载测试列表和并发数设置
  useEffect(() => {
    fetchTests();
    // 从localStorage加载并发数设置
    const savedConcurrency = localStorage.getItem(CONCURRENCY_STORAGE_KEY);
    if (savedConcurrency) {
      setConcurrency(parseInt(savedConcurrency, 10));
    }

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
  }, [projectId]);

  // 加载大模型配置
  useEffect(() => {
    const loadModels = async () => {
      const configManager = ConfigManager.getInstance();
      const models = await configManager.getAllConfigs<ModelConfig>('model');
      setAvailableModels(models);
      if (models.length > 0) {
        setSelectedModelId(models[0].id);
      }
    };
    loadModels();
  }, []);

  // 保存并发数设置到localStorage
  const handleConcurrencyChange = (value: number) => {
    setConcurrency(value);
    localStorage.setItem(CONCURRENCY_STORAGE_KEY, value.toString());
    message.success(`并发数已设置为 ${value}`);
  };

  const fetchTests = async () => {
    setLoading(true);
    try {
      const data = await accuracyService.getByProject(projectId);
      setTests(data);
    } catch (error) {
      console.error('获取精度测试列表失败:', error);
      message.error('获取精度测试列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取数据集问题列表
  const fetchTestQuestions = async (test: any) => {
    try {
      const datasetId = test.dataset_id;

      if (!datasetId) {
        message.error('测试没有关联数据集');
        return [];
      }
      const params = {
      version : test.version
      }


      const result = await datasetService.getQuestions(datasetId, params);
      console.log("版本过滤 - 问答对",result)

      // 添加数据检查和日志
      const questions = result;


      return questions;
    } catch (error) {
      console.error('获取测试问题失败:', error);
      message.error('获取测试问题失败');
      return [];
    }
  };

  // 检查运行中的测试
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;

      const checkRunningTests = async () => {
        try {
          const runningTests = await accuracyService.checkRunningTests(projectId);

          if (runningTests.length > 0) {
            Modal.confirm({
              title: '发现未完成的测试',
              content: `发现${runningTests.length}个未完成的测试，是否将其标记为中断状态？`,
              onOk: async () => {
                for (const test of runningTests) {
                  await accuracyService.markTestInterrupted(
                    test.id,
                    '页面刷新导致评测中断'
                  );
                }
                fetchTests();
              }
            });
          }
        } catch (error) {
          console.error('检查运行中测试失败:', error);
          message.error('检查运行中测试失败');
        }
      };

      checkRunningTests();
    }
  }, [projectId]);

  // 修改运行测试函数
  const handleRunTest = async (test: any) => {
    if (runningTestId) {
      message.warning('已有测试正在运行，请等待完成');
      return;
    }

    if (!selectedModelId) {
      message.error('请先选择大模型配置');
      return;
    }

    if (test.status === "interrupted") {
      Modal.confirm({
        title: '重新执行中断的测试',
        content: '重新执行将清除已完成的评测结果，是否继续？',
        destroyOnClose: true,
        onOk: async () => {
          try {
            // 重置测试项
            await accuracyService.resetTestItems(test.id);
            // 开始新的测试
            await startNewTest(test);
          } catch (error) {
            console.error('重置测试失败:', error);
            message.error('重置测试失败');
          }
        }
      });
    } else {
      await startNewTest(test);
    }
  };

  // 开始新测试
  const startNewTest = async (test: any) => {
    try {
      setRunningTestId(test.id);
      setSelectedTestId(test.id);
      setProgress(null);

      let progressState = {
        total: 0,
        completed: 0,
        success: 0,
        failed: 0,
        startTime: performance.now()
      };

      const testConfig = {
        ...test,
        batch_settings: {
          ...test.batch_settings,
          concurrency: concurrency
        }
      };

      const success = await executeAccuracyTest(
        testConfig,
        [],
        (progress) => {
          progressState = {
            ...progressState,
            ...progress,
            total: progressState.total > 0 ? progressState.total : progress.total
          };
          setProgress({ ...progressState });
        },
        selectedModelId
      );

      // executeAccuracyTest 内部已经调用了 accuracyService.complete
      // 不需要再次更新状态
      if (success) {
        message.success('精度测试执行完成');
      } else {
        message.warning('精度测试执行完成，但有部分问题处理失败');
      }
      await fetchTests();
    } catch (error: any) {
      console.error('执行精度测试失败:', error);
      message.error('执行精度测试失败: ' + (error.message || '未知错误'));

      // executeAccuracyTest 内部已经调用了 accuracyService.fail
      // 不需要再次更新状态，除非是其他类型的错误
      if (!error.message?.includes('测试执行失败')) {
        try {
          await accuracyService.fail(test.id, {
            message: error.message || '未知错误',
            stack: error.stack
          });
        } catch (reportError) {
          console.error('报告精度测试失败状态失败:', reportError);
        }
      }
    } finally {
      setRunningTestId(null);
    }
  };

  // 显示测试详情
  const handleViewDetail = (testId: string) => {
    setSelectedTestId(testId);
    setDetailVisible(true);
  };

  // 修复格式化时间的辅助函数
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

  // 修改渲染测试进度函数，使其风格与性能测试一致
  const renderProgress = () => {
    if (!progress || !runningTestId) return null;

    const test = tests.find(test => test.id === runningTestId);
    if (!test) return null;

    return (
      <Card className={styles.progressCard}>
        <div className={styles.progressHeader}>
          <div>
            <Typography.Title level={5}>正在执行精度测试</Typography.Title>
            <Typography.Text type="secondary">
              {test.name || ""}
            </Typography.Text>
          </div>
          {/* 可选的停止按钮
          <Button
            danger
            onClick={handleStopTest}
          >
            停止测试
          </Button>
          */}
        </div>

        <Progress
          percent={progress.total ? Math.floor((progress.completed / progress.total) * 100) : 0}
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
          {/* <div className={styles.progressStat}>
            <div className={styles.progressLabel}>已完成</div>
            <div className={styles.progressValue}>{progress.completed}</div>
          </div> */}
          <div className={styles.progressStat}>
            <div className={styles.progressLabel}>成功</div>
            <div className={styles.progressValue}>{progress.success}</div>
          </div>
          <div className={styles.progressStat}>
            <div className={styles.progressLabel}>失败</div>
            <div className={styles.progressValue}>{progress.failed}</div>
          </div>
          <div className={styles.progressStat}>
            <div className={styles.progressLabel}>成功率</div>
            <div className={styles.progressValue} style={{color: '#3f8600'}}>
              {progress.completed ? Math.round((progress.success / progress.completed) * 100) : 0}%
            </div>
          </div>
          <div className={styles.progressStat}>
            <div className={styles.progressLabel}>平均响应时间</div>
            <div className={styles.progressValue}>
              {progress.averageResponseTime
                ? (progress.averageResponseTime < 100
                    ? progress.averageResponseTime.toFixed(2) + ' 秒'
                    : (progress.averageResponseTime / 60).toFixed(2) + ' 分钟')
                : '计算中...'}
            </div>
          </div>
          <div className={styles.progressStat}>
            <div className={styles.progressLabel}>已用时间</div>
            <div className={styles.progressValue}>{formatTime(progress.elapsedTime || 0)}</div>
          </div>
          {/* <div className={styles.progressStat}>
            <div className={styles.progressLabel}>预计剩余</div>
            <div className={styles.progressValue}>{formatTime(progress.remainingTimeEstimate || 0)}</div>
          </div> */}
          {progress.currentBatch && progress.totalBatches && (
            <div className={styles.progressStat}>
              <div className={styles.progressLabel}>批次进度</div>
              <div className={styles.progressValue}>
                {progress.currentBatch}/{progress.totalBatches}
              </div>
            </div>
          )}
        </div>
      </Card>
    );
  };

  // 修改并发设置，左侧添加大模型选择
  const renderConcurrencySettings = () => {
    return (
      <Form layout="inline" style={{ marginBottom: 16 }}>
        <Form.Item label="大模型配置">
          <Select
            value={selectedModelId}
            onChange={setSelectedModelId}
            style={{ width: 220 }}
            placeholder="请选择大模型配置"
          >
            {availableModels.map(model => (
              <Select.Option key={model.id} value={model.id}>
                {model.name}（{model.modelName}）
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item label="并发请求数">
          <Select
            value={concurrency}
            onChange={handleConcurrencyChange}
            style={{ width: 120 }}
          >
            <Select.Option value={1}>1</Select.Option>
            <Select.Option value={2}>2</Select.Option>
            <Select.Option value={5}>5</Select.Option>
            <Select.Option value={10}>10</Select.Option>
            <Select.Option value={15}>15</Select.Option>
            <Select.Option value={20}>20</Select.Option>
            <Select.Option value={30}>30</Select.Option>
            <Select.Option value={50}>50</Select.Option>
            <Select.Option value={100}>100</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item>
          <Tooltip title="设置同时发送到大模型的并发请求数量，数值越大处理速度越快，但可能会增加API调用失败率">
            <Button type="link">并发说明</Button>
          </Tooltip>
        </Form.Item>
      </Form>
    );
  };

  return (
    <div className={styles.container}>
      {!isConfigured && (
        <Alert
          message="未配置大模型API"
          description="请先配置大模型API才能使用精度评测功能"
          type="warning"
          showIcon
          action={
            <Button
              type="primary"
              size="small"
              onClick={() => navigate('/user/settings')}
            >
              立即配置
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      )}
      <div className={styles.header}>
        <Title level={4}>精度测试</Title>
        <Space>
          {/* <ConfigButton /> */}
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalVisible(true)}
          >
            新建测试
          </Button>
        </Space>

      </div>


      {/* 添加并发设置 */}
      {renderConcurrencySettings()}

      {showConfigWarning && (
        <Alert
          message="LLM配置缺失"
          description="精度测试需要配置大模型API。请先完成配置后再运行测试。"
          type="warning"
          showIcon
          closable
          style={{ marginBottom: 16 }}
          action={
            <Button type="primary" size="small" onClick={() => navigate('/user/settings')}>
              前往配置
            </Button>
          }
          onClose={() => setShowConfigWarning(false)}
        />
      )}

      {progress && renderProgress()}

      <div className={styles.tableContainer}>
        <Table
          dataSource={tests}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 'max-content' }}
          columns={[
          {
            title: '测试名称',
            dataIndex: 'name',
            width: 100,
            key: 'name',
            ellipsis: true,
            render: (text) => <Tooltip title={text}><span style={{ maxWidth: '100%', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span></Tooltip>
          },
          {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 100,
            render: (status) => {
              let icon = null;
              let color = 'default';

              switch (status) {
                case 'created':
                  icon = <FileTextOutlined />;
                  break;
                case 'running':
                  icon = <SyncOutlined spin />;
                  color = 'processing';
                  break;
                case 'completed':
                  icon = <CheckCircleOutlined />;
                  color = 'success';
                  break;
                case 'failed':
                  icon = <CloseCircleOutlined />;
                  color = 'error';
                  break;
                case 'interrupted':
                  icon = <ExclamationCircleOutlined />;
                  color = 'warning';
                  break;
              }

              return (
                <Tag color={color} icon={icon} style={{ whiteSpace: 'nowrap' }}>
                  {status === 'created' ? '已创建' :
                   status === 'running' ? '运行中' :
                   status === 'completed' ? '已完成' :
                   status === 'failed' ? '失败' :
                   status === 'interrupted' ? '已中断' : status}
                </Tag>
              );
            }
          },
          {
            title: '数据集',
            dataIndex: 'dataset_id',
            key: 'dataset_id',
            align: 'center',
            ellipsis: true,
            render: (dataset_id) => {
              const dataset = datasets.find((d: any) => d.id === dataset_id);
              return (
                <Tooltip title={dataset ? dataset.name : '未知数据集'}>
                  <Tag color="cyan" style={{ whiteSpace: 'nowrap' }}>
                    {dataset ? dataset.name : '未知数据集'}
                  </Tag>
                </Tooltip>
              );
            }
          },
          {
            title: '评测类型',
            dataIndex: 'evaluation_type',
            key: 'evaluation_type',
            width: 100,
            render: (type) => (
              <Tag style={{ whiteSpace: 'nowrap' }}>
                {type === 'ai' ? 'AI评测' : type === 'manual' ? '人工评测' : type === 'hybrid' ? '混合评测' : type}
              </Tag>
            )
          },
          {
            title: '问题数',
            dataIndex: 'total_questions',
            key: 'total_questions',
            width: 80,
            render: (total_questions) => <Tag style={{ minWidth: '40px', textAlign: 'center', whiteSpace: 'nowrap' }}>{total_questions}</Tag>
          },
          {
            title: '整体得分',
            dataIndex: 'results_summary',
            key: 'overall_score',
            width: 90,
            render: (summary) => {
              if (!summary || !summary.overall_score) return '-';
              return <Tag color="blue" style={{ minWidth: '40px', textAlign: 'center', whiteSpace: 'nowrap' }}>{summary.overall_score.toFixed(1)}</Tag>;
            }
          },
          {
            title: '评分方法',
            dataIndex: 'scoring_method',
            key: 'scoring_method',
            width: 110,
            render: (method) => (
              <Tag style={{ whiteSpace: 'nowrap' }}>
                {method === 'binary' ? '二元评分' : method === 'three_scale' ? '三分量表' : method === 'five_scale' ? '五分量表' : method}
              </Tag>
            )
          },
          {
            title: '评测维度',
            dataIndex: 'dimensions',
            key: 'dimensions',
            width: 150,
            render: (dimensions) => {
              if (!dimensions || dimensions.length === 0) return <Tag>无</Tag>;

              const fullDimensionsList = dimensions.join(', ');

              if (dimensions.length <= 2) {
                return (
                  <Tooltip title={fullDimensionsList}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {dimensions.map((dim: string) => (
                        <Tag key={dim} color="purple" style={{ margin: 0, whiteSpace: 'nowrap' }}>{dim}</Tag>
                      ))}
                    </div>
                  </Tooltip>
                );
              } else {
                return (
                  <Tooltip title={fullDimensionsList}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      <Tag color="purple" style={{ margin: 0, whiteSpace: 'nowrap' }}>{dimensions[0]}</Tag>
                      <Tag color="purple" style={{ margin: 0, whiteSpace: 'nowrap' }}>{dimensions[1]}</Tag>
                      <Tag style={{ margin: 0, whiteSpace: 'nowrap' }}>+{dimensions.length - 2}</Tag>
                    </div>
                  </Tooltip>
                );
              }
            }
          },
          {
            title: '创建时间',
            dataIndex: 'created_at',
            key: 'created_at',
            width: 120,
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
                    record.status === 'running' || // 运行中的测试
                    record.status === 'completed' || // 已完成的测试
                    runningTestId !== null // 有其他测试正在运行
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
          }
        ]}
        />
      </div>

      <Modal
        title="新建精度测试"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
        destroyOnClose
      >
        <CreateAccuracyTestForm
          projectId={projectId}
          onSuccess={() => {
            setModalVisible(false);
            fetchTests();
          }}
          onCancel={() => setModalVisible(false)}
        />
      </Modal>

      <AccuracyTestDetail
        visible={detailVisible}
        testId={selectedTestId}
        datasets={datasets}
        onClose={() => setDetailVisible(false)}
      />
    </div>
  );
};