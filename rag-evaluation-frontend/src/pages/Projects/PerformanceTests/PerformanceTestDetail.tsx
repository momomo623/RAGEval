import React, { useState, useEffect } from 'react';
import {
  Drawer, Descriptions, Statistic, Card, Row, Col,
  Divider, Table, Tag, Space, Progress, Typography, Button, Spin, Empty, message, List, Input, Select
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined,
  SyncOutlined, FieldTimeOutlined, RocketOutlined,
  FileTextOutlined, ExperimentOutlined, DatabaseOutlined, ApiOutlined
} from '@ant-design/icons';
import { TimeAgo } from '../../../components/common/TimeAgo';
import styles from './PerformanceTests.module.css';
import { performanceService } from '@services/performance/performance.service';

const { Title, Text } = Typography;

interface PerformanceTestDetailProps {
  visible: boolean; // 为了兼容性保留，实际使用open
  testId: string | null;
  onClose: () => void;
  // datasetInfo?: any; // 从列表页面传入的数据集信息
  ragSystemInfo?: any; // 从列表页面传入的RAG系统信息
  datasets?:any;
}

export const PerformanceTestDetail: React.FC<PerformanceTestDetailProps> = ({
  visible,
  testId,
  onClose,
  datasets,
  ragSystemInfo: initialRagSystemInfo
}) => {
  const [loading, setLoading] = useState(false);
  const [testData, setTestData] = useState<any>(null);
  const [qaPairs, setQAPairs] = useState<any[]>([]);
  const [qaLoading, setQALoading] = useState<boolean>(false);
  const [searchValue, setSearchValue] = useState('');
  const [filterSuccess, setFilterSuccess] = useState<boolean | null>(null);
  const [datasetInfo, setDatasetInfo] = useState<any>();
  const [ragSystemInfo, setRagSystemInfo] = useState<any>(initialRagSystemInfo || null);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    pageSizeOptions: ['5', '10', '20'],
    onChange: (page: number, pageSize: number) => {},
    onShowSizeChange: (current: number, size: number) => {}
  });

  useEffect(() => {
    if (visible && testId) {
      setLoading(true);

      // 使用统一的service层调用
      performanceService.getById(testId)
        .then(response => {
          console.log("测试详情API响应:", response);
          setTestData(response);

          const dataset = datasets.find((d: any) => d.id === response.dataset_id);

          setDatasetInfo(dataset);

          // 在成功获取测试数据后，判断是否需要加载问答对
          fetchQAPairs(testId, 1, pagination.pageSize);
        })
        .catch(error => {
          console.error("API调用失败:", error);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [visible, testId]);

  const renderStatusTag = (status: string) => {
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
        case 'interrupted'  :
        color = 'warning';
        icon = <CloseCircleOutlined />;
      
        break;
    }

    return (
      <Tag color={color} icon={icon}>
        {status === 'completed' ? '已完成' :
         status === 'running' ? '运行中' :
         status === 'failed' ? '失败' :
                   status === 'interrupted' ? '已中断' : status}
      </Tag>
    );
  };

  const formatTimeValue = (value: any) => {
    if (!value) return '—';
    return `${parseFloat(value).toFixed(2)}秒`;
  };

  const renderMetricsTable = (metricsData: any) => {
    if (!metricsData || !metricsData.response_time || !metricsData.character_stats) {
      return <Empty description="没有性能指标数据" />;
    }

    // 准备表格数据
    const columns = [
      {
        title: '指标维度',
        dataIndex: 'metric',
        key: 'metric',
        width: 150,
      },
      {
        title: '平均值',
        dataIndex: 'avg',
        key: 'avg',
        render: (text: number, record: any) => record.unit ? `${text.toFixed(2)}${record.unit}` : text.toFixed(2),
      },
      {
        title: '中位数(P50)',
        dataIndex: 'p50',
        key: 'p50',
        render: (text: number, record: any) => record.unit ? `${text.toFixed(2)}${record.unit}` : text.toFixed(2),
      },
      {
        title: 'P95',
        dataIndex: 'p95',
        key: 'p95',
        render: (text: number, record: any) => record.unit ? `${text.toFixed(2)}${record.unit}` : text.toFixed(2),
      },
      {
        title: 'P99',
        dataIndex: 'p99',
        key: 'p99',
        render: (text: number, record: any) => record.unit ? `${text.toFixed(2)}${record.unit}` : text.toFixed(2),
      },
      {
        title: '最小值',
        dataIndex: 'min',
        key: 'min',
        render: (text: number, record: any) => record.unit ? `${text.toFixed(2)}${record.unit}` : text.toFixed(2),
      },
      {
        title: '最大值',
        dataIndex: 'max',
        key: 'max',
        render: (text: number, record: any) => record.unit ? `${text.toFixed(2)}${record.unit}` : text.toFixed(2),
      },
    ];

    // 准备行数据
    const firstTokenData = metricsData.response_time.first_token_time || {};
    const totalTimeData = metricsData.response_time.total_time || {};
    const charsData = metricsData.character_stats.output_chars || {};

    const dataSource = [
      {
        key: 'first_token',
        metric: '首次响应时间',
        avg: firstTokenData.avg || 0,
        p50: firstTokenData.p50 || 0,
        p95: firstTokenData.p95 || 0,
        p99: firstTokenData.p99 || 0,
        min: firstTokenData.min || 0,
        max: firstTokenData.max || 0,
        unit: '秒'
      },
      {
        key: 'total_time',
        metric: '总响应时间',
        avg: totalTimeData.avg || 0,
        p50: totalTimeData.p50 || 0,
        p95: totalTimeData.p95 || 0,
        p99: totalTimeData.p99 || 0,
        min: totalTimeData.min || 0,
        max: totalTimeData.max || 0,
        unit: '秒'
      },
      {
        key: 'chars',
        metric: '输出字符数',
        avg: charsData.avg || 0,
        p50: charsData.p50 || 0,
        p95: charsData.p95 || 0,
        p99: charsData.p99 || 0,
        min: charsData.min || 0,
        max: charsData.max || 0,
        unit: '字符'
      },
    ];

    return (
      <Table
        dataSource={dataSource}
        columns={columns}
        pagination={false}
        size="small"
        bordered
        className={styles.metricsTable}
      />
    );
  };

  const fetchQAPairs = async (testId: string, page: number = 1, pageSize: number = 10) => {
    try {
      console.log(`加载问答对列表: testId=${testId}, page=${page}, pageSize=${pageSize}`);
      setQALoading(true);

      const response = await performanceService.fetchTestDetail(testId, page, pageSize);
      console.log("问答对列表API响应:", response);

      if (response && response.items) {
        console.log(`成功获取到 ${response.items.length} 条问答对数据`);
        setQAPairs(response.items);

        setPagination(prev => ({
          ...prev,
          current: response.page,
          pageSize: response.size,
          total: response.total,
          onChange: (page, pageSize) => fetchQAPairs(testId, page, pageSize),
          onShowSizeChange: (current, size) => fetchQAPairs(testId, 1, size)
        }));
      } else {
        console.warn("API返回的问答对数据格式不正确:", response);
        setQAPairs([]);
      }
    } catch (error) {
      console.error('获取问答对列表失败:', error);
      message.error('获取问答对列表失败');
      setQAPairs([]);
    } finally {
      setQALoading(false);
    }
  };

  // 过滤问答对
  const filteredQAPairs = qaPairs.filter(item => {
    // 成功状态过滤
    if (filterSuccess !== null && item.success !== filterSuccess) {
      return false;
    }

    // 搜索过滤
    if (searchValue && !item.question_content.toLowerCase().includes(searchValue.toLowerCase()) &&
        !item.answer?.toLowerCase().includes(searchValue.toLowerCase())) {
      return false;
    }

    return true;
  });

  return (
    <Drawer
      title="性能测试详情"
      placement="right"
      width={920}
      onClose={onClose}
      open={visible}
      destroyOnClose
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>加载测试详情中...</div>
        </div>
      ) : testData && typeof testData === 'object' && Object.keys(testData).length > 0 ? (
        <>
          <Card loading={loading} className={styles.basicInfoCard}>
            <Title level={4}>{testData.name}</Title>
            <Descriptions bordered column={2} size="small">
              {/* <Descriptions.Item label="测试ID">{testData.id}</Descriptions.Item> */}
              <Descriptions.Item label="版本">{testData.version || '—'}</Descriptions.Item>
              <Descriptions.Item label="状态">{renderStatusTag(testData.status)}</Descriptions.Item>
              <Descriptions.Item label="并发数">{testData.concurrency}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                <TimeAgo date={testData.created_at} />
              </Descriptions.Item>
              <Descriptions.Item label="完成时间">
                {testData.completed_at ? (
                  <TimeAgo date={testData.completed_at} />
                ) : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="测试时长" span={2}>
                {testData.summary_metrics?.test_duration_seconds ?
                  `${parseFloat(testData.summary_metrics.test_duration_seconds).toFixed(2)}秒` :
                  '—'}
              </Descriptions.Item>
              <Descriptions.Item label="数据集" span={2}>
              
                <Tag color="cyan" icon={<DatabaseOutlined />} style={{ whiteSpace: 'nowrap' }}>
                {datasetInfo.name || '未知数据集'}
              </Tag>
            
           
              </Descriptions.Item>
              <Descriptions.Item label="RAG系统" span={2}>
                {ragSystemInfo ? (
                  <Tag color="orange" icon={<ApiOutlined />} style={{ whiteSpace: 'nowrap' }}>
                    {ragSystemInfo.name || '未知RAG系统'}
                  </Tag>
                ) : (
                  testData.rag_config ? (
                    <Tag color="orange" icon={<ApiOutlined />} style={{ whiteSpace: 'nowrap' }}>
                      {testData.rag_config}
                    </Tag>
                  ) : '—'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>
                {testData.description || '无描述'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Divider orientation="left">测试统计</Divider>

          <Row gutter={[16, 16]}>
            <Col span={6}>
              <Card className={styles.statCard}>
                <Statistic
                  title="总问题数"
                  value={testData.total_questions || 0}
                  prefix={<FileTextOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card className={styles.statCard}>
                <Statistic
                  title="已处理"
                  value={testData.processed_questions || 0}
                  prefix={<ExperimentOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card className={styles.statCard}>
                <Statistic
                  title="成功率"
                  value={testData.summary_metrics?.success_rate ?
                    parseFloat((testData.summary_metrics.success_rate * 100).toFixed(2)) : 0}
                  suffix="%"
                  precision={2}
                  prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card className={styles.statCard}>
                <Statistic
                  title="每秒请求数"
                  value={testData.summary_metrics?.throughput?.requests_per_second ?
                    parseFloat(testData.summary_metrics.throughput.requests_per_second.toFixed(2)) : 0}
                  prefix={<RocketOutlined />}
                  precision={2}
                />
              </Card>
            </Col>
          </Row>
                {testData.status !== 'completed'
                && (
                  <>
                <Divider orientation="left">测试进行中 - 请全部测试完毕后查看</Divider>
                <div className={styles.progressContainer}>
                  <Progress
                  style={{marginLeft: '20px'}}
                    type="circle"
                    // percent={qaPairs ? parseFloat((qaPairs.length*1.0 / testData.total_questions).toFixed(2)) : 0}
                    percent={Number(((qaPairs.length * 1.0 / testData.total_questions) * 100).toFixed(2))}
                    format={percent => (
                      <div>
                        <Text strong>{percent}%</Text>
                        <Text type="secondary" style={{ display: 'block' }}>
                          {qaPairs.length} / {testData.total_questions} 问题
                        </Text>
                      </div>
                    )}
                    status="active"
                    width={120}
                  />
</div>
                  </>
               
)
                }
          {testData.status === 'completed' && testData.summary_metrics && (
            <>
              <Divider orientation="left">性能指标</Divider>

              {renderMetricsTable(testData.summary_metrics)}

              <Divider />

              <Card
                title="吞吐量指标"
                size="small"
                className={styles.throughputCard}
                loading={loading}
              >
                <Descriptions column={2} size="small">
                  <Descriptions.Item label="每秒请求数">
                    {testData.summary_metrics.throughput?.requests_per_second ?
                      parseFloat(testData.summary_metrics.throughput.requests_per_second.toFixed(2)) :
                      '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="每秒字符数">
                    {testData.summary_metrics.throughput?.chars_per_second ?
                      parseFloat(testData.summary_metrics.throughput.chars_per_second.toFixed(2)) :
                      '—'}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </>
          )}

          {testData.status === 'completed' && (
            <>
              <Divider orientation="left">问答对列表</Divider>

              <div className={styles.qaFilter}>
                <Space>
                  <Input.Search
                    placeholder="搜索问题或回答"
                    allowClear
                    onSearch={value => setSearchValue(value)}
                    style={{ width: 300 }}
                  />
                  <Select
                    placeholder="筛选状态"
                    allowClear
                    style={{ width: 120 }}
                    onChange={value => setFilterSuccess(value)}
                  >
                    <Select.Option value={true}>成功</Select.Option>
                    <Select.Option value={false}>失败</Select.Option>
                  </Select>
                </Space>
              </div>

              <List
                loading={qaLoading}
                itemLayout="vertical"
                dataSource={filteredQAPairs}
                pagination={pagination}
                renderItem={(item, index) => (
                  <List.Item
                    key={item.id}
                    extra={
                      <Space direction="vertical" size="small">
                        {/* <Tag color={item.success ? "success" : "error"}>
                          {item.success ? "成功" : "失败"}
                        </Tag> */}
                        {item.total_response_time && (
                          <Text type="secondary">
                            响应时间: {item.total_response_time.toFixed(2)}秒
                          </Text>
                        )}
                      </Space>
                    }
                  >
                    <List.Item.Meta
                      title={<Typography.Text strong>{`问题 #${item.sequence_number || ((pagination.current - 1) * pagination.pageSize + index + 1)}`}</Typography.Text>}
                      description={item.question_content}
                    />
                    <div className={styles.answerContainer}>
                      <Typography.Paragraph
                        className={styles.answer}
                        ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}
                      >
                        {item.answer || <Text type="danger">无回答</Text>}
                      </Typography.Paragraph>
                    </div>
                  </List.Item>
                )}
              />
            </>
          )}
        </>
      ) : (
        <div className={styles.noData}>
          <div>无数据</div>
          <div style={{ fontSize: '14px', marginTop: '8px' }}>
            测试ID: {testId || '未知'}
          </div>
          <Button
            type="primary"
            style={{ marginTop: '16px' }}
            onClick={() => testId && performanceService.getById(testId).then(setTestData)}
          >
            重试加载
          </Button>
        </div>
      )}
    </Drawer>
  );
};