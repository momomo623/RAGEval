import React, { useState, useEffect } from 'react';
import {
  Layout, Typography, Button, Card, Tabs, Descriptions, Tag, Space,
  Spin, message, Empty, Table, Divider, Row, Col, Statistic,Modal, Alert
} from 'antd';
import {
  DatabaseOutlined, RocketOutlined, SettingOutlined,
  ArrowLeftOutlined, EditOutlined, DeleteOutlined, PlusOutlined,
  BarChartOutlined, ExclamationCircleOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { projectService } from '../../../services/project.service';
import { datasetService } from '../../../services/dataset.service';
import { Dataset } from '../../../types/dataset';
import { api } from '../../../utils/api';
import styles from './ProjectDetail.module.css';
import { PerformanceTestsManager } from '../PerformanceTests/PerformanceTestsManager';
import { AccuracyTestsManager } from '../AccuracyTests/AccuracyTestsManager';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { confirm } = Modal;

const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [accuracyTestCount, setAccuracyTestCount] = useState(0);
  const [performanceTestCount, setPerformanceTestCount] = useState(0);

  useEffect(() => {
    if (id) {
      fetchProjectDetail();
    }
  }, [id]);


  const fetchProjectDetail = async () => {
    try {
      setLoading(true);
      const projectData = await projectService.getProject(id!);
      setProject(projectData);

      // 获取关联的数据集
      const datasetsData = await datasetService.getProjectDatasets(id!);
      setDatasets(datasetsData);

      // 获取项目的精度测试
      try {
        const accuracyTests = await api.get<any[]>(`/v1/accuracy/project/${id}`);
        setAccuracyTestCount(accuracyTests.length);
      } catch (error) {
        console.error('获取精度测试失败:', error);
        setAccuracyTestCount(0);
      }

      // 获取项目的性能测试
      try {
        const performanceTests = await api.get<any[]>(`/v1/performance/project/${id}`);
        setPerformanceTestCount(performanceTests.length);
      } catch (error) {
        console.error('获取性能测试失败:', error);
        setPerformanceTestCount(0);
      }
    } catch (error) {
      console.error('获取项目详情失败:', error);
      message.error('获取项目详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEditProject = () => {
    navigate(`/projects/${id}/edit`);
  };

  const handleDeleteProject = () => {
    confirm({
      title: '确定要删除此项目吗?',
      icon: <ExclamationCircleOutlined />,
      content: '删除后无法恢复，所有评测记录将被永久删除。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await projectService.deleteProject(id!);
          message.success('项目已删除');
          navigate('/dashboard');
        } catch (error) {
          console.error('删除项目失败:', error);
          message.error('删除项目失败，请重试');
        }
      }
    });
  };

  const handleSelectDatasets = () => {
    navigate(`/projects/${id}/select-datasets`);
  };

  const handleRemoveDataset = async (datasetId: string) => {
    try {
      await datasetService.unlinkDatasetFromProject({
        project_id: id!,
        dataset_id: datasetId
      });

      message.success('数据集已从项目中移除');

      // 刷新数据集列表
      const updatedDatasets = datasets.filter(d => d.id !== datasetId);
      setDatasets(updatedDatasets);
    } catch (error) {
      console.error('移除数据集失败:', error);

      // 检查是否有详细的错误信息
      if (error.response && error.response.data && error.response.data.detail) {
        message.error(error.response.data.detail);
      } else {
        message.error('移除数据集失败，请重试');
      }
    }
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key);
  };


  // 查看评测报告
  const handleViewReports = () => {
    navigate(`/projects/${id}/reports`);
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <Spin size="large" />
      </div>
    );
  }

  if (!project) {
    return (
      <Layout.Content className={styles.pageContainer}>
        <Empty
          description="项目不存在或已被删除"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button type="primary" onClick={() => navigate('/dashboard')}>
            返回项目列表
          </Button>
        </Empty>
      </Layout.Content>
    );
  }

  // 项目信息显示
  const renderOverview = () => (
    <div className={styles.overviewSection}>
      <Row gutter={[16, 16]}>

      <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="数据集"
              value={datasets.length}
              prefix={<DatabaseOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="精度评测"
              value={accuracyTestCount}
              prefix={<BarChartOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="性能评测"
              value={performanceTestCount}
              prefix={<RocketOutlined />}
            />
          </Card>
        </Col>

      </Row>

      <Card className={styles.infoCard}>
        <Descriptions title="项目信息" bordered column={{ xxl: 4, xl: 3, lg: 3, md: 2, sm: 1, xs: 1 }}>
          <Descriptions.Item label="项目名称">{project.name}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{new Date(project.created_at).toLocaleString()}</Descriptions.Item>
          <Descriptions.Item label="最后更新">{new Date(project.updated_at).toLocaleString()}</Descriptions.Item>

          <Descriptions.Item label="描述" span={3}>{project.description || '无描述'}</Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );

  // 关联数据集展示
  const renderDatasets = () => (
    <div className={styles.datasetsSection}>
      <div className={styles.sectionHeader}>
        <Title level={5}>关联数据集</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleSelectDatasets}
        >
          选择数据集
        </Button>
      </div>

      {datasets.length > 0 ? (
        <div className={styles.datasetsList}>
          {datasets.map(dataset => (
            <Card
              key={dataset.id}
              className={styles.datasetCard}
              actions={[
                <Button
                  icon={<DatabaseOutlined />}
                  onClick={() => navigate(`/datasets/${dataset.id}`)}
                >
                  查看
                </Button>,
                <Button
                  icon={<DeleteOutlined />}
                  danger
                  onClick={() => handleRemoveDataset(dataset.id)}
                >
                  移除
                </Button>
              ]}
            >
              <div className={styles.datasetCardContent}>
                <Title level={5}>{dataset.name}</Title>
                <div className={styles.datasetMeta}>
                  <Text type="secondary">问题数量: {dataset.question_count}</Text>
                  {dataset.is_public && <Tag color="green">公开</Tag>}
                </div>
                <Paragraph ellipsis={{ rows: 2 }} className={styles.datasetDescription}>
                  {dataset.description || '无描述'}
                </Paragraph>
                <div className={styles.datasetTags}>
                  {dataset.tags.map(tag => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Empty
          description="暂未关联数据集"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button type="primary" onClick={handleSelectDatasets}>
            选择数据集
          </Button>
        </Empty>
      )}
    </div>
  );

  // 评测与结果展示
  const renderEvaluations = () => {
    return <AccuracyTestsManager projectId={id!} />;
  };

  return (
    <Layout.Content className={styles.pageContainer}>
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <Button
            type="link"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/dashboard')}
          >
            返回项目列表
          </Button>
          <Title level={3}>{project.name}</Title>
        </div>
        <div className={styles.headerRight}>
          <Button
            icon={<EditOutlined />}
            onClick={handleEditProject}
          >
            编辑
          </Button>
          <Button
            icon={<DeleteOutlined />}
            danger
            onClick={handleDeleteProject}
          >
            删除
          </Button>
        </div>
      </div>

      <Tabs activeKey={activeTab} onChange={handleTabChange}>
        <TabPane tab="概览" key="overview">
          {renderOverview()}
        </TabPane>
        <TabPane tab="数据集" key="datasets">
          {renderDatasets()}
        </TabPane>
        <TabPane tab="精度评测" key="evaluations">
          {renderEvaluations()}
        </TabPane>
        <TabPane tab="性能测试（收集RAG回答）" key="performance">
          <PerformanceTestsManager projectId={id!} />
        </TabPane>
        <TabPane tab="报表" key="reports">
          <div className={styles.reportsSection}>
            <div className={styles.sectionHeader}>
              <Title level={5}>评测报告</Title>
              <Button
                type="primary"
                icon={<BarChartOutlined />}
                onClick={handleViewReports}
              >
                查看报告
              </Button>
            </div>
            <Empty description="暂无评测报告" />
          </div>
        </TabPane>
      </Tabs>


    </Layout.Content>
  );
};

export default ProjectDetailPage;