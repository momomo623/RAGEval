import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Typography, Spin, Button, Space } from 'antd';
import { 
  UserOutlined, 
  TeamOutlined, 
  CrownOutlined, 
  DatabaseOutlined,
  ProjectOutlined,
  GlobalOutlined
} from '@ant-design/icons';
import { adminService } from '../../services/admin.service';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;

interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  adminUsers: number;
  totalDatasets: number;
  publicDatasets: number;
  totalProjects: number;
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await adminService.getSystemStats();
        setStats(data);
      } catch (error) {
        console.error('获取系统统计信息失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{marginTop:30}}>
      <Title level={2}>管理员仪表盘</Title>
      
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="用户总数"
              value={stats?.totalUsers || 0}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="活跃用户"
              value={stats?.activeUsers || 0}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="管理员用户"
              value={stats?.adminUsers || 0}
              prefix={<CrownOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="数据集总数"
              value={stats?.totalDatasets || 0}
              prefix={<DatabaseOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="公开数据集"
              value={stats?.publicDatasets || 0}
              prefix={<GlobalOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="项目总数"
              value={stats?.totalProjects || 0}
              prefix={<ProjectOutlined />}
            />
          </Card>
        </Col>
      </Row>
      
      <Title level={3}>管理功能</Title>
      
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card
            title="用户管理"
            extra={<Button type="link" onClick={() => navigate('/admin/users')}>查看</Button>}
          >
            <p>查看和管理系统中的所有用户</p>
          </Card>
        </Col>
        <Col span={8}>
          <Card
            title="数据集管理"
            extra={<Button type="link" onClick={() => navigate('/admin/datasets')}>查看</Button>}
          >
            <p>查看和管理系统中的所有数据集</p>
          </Card>
        </Col>
        <Col span={8}>
          <Card
            title="项目管理"
            extra={<Button type="link" onClick={() => navigate('/admin/projects')}>查看</Button>}
          >
            <p>查看和管理系统中的所有项目</p>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AdminDashboard;
