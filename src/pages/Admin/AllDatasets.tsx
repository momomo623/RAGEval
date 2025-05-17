import React, { useEffect, useState } from 'react';
import { Table, Input, Tag, Typography, Spin, Space, Button, Select, Tooltip } from 'antd';
import { SearchOutlined, EyeOutlined, DatabaseOutlined } from '@ant-design/icons';
import { adminService } from '../../services/admin.service';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;
const { Option } = Select;

interface Dataset {
  id: string;
  user_id: string;
  name: string;
  description: string;
  is_public: boolean;
  tags: string[];
  dataset_metadata: Record<string, any>;
  question_count: number;
  created_at: string;
  updated_at: string;
  user_name?: string;
}

const AllDatasets: React.FC = () => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchText, setSearchText] = useState<string>('');
  const [filterPublic, setFilterPublic] = useState<string>('all');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDatasets = async () => {
      try {
        const data = await adminService.getAllDatasets();
        setDatasets(data);
      } catch (error) {
        console.error('获取所有数据集失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDatasets();
  }, []);

  const handleViewDataset = (datasetId: string) => {
    navigate(`/datasets/${datasetId}`);
  };

  const columns = [
    {
      title: '数据集名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Dataset) => (
        <Space>
          <DatabaseOutlined />
          <span>{text}</span>
          {record.is_public && <Tag color="green">公开</Tag>}
        </Space>
      ),
    },
    {
      title: '所有者',
      dataIndex: 'user_name',
      key: 'user_name',
    },
    {
      title: '问题数量',
      dataIndex: 'question_count',
      key: 'question_count',
      sorter: (a: Dataset, b: Dataset) => a.question_count - b.question_count,
    },
    {
      title: '标签',
      key: 'tags',
      dataIndex: 'tags',
      render: (tags: string[]) => (
        <>
          {tags && tags.map(tag => (
            <Tag color="blue" key={tag}>
              {tag}
            </Tag>
          ))}
        </>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => new Date(text).toLocaleString(),
      sorter: (a: Dataset, b: Dataset) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Dataset) => (
        <Space size="middle">
          <Tooltip title="查看数据集">
            <Button 
              icon={<EyeOutlined />} 
              onClick={() => handleViewDataset(record.id)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // 过滤数据集
  const filteredDatasets = datasets.filter(dataset => {
    const matchesSearch = 
      dataset.name.toLowerCase().includes(searchText.toLowerCase()) ||
      dataset.description?.toLowerCase().includes(searchText.toLowerCase()) ||
      dataset.user_name?.toLowerCase().includes(searchText.toLowerCase());
    
    if (filterPublic === 'all') {
      return matchesSearch;
    } else if (filterPublic === 'public') {
      return matchesSearch && dataset.is_public;
    } else {
      return matchesSearch && !dataset.is_public;
    }
  });

  return (
    <div>
      <Title level={2}>所有数据集</Title>
      
      <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
        <Input
          placeholder="搜索数据集名称、描述或所有者"
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{ width: 300 }}
        />
        
        <Select
          defaultValue="all"
          style={{ width: 120 }}
          onChange={value => setFilterPublic(value)}
        >
          <Option value="all">全部数据集</Option>
          <Option value="public">公开数据集</Option>
          <Option value="private">私有数据集</Option>
        </Select>
      </div>
      
      {loading ? (
        <Spin size="large" />
      ) : (
        <Table
          columns={columns}
          dataSource={filteredDatasets}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      )}
    </div>
  );
};

export default AllDatasets;
