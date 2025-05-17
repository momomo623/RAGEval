import React, { useEffect, useState } from 'react';
import { Table, Input, Tag, Typography, Spin, Space, Button, Select, Tooltip } from 'antd';
import { SearchOutlined, EyeOutlined, ProjectOutlined } from '@ant-design/icons';
import { adminService } from '../../services/admin.service';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;
const { Option } = Select;

interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string;
  status: string;
  scoring_scale: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
}

const AllProjects: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchText, setSearchText] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const data = await adminService.getAllProjects();
        setProjects(data);
      } catch (error) {
        console.error('获取所有项目失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  const handleViewProject = (projectId: string) => {
    navigate(`/projects/${projectId}`);
  };

  // 获取项目状态对应的标签颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'created':
        return 'blue';
      case 'in_progress':
        return 'orange';
      case 'completed':
        return 'green';
      default:
        return 'default';
    }
  };

  // 获取项目状态的中文名称
  const getStatusName = (status: string) => {
    switch (status) {
      case 'created':
        return '已创建';
      case 'in_progress':
        return '进行中';
      case 'completed':
        return '已完成';
      default:
        return status;
    }
  };

  const columns = [
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <Space>
          <ProjectOutlined />
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: '所有者',
      dataIndex: 'user_name',
      key: 'user_name',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {getStatusName(status)}
        </Tag>
      ),
    },
    {
      title: '评分标准',
      dataIndex: 'scoring_scale',
      key: 'scoring_scale',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => new Date(text).toLocaleString(),
      sorter: (a: Project, b: Project) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Project) => (
        <Space size="middle">
          <Tooltip title="查看项目">
            <Button 
              icon={<EyeOutlined />} 
              onClick={() => handleViewProject(record.id)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // 过滤项目
  const filteredProjects = projects.filter(project => {
    const matchesSearch = 
      project.name.toLowerCase().includes(searchText.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchText.toLowerCase()) ||
      project.user_name?.toLowerCase().includes(searchText.toLowerCase());
    
    if (filterStatus === 'all') {
      return matchesSearch;
    } else {
      return matchesSearch && project.status === filterStatus;
    }
  });

  return (
    <div>
      <Title level={2}>所有项目</Title>
      
      <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
        <Input
          placeholder="搜索项目名称、描述或所有者"
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{ width: 300 }}
        />
        
        <Select
          defaultValue="all"
          style={{ width: 120 }}
          onChange={value => setFilterStatus(value)}
        >
          <Option value="all">全部状态</Option>
          <Option value="created">已创建</Option>
          <Option value="in_progress">进行中</Option>
          <Option value="completed">已完成</Option>
        </Select>
      </div>
      
      {loading ? (
        <Spin size="large" />
      ) : (
        <Table
          columns={columns}
          dataSource={filteredProjects}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      )}
    </div>
  );
};

export default AllProjects;
