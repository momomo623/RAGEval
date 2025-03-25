import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Typography, message, Tooltip } from 'antd';
import { PerformanceTest, performanceService } from '../../services/performance.service';
import { useNavigate } from 'react-router-dom';
import { TimeAgo } from '../common/TimeAgo';

const { Title } = Typography;

interface PerformanceTestsListProps {
  projectId: string;
  onCreateNew: () => void;
  onViewDetail: (testId: string) => void;
}

export const PerformanceTestsList: React.FC<PerformanceTestsListProps> = ({
  projectId,
  onCreateNew,
  onViewDetail
}) => {
  const [tests, setTests] = useState<PerformanceTest[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const fetchTests = async () => {
    setLoading(true);
    try {
      const data = await performanceService.getByProject(projectId);
      setTests(data);
    } catch (error) {
      console.error('获取性能测试列表失败:', error);
      message.error('获取性能测试列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchTests();
    }
  }, [projectId]);

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

  const columns = [
    {
      title: '测试名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: PerformanceTest) => (
        <a onClick={() => onViewDetail(record.id)}>{text}</a>
      ),
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '问题数',
      dataIndex: 'total_questions',
      key: 'total_questions',
    },
    {
      title: '并发数',
      dataIndex: 'concurrency',
      key: 'concurrency',
    },
    {
      title: '成功率',
      key: 'success_rate',
      render: (_, record: PerformanceTest) => {
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
      render: (_, record: PerformanceTest) => {
        if (record.status === 'completed' && record.summary_metrics?.response_time?.total_time?.avg) {
          return <span>{record.summary_metrics.response_time.total_time.avg.toFixed(2)} 秒</span>;
        }
        return '-';
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => <TimeAgo date={date} />,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record: PerformanceTest) => (
        <Space size="small">
          <Button type="link" onClick={() => onViewDetail(record.id)}>
            查看详情
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4}>性能测试列表</Title>
        <Button type="primary" onClick={onCreateNew}>
          新建性能测试
        </Button>
      </div>
      
      <Table
        columns={columns}
        dataSource={tests}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
}; 