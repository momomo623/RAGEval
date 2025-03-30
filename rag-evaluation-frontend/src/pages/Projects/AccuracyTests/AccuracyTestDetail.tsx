import React, { useState, useEffect } from 'react';
import { 
  Drawer, Descriptions, Statistic, Card, Row, Col, 
  Divider, Table, Tag, Space, Typography, Button, Spin, Empty, message, List, Input, Select, Tabs
} from 'antd';
import { 
  CheckCircleOutlined, CloseCircleOutlined, 
  SyncOutlined, SearchOutlined, DownloadOutlined,
  FileTextOutlined, StarOutlined, UserOutlined, RobotOutlined
} from '@ant-design/icons';
import { TimeAgo } from '../../../components/common/TimeAgo';
import styles from './AccuracyTests.module.css';
import { accuracyService } from '../../../services/accuracy.service';
import { CSVLink } from 'react-csv';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

interface AccuracyTestDetailProps {
  visible: boolean;
  testId: string | null;
  onClose: () => void;
}

export const AccuracyTestDetail: React.FC<AccuracyTestDetailProps> = ({
  visible,
  testId,
  onClose
}) => {
  const [loading, setLoading] = useState(false);
  const [testData, setTestData] = useState<any>(null);
  const [testItems, setTestItems] = useState<any[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [filterScore, setFilterScore] = useState<string | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('summary');
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [humanAssignments, setHumanAssignments] = useState<any[]>([]);
  
  // 添加分页相关状态
  const [itemsLoading, setItemsLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [itemsFilter, setItemsFilter] = useState({
    status: null as string | null
  });

  // 加载测试详情
  useEffect(() => {
    if (visible && testId) {
      fetchTestDetail(testId);
      if (testData?.evaluation_type !== 'ai') {
        fetchHumanAssignments(testId);
      }
    }
  }, [visible, testId]);

  // 分离测试详情和测试项的获取
  useEffect(() => {
    if (visible && testId && activeTab === 'items') {
      fetchTestItems(testId);
    }
  }, [visible, testId, activeTab, pagination.current, pagination.pageSize, itemsFilter]);

  // 准备CSV导出数据
  useEffect(() => {
    if (testItems.length > 0) {
      const data = testItems.map(item => ({
        '序号': item.sequence_number,
        '问题': item.question_content,
        '参考答案': item.reference_answer,
        'RAG回答': item.rag_answer_content,
        '最终评分': item.final_score,
        'AI评分': item.ai_score,
        '人工评分': item.human_score,
        '评测理由': item.final_evaluation_reason,
        '评测方式': item.final_evaluation_type
      }));
      setCsvData(data);
    }
  }, [testItems]);

  const fetchTestDetail = async (id: string) => {
    setLoading(true);
    try {
      const response = await accuracyService.getDetail(id);
      setTestData(response);
      
      // 仅设置测试基本信息，测试项将通过专门的API加载
      if (activeTab === 'items') {
        fetchTestItems(id);
      }
    } catch (error) {
      console.error('获取精度测试详情失败:', error);
      message.error('获取精度测试详情失败');
    } finally {
      setLoading(false);
    }
  };

  // 新增：获取测试项目列表（支持分页）
  const fetchTestItems = async (id: string) => {
    if (!id) return;
    
    setItemsLoading(true);
    try {
      const offset = (pagination.current - 1) * pagination.pageSize;
      const response = await accuracyService.getTestItems(id, {
        limit: pagination.pageSize,
        offset: offset,
        status: itemsFilter.status
      });
      
      // 处理从API获取的测试项
      const items = response.items.map((item: any, index: number) => ({
        ...item,
        sequence_number: item.sequence_number || (offset + index + 1)
      }));
      
      setTestItems(items);
      setPagination(prev => ({
        ...prev,
        total: response.total
      }));
    } catch (error) {
      console.error('获取测试项目列表失败:', error);
      message.error('获取测试项目列表失败');
    } finally {
      setItemsLoading(false);
    }
  };

  // 处理分页变化
  const handlePageChange = (page: number, pageSize?: number) => {
    setPagination(prev => ({
      ...prev,
      current: page,
      pageSize: pageSize || prev.pageSize
    }));
  };

  // 处理筛选状态变化
  const handleStatusFilterChange = (status: string | null) => {
    setItemsFilter(prev => ({
      ...prev,
      status
    }));
    setPagination(prev => ({
      ...prev,
      current: 1 // 重置到第一页
    }));
  };

  const fetchHumanAssignments = async (id: string) => {
    setAssignmentsLoading(true);
    try {
      const assignments = await accuracyService.getHumanAssignments(id);
      setHumanAssignments(assignments);
    } catch (error) {
      console.error('获取人工评测任务失败:', error);
    } finally {
      setAssignmentsLoading(false);
    }
  };

  // 渲染评分标签
  const renderScoreTag = (score: number, method: string) => {
    if (score === undefined || score === null) return <Tag>未评分</Tag>;
    
    let color = 'default';
    
    if (method === 'binary') {
      color = score > 0 ? 'success' : 'error';
      return <Tag color={color}>{score > 0 ? '正确' : '错误'}</Tag>;
    } else if (method === 'three_scale') {
      if (score === 0) color = 'error';
      else if (score === 1) color = 'warning';
      else if (score === 2) color = 'success';
      return <Tag color={color}>{score} 分</Tag>;
    } else {
      if (score <= 1) color = 'error';
      else if (score <= 3) color = 'warning';
      else color = 'success';
      return <Tag color={color}>{score} 分</Tag>;
    }
  };

  // 渲染测试状态
  const renderStatus = (status: string) => {
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
      default:
        break;
    }
    
    return (
      <Tag icon={icon} color={color}>
        {status === 'created' ? '已创建' : 
         status === 'running' ? '运行中' : 
         status === 'completed' ? '已完成' : 
         status === 'failed' ? '失败' : status}
      </Tag>
    );
  };

  // 渲染评测类型
  const renderEvaluationType = (type: string) => {
    switch (type) {
      case 'ai':
        return <Tag icon={<RobotOutlined />}>AI评测</Tag>;
      case 'manual':
        return <Tag icon={<UserOutlined />}>人工评测</Tag>;
      case 'hybrid':
        return <Tag icon={<StarOutlined />}>混合评测</Tag>;
      default:
        return <Tag>{type}</Tag>;
    }
  };

  // 渲染评测项详情
  const renderTestItems = () => {
    return (
      <>
        <div className={styles.filterSection}>
          <Input 
            placeholder="搜索问题或回答..." 
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
            prefix={<SearchOutlined />}
            style={{ width: 300 }}
          />
          <Select
            placeholder="筛选分数"
            allowClear
            style={{ width: 120 }}
            onChange={value => setFilterScore(value)}
          >
            {testData?.scoring_method === 'binary' ? (
              <>
                <Select.Option value="0">错误</Select.Option>
                <Select.Option value="1">正确</Select.Option>
              </>
            ) : testData?.scoring_method === 'three_scale' ? (
              <>
                <Select.Option value="0">0分</Select.Option>
                <Select.Option value="1">1分</Select.Option>
                <Select.Option value="2">2分</Select.Option>
              </>
            ) : (
              <>
                <Select.Option value="1">1分</Select.Option>
                <Select.Option value="2">2分</Select.Option>
                <Select.Option value="3">3分</Select.Option>
                <Select.Option value="4">4分</Select.Option>
                <Select.Option value="5">5分</Select.Option>
              </>
            )}
          </Select>
          <Select
            placeholder="筛选状态"
            allowClear
            style={{ width: 150 }}
            onChange={handleStatusFilterChange}
            value={itemsFilter.status}
          >
            <Select.Option value="pending">待评测</Select.Option>
            <Select.Option value="ai_completed">AI评测完成</Select.Option>
            <Select.Option value="human_completed">人工评测完成</Select.Option>
            <Select.Option value="both_completed">评测完成</Select.Option>
            <Select.Option value="failed">评测失败</Select.Option>
          </Select>
          {testItems.length > 0 && (
            <CSVLink 
              data={csvData}
              filename={`精度测试_${testData?.name || 'export'}_${new Date().toISOString().slice(0, 10)}.csv`}
            >
              <Button icon={<DownloadOutlined />}>导出CSV</Button>
            </CSVLink>
          )}
        </div>
        
        <Spin spinning={itemsLoading}>
          <List
            itemLayout="vertical"
            dataSource={testItems.filter(item => {
              let matchesSearch = true;
              let matchesScore = true;
              
              if (searchValue) {
                matchesSearch = 
                  item.question_content?.toLowerCase().includes(searchValue.toLowerCase()) ||
                  item.rag_answer_content?.toLowerCase().includes(searchValue.toLowerCase()) ||
                  item.reference_answer?.toLowerCase().includes(searchValue.toLowerCase()) ||
                  item.final_evaluation_reason?.toLowerCase().includes(searchValue.toLowerCase());
              }
              
              if (filterScore) {
                const score = parseFloat(filterScore);
                matchesScore = item.final_score === score;
              }
              
              return matchesSearch && matchesScore;
            })}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              onChange: handlePageChange,
              showSizeChanger: true,
              pageSizeOptions: ['5', '10', '20', '50'],
              showTotal: (total) => `共 ${total} 项`
            }}
            renderItem={(item) => (
              <List.Item className={styles.evaluationItem}>
                <div className={styles.evaluationItemHeader}>
                  <div className={styles.questionInfo}>
                    <Typography.Title level={5}>
                      问题 #{item.sequence_number}
                    </Typography.Title>
                    <Typography.Paragraph strong className={styles.questionText}>
                      {item.question_content}
                    </Typography.Paragraph>
                  </div>
                  <div className={styles.scoreInfo}>
                    <Typography.Text style={{color: '#999',marginRight: 7}}  >评测分数 </Typography.Text>
                    <Space>
                      <Tag color={getScoreColor(item.final_score, testData.scoring_method)}>
                        {getScoreLabel(item.final_score, testData.scoring_method)}
                      </Tag>
                      <Tag color={item.final_evaluation_type === 'ai' ? 'blue' : 'purple'}>
                        {item.final_evaluation_type === 'ai' ? 'AI评测' : '人工评测'}
                      </Tag>
                    </Space>
                  </div>
                </div>
                
                <Divider style={{ margin: '12px 0' }} />
                
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Card 
                      size="small" 
                      title={<span className={styles.cardTitle}>参考答案</span>} 
                      bordered={true} 
                      className={styles.answerCard}
                    >
                      <div className={styles.itemContainer}>
                        <Typography.Paragraph
                          className={styles.answer}
                          ellipsis={{ 
                            rows: 5, 
                            expandable: true, 
                            symbol: '展开' 
                          }}
                        >
                          {item.reference_answer}
                        </Typography.Paragraph>
                      </div>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card 
                      size="small" 
                      title={<span className={styles.cardTitle}>RAG回答</span>} 
                      bordered={true}
                      className={styles.answerCard}
                    >
                      <div className={styles.itemContainer}>
                        <Typography.Paragraph
                          className={styles.answer}
                          ellipsis={{ 
                            rows: 5, 
                            expandable: true, 
                            symbol: '展开' 
                          }}
                        >
                          {item.rag_answer_content}
                        </Typography.Paragraph>
                      </div>
                    </Card>
                  </Col>
                </Row>
                
                <div className={styles.evaluationReason}>
                  <Typography.Text strong>评测理由: </Typography.Text>
                  <Typography.Paragraph style={{marginTop: 10}}>
                    {item.final_evaluation_reason.split('\n').map((line: string, index: number) => (
                      <Typography.Paragraph key={index}>
                        {line}
                      </Typography.Paragraph>
                    ))}
                  </Typography.Paragraph>
                </div>
                
                {Object.keys(item.final_dimension_scores || {}).length > 0 && (
                  <div className={styles.dimensionScores}>
                    <Typography.Text strong>维度评分: </Typography.Text>
                    <Space wrap>
                      {Object.entries(item.final_dimension_scores).map(([dimension, score]) => (
                        <Tag key={dimension} color="blue">
                          {dimension}: {score}
                        </Tag>
                      ))}
                    </Space>
                  </div>
                )}
              </List.Item>
            )}
          />
        </Spin>
      </>
    );
  };

  // 渲染人工评测任务管理
  const renderHumanAssignments = () => {
    return (
      <Spin spinning={assignmentsLoading}>
        <Card title="人工评测任务" extra={
          <Button type="primary" size="small">
            创建评测任务
          </Button>
        }>
          {humanAssignments.length > 0 ? (
            <Table
              dataSource={humanAssignments}
              rowKey="id"
              columns={[
                {
                  title: '评测人',
                  dataIndex: 'evaluator_name',
                  key: 'evaluator_name',
                  render: (name) => name || '未命名评测员'
                },
                {
                  title: '访问码',
                  dataIndex: 'access_code',
                  key: 'access_code'
                },
                {
                  title: '分配数量',
                  dataIndex: 'total_items',
                  key: 'total_items'
                },
                {
                  title: '已完成',
                  dataIndex: 'completed_items',
                  key: 'completed_items',
                  render: (completed, record) => `${completed}/${record.total_items}`
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  key: 'status',
                  render: (status) => {
                    let color = 'default';
                    if (status === 'assigned') color = 'default';
                    else if (status === 'in_progress') color = 'processing';
                    else if (status === 'completed') color = 'success';
                    
                    return <Tag color={color}>{status}</Tag>;
                  }
                },
                {
                  title: '分配时间',
                  dataIndex: 'assigned_at',
                  key: 'assigned_at',
                  render: (time) => <TimeAgo date={time} />
                },
                {
                  title: '操作',
                  key: 'action',
                  render: (_, record) => (
                    <Space size="small">
                      <Button size="small">查看</Button>
                      <Button size="small" type="link">
                        复制链接
                      </Button>
                    </Space>
                  )
                }
              ]}
            />
          ) : (
            <Empty description="暂无人工评测任务" />
          )}
        </Card>
      </Spin>
    );
  };

  // 渲染测试概览
  const renderSummary = () => {
    const summary = testData?.results_summary || {};
    
    return (
      <>
        <Row gutter={[16, 16]}>
          <Col span={6}>
            <Card className={styles.metricCard}>
              <Statistic
                title="整体评分"
                value={summary.overall_score}
                precision={2}
                prefix={<StarOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card className={styles.metricCard}>
              <Statistic
                title="总问题数"
                value={testData?.total_questions || 0}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card className={styles.metricCard}>
              <Statistic
                title="成功率"
                value={testData?.total_questions ? ((testData?.success_questions / testData?.total_questions) * 100).toFixed(1) : 0}
                suffix="%"
                precision={1}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card className={styles.metricCard}>
              <Statistic
                title="失败率"
                value={testData?.total_questions ? ((testData?.failed_questions / testData?.total_questions) * 100).toFixed(1) : 0}
                suffix="%"
                precision={1}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
        </Row>
        
        <Divider>维度详情</Divider>
        
        <Row gutter={[16, 16]}>
          {Object.entries(summary)
            .filter(([key]) => testData?.dimensions?.includes(key))
            .map(([dimension, score]) => (
              <Col key={dimension} span={6}>
                <Card className={styles.metricCard}>
                  <Statistic
                    title={`${dimension}得分`}
                    value={score as number}
                    precision={2}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Card>
              </Col>
            ))}
        </Row>
      </>
    );
  };

  const getScoreColor = (score: number, scoringMethod: string) => {
    if (scoringMethod === 'binary') {
      return score > 0 ? '#52c41a' : '#f5222d';
    } else if (scoringMethod === 'three_scale') {
      if (score === 2) return '#52c41a'; // 好
      if (score === 1) return '#faad14'; // 中
      return '#f5222d'; // 差
    } else { // five_scale
      if (score >= 4) return '#52c41a'; // 好
      if (score >= 3) return '#faad14'; // 中
      return '#f5222d'; // 差
    }
  };

  const getScoreLabel = (score: number, scoringMethod: string) => {
    if (scoringMethod === 'binary') {
      return score > 0 ? '正确' : '错误';
    } else if (scoringMethod === 'three_scale') {
      if (score === 2) return '完全正确';
      if (score === 1) return '部分正确';
      return '错误';
    } else { // five_scale
      return `${score}分`;
    }
  };

  return (
    <Drawer
      title={testData?.name || '精度测试详情'}
      width={900}
      open={visible}
      onClose={onClose}
      maskClosable={false}
      destroyOnClose
    >
      <Spin spinning={loading}>
        {testData ? (
          <>
            <Descriptions bordered size="small" className={styles.summaryCard}>
              <Descriptions.Item label="状态" span={1}>
                {renderStatus(testData.status)}
              </Descriptions.Item>
              <Descriptions.Item label="评测类型" span={1}>
                {renderEvaluationType(testData.evaluation_type)}
              </Descriptions.Item>
              <Descriptions.Item label="评分方法" span={1}>
                {{
                  'binary': '二元评分',
                  'three_scale': '三分量表',
                  'five_scale': '五分量表'
                }[testData.scoring_method] || testData.scoring_method}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间" span={1}>
                <TimeAgo date={testData.created_at} />
              </Descriptions.Item>
              <Descriptions.Item label="开始时间" span={1}>
                {testData.started_at ? <TimeAgo date={testData.started_at} /> : '未开始'}
              </Descriptions.Item>
              <Descriptions.Item label="完成时间" span={1}>
                {testData.completed_at ? <TimeAgo date={testData.completed_at} /> : '未完成'}
              </Descriptions.Item>
              <Descriptions.Item label="描述" span={3}>
                {testData.description || '无描述'}
              </Descriptions.Item>
            </Descriptions>
            
            <Tabs activeKey={activeTab} onChange={setActiveTab}>
              <TabPane tab="评测概览" key="summary">
                {renderSummary()}
              </TabPane>
              <TabPane tab="问题详情" key="items">
                {renderTestItems()}
              </TabPane>
              {(testData.evaluation_type === 'manual' || testData.evaluation_type === 'hybrid') && (
                <TabPane tab="人工评测任务" key="human">
                  {renderHumanAssignments()}
                </TabPane>
              )}
            </Tabs>
          </>
        ) : (
          <Empty description="未找到测试数据" />
        )}
      </Spin>
    </Drawer>
  );
}; 