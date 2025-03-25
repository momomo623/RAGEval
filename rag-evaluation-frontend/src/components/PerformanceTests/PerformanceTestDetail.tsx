import React, { useEffect, useState } from 'react';
import { Card, Descriptions, Spin, Tabs, Table, Tag, Progress, Button, message, Statistic, Row, Col } from 'antd';
import { PerformanceTestDetail, performanceService } from '../../services/performance.service';
import { TimeAgo } from '../common/TimeAgo';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const { TabPane } = Tabs;

interface PerformanceTestDetailProps {
  testId: string;
  onBack: () => void;
}

export const PerformanceTestDetailView: React.FC<PerformanceTestDetailProps> = ({
  testId,
  onBack
}) => {
  const [detail, setDetail] = useState<PerformanceTestDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const data = await performanceService.getDetail(testId);
      setDetail(data);
    } catch (error) {
      console.error('获取性能测试详情失败:', error);
      message.error('获取性能测试详情失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (testId) {
      fetchDetail();
    }
  }, [testId]);

  const handleStartTest = async () => {
    if (!detail) return;
    
    setLoadingAction(true);
    try {
      await performanceService.start({ performance_test_id: testId });
      message.success('性能测试已开始');
      fetchDetail(); // 刷新详情
    } catch (error) {
      console.error('开始性能测试失败:', error);
      message.error('开始性能测试失败');
    } finally {
      setLoadingAction(false);
    }
  };

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'created':
        return <Tag color="blue">待执行</Tag>;
      case 'running':
        return <Tag color="processing">执行中</Tag>;
      case 'completed':
        return <Tag color="success">已完成</Tag>;
      case 'failed':
        return <Tag color="error">失败</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  if (loading) {
    return <Spin size="large" />;
  }

  if (!detail) {
    return <div>未找到性能测试数据</div>;
  }

  // 准备图表数据
  const responseTimesData = detail.rag_answers?.map((answer, index) => ({
    name: index + 1,
    responseTime: answer.total_response_time,
    firstResponseTime: answer.first_response_time,
  })) || [];

  // 获取总结指标
  const metrics = detail.summary_metrics || {};
  const responseTimeStats = metrics.response_time?.total_time || {};
  const firstTokenStats = metrics.response_time?.first_token_time || {};
  const throughput = metrics.throughput || {};
  const successRate = (metrics.success_rate || 0) * 100;

  return (
    <div>
      <Button onClick={onBack} style={{ marginBottom: 16 }}>返回列表</Button>
      
      <Card title={`性能测试详情: ${detail.name}`} bordered={false}>
        <Descriptions bordered column={2}>
          <Descriptions.Item label="测试名称">{detail.name}</Descriptions.Item>
          <Descriptions.Item label="版本">{detail.version || '-'}</Descriptions.Item>
          <Descriptions.Item label="状态">{getStatusTag(detail.status)}</Descriptions.Item>
          <Descriptions.Item label="并发数">{detail.concurrency}</Descriptions.Item>
          <Descriptions.Item label="创建时间"><TimeAgo date={detail.created_at} /></Descriptions.Item>
          <Descriptions.Item label="测试时长">
            {metrics.test_duration_seconds ? `${metrics.test_duration_seconds.toFixed(2)} 秒` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="总问题数">{detail.total_questions}</Descriptions.Item>
          <Descriptions.Item label="处理问题数">{detail.processed_questions}</Descriptions.Item>
          <Descriptions.Item label="成功数">{detail.success_questions}</Descriptions.Item>
          <Descriptions.Item label="失败数">{detail.failed_questions}</Descriptions.Item>
        </Descriptions>
        
        {detail.status === 'created' && (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <Button type="primary" onClick={handleStartTest} loading={loadingAction}>
              开始测试
            </Button>
          </div>
        )}
        
        {detail.status === 'running' && (
          <div style={{ marginTop: 16 }}>
            <Progress 
              percent={detail.processed_questions / detail.total_questions * 100} 
              status="active" 
              format={() => `${detail.processed_questions}/${detail.total_questions}`} 
            />
          </div>
        )}
        
        {detail.status === 'completed' && (
          <Tabs defaultActiveKey="summary" style={{ marginTop: 24 }}>
            <TabPane tab="汇总统计" key="summary">
              <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col span={6}>
                  <Card>
                    <Statistic 
                      title="成功率" 
                      value={successRate} 
                      precision={2}
                      suffix="%" 
                      valueStyle={{ color: successRate > 90 ? '#3f8600' : '#cf1322' }}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic 
                      title="平均响应时间" 
                      value={responseTimeStats.avg || 0} 
                      precision={2}
                      suffix="秒" 
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic 
                      title="每秒处理请求" 
                      value={throughput.requests_per_second || 0} 
                      precision={2}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic 
                      title="每秒生成字符" 
                      value={throughput.chars_per_second || 0} 
                      precision={2}
                    />
                  </Card>
                </Col>
              </Row>
              
              <Card title="响应时间分布" style={{ marginTop: 16 }}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={[
                      { name: 'p50', value: responseTimeStats.p50 || 0 },
                      { name: 'p75', value: responseTimeStats.p75 || 0 },
                      { name: 'p90', value: responseTimeStats.p90 || 0 },
                      { name: 'p95', value: responseTimeStats.p95 || 0 },
                      { name: 'p99', value: responseTimeStats.p99 || 0 },
                      { name: 'max', value: responseTimeStats.max || 0 },
                    ]}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis label={{ value: '响应时间(秒)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip formatter={(value: any) => [`${value.toFixed(3)} 秒`, '响应时间']} />
                    <Bar dataKey="value" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </TabPane>
            
            <TabPane tab="响应时间曲线" key="responseTimes">
              <Card style={{ marginTop: 16 }}>
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart
                    data={responseTimesData}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" label={{ value: '请求序号', position: 'insideBottomRight', offset: 0 }} />
                    <YAxis label={{ value: '响应时间(秒)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip formatter={(value: any) => [`${value.toFixed(3)} 秒`, '响应时间']} />
                    <Area type="monotone" dataKey="responseTime" stroke="#8884d8" fill="#8884d8" name="总响应时间" />
                    <Area type="monotone" dataKey="firstResponseTime" stroke="#82ca9d" fill="#82ca9d" name="首次响应时间" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            </TabPane>
            
            <TabPane tab="详细结果" key="details">
              <Table
                dataSource={detail.rag_answers || []}
                rowKey="id"
                pagination={{ pageSize: 10 }}
                columns={[
                  {
                    title: '序号',
                    dataIndex: 'sequence_number',
                    key: 'sequence_number',
                    width: 80,
                  },
                  {
                    title: '问题',
                    dataIndex: ['question', 'content'],
                    key: 'question',
                    ellipsis: true,
                  },
                  {
                    title: '首次响应时间',
                    dataIndex: 'first_response_time',
                    key: 'first_response_time',
                    render: (time: number) => time ? `${time.toFixed(3)} 秒` : '-',
                  },
                  {
                    title: '总响应时间',
                    dataIndex: 'total_response_time',
                    key: 'total_response_time',
                    render: (time: number) => time ? `${time.toFixed(3)} 秒` : '-',
                  },
                  {
                    title: '字符数',
                    dataIndex: 'character_count',
                    key: 'character_count',
                  },
                  {
                    title: '每秒字符数',
                    dataIndex: 'characters_per_second',
                    key: 'characters_per_second',
                    render: (speed: number) => speed ? speed.toFixed(2) : '-',
                  },
                ]}
              />
            </TabPane>
          </Tabs>
        )}
      </Card>
    </div>
  );
}; 