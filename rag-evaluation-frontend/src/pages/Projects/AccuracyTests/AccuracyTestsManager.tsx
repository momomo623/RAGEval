import React, { useState, useEffect, version } from 'react';
import { 
  Card, Button, Table, Tag, Space, Modal, message, 
  Typography, Progress, Alert, Spin, Row, Col, Statistic,
  Tooltip
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

  // 初始加载测试列表
  useEffect(() => {
    fetchTests();
  }, [projectId]);

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

  // 运行测试
  const handleRunTest = async (test: any) => {
    console.log(1111111,test)

    if (runningTestId) {
      message.warning('已有测试正在运行，请等待完成');
      return;
    }

    try {
      // 检查LLM配置
      const llmConfig = getLLMConfig();
      if (!llmConfig) {
        setShowConfigWarning(true);
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

      // 获取测试问题
      const questions = await fetchTestQuestions(test);
      if (!questions.total) {
        message.error('无法获取评测问题');
        setRunningTestId(null);
        return;
      }

      setTestQuestions(questions);
      progressState.total = questions.total;
      setProgress(progressState);

      // 执行测试
      await executeAccuracyTest(
        test,
        questions.questions,
        (progress) => {
          setProgress(progress);
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

  // 渲染测试进度
  const renderProgress = () => {
    if (!progress || !runningTestId) return null;

    const test = tests.find(test => test.id === runningTestId);
    if (!test) return null;

    const elapsedSeconds = progress.startTime 
      ? Math.floor((performance.now() - progress.startTime) / 1000) 
      : 0;

    const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
      <Card 
        className={styles.progressCard}
        title={`正在执行测试: ${test.name}`} 
        extra={<Text type="secondary">已用时间: {formatTime(elapsedSeconds)}</Text>}
      >
        <Row gutter={16}>
          <Col span={16}>
            <Progress 
              percent={progress.total ? Math.floor((progress.completed / progress.total) * 100) : 0} 
              status={runningTestId ? "active" : "normal"}
            />
            <div style={{ marginTop: 8 }}>
              <Space>
                <Text>
                  进度: {progress.completed}/{progress.total} 
                  {progress.currentBatch && progress.totalBatches ? 
                    ` (批次 ${progress.currentBatch}/${progress.totalBatches})` : ''}
                </Text>
                <Text type="success">成功: {progress.success}</Text>
                <Text type="danger">失败: {progress.failed}</Text>
              </Space>
            </div>
          </Col>
          <Col span={8}>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic 
                  title="成功率" 
                  value={progress.completed ? Math.round((progress.success / progress.completed) * 100) : 0} 
                  suffix="%" 
                  valueStyle={{ color: '#3f8600' }}
                />
              </Col>
              <Col span={12}>
                <Statistic 
                  title="失败率" 
                  value={progress.completed ? Math.round((progress.failed / progress.completed) * 100) : 0} 
                  suffix="%"
                  valueStyle={{ color: '#cf1322' }}
                />
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>
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
          },
          {
            title: '整体得分',
            dataIndex: 'results_summary',
            key: 'overall_score',
            render: (summary) => {
              if (!summary || !summary.overall_score) return '-';
              return <span>{summary.overall_score.toFixed(2)}</span>;
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