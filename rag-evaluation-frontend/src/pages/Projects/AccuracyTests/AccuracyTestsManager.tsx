import React, { useState, useEffect, version } from 'react';
import { 
  Card, Button, Table, Tag, Space, Modal, message, 
  Typography, Progress, Alert, Spin, Row, Col, Statistic,
  Tooltip, Select, Form
} from 'antd';
import { 
  PlusOutlined, PlayCircleOutlined, EyeOutlined, SyncOutlined,
  CheckCircleOutlined, CloseCircleOutlined, FileTextOutlined
} from '@ant-design/icons';
import { accuracyService } from '../../../services/accuracy.service';
import { executeAccuracyTest, TestProgress } from '../../../services/accuracyExecutor';
import { TimeAgo } from '../../../components/common/TimeAgo';
import styles from './AccuracyTests.module.css';
import { datasetService } from '../../../services/dataset.service';
import { CreateAccuracyTestForm } from './CreateAccuracyTestForm';
import { AccuracyTestDetail } from './AccuracyTestDetail';
import { useConfigContext } from '../../../contexts/ConfigContext';
import ConfigButton from '../../../components/ConfigButton';

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
  const [testQuestions, setTestQuestions] = useState<any[]>([]);
  const { getLLMConfig } = useConfigContext();
  const [showConfigWarning, setShowConfigWarning] = useState(false);
  // 添加并发数设置状态
  const [concurrency, setConcurrency] = useState<number>(10);

  const [isConfigured, setIsConfigured] = useState(false);
  useEffect(() => {
    // 检查LLM配置
    const llmConfig = getLLMConfig();
    setIsConfigured(!!llmConfig);
  }, [getLLMConfig]);

  // 初始加载测试列表和并发数设置
  useEffect(() => {
    fetchTests();
    // 从localStorage加载并发数设置
    const savedConcurrency = localStorage.getItem(CONCURRENCY_STORAGE_KEY);
    if (savedConcurrency) {
      setConcurrency(parseInt(savedConcurrency, 10));
    }
  }, [projectId]);

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
      // if (questions.length > 0) {
      //   console.log('获取到的问题示例:', questions[0]);
        
      //   // 检查数据完整性
      //   const incomplete = questions.filter(q => 
      //     !q.question_text || !q.standard_answer || !q.id
      //   );
        
      //   if (incomplete.length > 0) {
      //     console.warn(`有${incomplete.length}个问题数据不完整`);
      //   }
      // }
      
      return questions;
    } catch (error) {
      console.error('获取测试问题失败:', error);
      message.error('获取测试问题失败');
      return [];
    }
  };

  // 修改运行测试函数，传递并发数
  const handleRunTest = async (test: any) => {
    if (runningTestId) {
      message.warning('已有测试正在运行，请等待完成');
      return;
    }

    try {
      // 检查LLM配置
      const llmConfig = getLLMConfig();
      if (!llmConfig) {
        setShowConfigWarning(true);
        message.warning('未配置大模型API，请先配置大模型API才能使用精度评测功能');
        return;
      }

      setRunningTestId(test.id);
      setSelectedTestId(test.id);
      setProgress(null);

      // 防止total被覆盖的进度状态管理器
      let progressState = {
        total: 0,
        completed: 0,
        success: 0,
        failed: 0,
        startTime: performance.now()
      };

      // 不再预加载所有问题，直接使用缓冲区模式
      setProgress(progressState);

      // 创建测试配置，包含并发设置
      const testConfig = {
        ...test,
        batch_settings: {
          ...test.batch_settings,
          concurrency: concurrency // 使用设置的并发数
        }
      };

      // 执行测试 - 传递空数组以触发缓冲区模式
      await executeAccuracyTest(
        testConfig, // 使用包含并发设置的配置
        [], // 空数组触发缓冲区模式
        (progress) => {
          // 确保total被正确保留
          // if (progress.total > 0) {
          //   progressState.total = progress.total;
          //   console.log("11111111122222222进度状态",progressState)
          // }
          
          // 确保其他字段也被更新
          progressState = {
            ...progressState,
            ...progress,
            total: progressState.total > 0 ? progressState.total : progress.total
          };

          
          setProgress({...progressState});
        },
        getLLMConfig
      );

      message.success('精度测试执行完成');
      await fetchTests(); // 刷新测试列表
    } catch (error) {
      console.error('执行精度测试失败:', error);
      message.error('执行精度测试失败: ' + (error.message || '未知错误'));
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

  // 添加并发设置组件
  const renderConcurrencySettings = () => {
    return (
      <Form layout="inline" style={{ marginBottom: 16 }}>
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
      {!isConfigured && (
          <Alert
            message="未配置大模型API"
            description="请先配置大模型API才能使用精度评测功能"
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

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
            <ConfigButton type="primary" size="small">
              前往配置
            </ConfigButton>
          }
          onClose={() => setShowConfigWarning(false)}
        />
      )}

      {progress && renderProgress()}

      <Table
        dataSource={tests}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        columns={[
          {
            title: '测试名称',
            dataIndex: 'name',
            width: 200,
            key: 'name',
            // 鼠标移动显示完整内容
            render: (text) => <Tooltip title={text}>{text}</Tooltip>
          },
          {
            title: '评测类型',
            dataIndex: 'evaluation_type',
            key: 'evaluation_type',
            render: (type) => (
              <Tag>
                {type === 'ai' ? 'AI评测' : type === 'manual' ? '人工评测' : type === 'hybrid' ? '混合评测' : type}
              </Tag>
            )
          },
          {
            title: '评分方法',
            dataIndex: 'scoring_method',
            key: 'scoring_method',
            render: (method) => (
              <Tag>
                {method === 'binary' ? '二元评分' : method === 'three_scale' ? '三分量表' : method === 'five_scale' ? '五分量表' : method}
              </Tag>
            )
          },
          {
            title: '问题数',
            dataIndex: 'total_questions',
            key: 'total_questions',
            render: (total_questions) => <Tag style={{ minWidth: '40px', textAlign: 'center' }}>{total_questions}</Tag>
          },
          {
            title: '整体得分',
            dataIndex: 'results_summary',
            key: 'overall_score',
            render: (summary) => {
              if (!summary || !summary.overall_score) return '-';
              return <Tag color="blue" style={{ minWidth: '40px', textAlign: 'center' }}>{summary.overall_score.toFixed(2)}</Tag>;
            }
          },
          {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
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
              }
              
              return (
                <Tag color={color} icon={icon}>
                  {status === 'created' ? '已创建' : 
                   status === 'running' ? '运行中' : 
                   status === 'completed' ? '已完成' : 
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
            )
          }
        ]}
      />
      
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
          onSuccess={(testId) => {
            setModalVisible(false);
            fetchTests();
          }}
          onCancel={() => setModalVisible(false)}
        />
      </Modal>
      
      <AccuracyTestDetail
        visible={detailVisible}
        testId={selectedTestId}
        onClose={() => setDetailVisible(false)}
      />
    </div>
  );
}; 