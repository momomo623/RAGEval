import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Button, Typography, Space, Spin, Dropdown, Modal, message, Form, Input, Select } from 'antd';
import type { MenuProps } from 'antd';
import { PlusOutlined, SettingOutlined, EllipsisOutlined, RobotOutlined, SearchOutlined, FileTextOutlined, EditOutlined, DeleteOutlined, ExportOutlined, CopyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { Project, projectService, CreateProjectRequest } from '../../services/project.service';
import { api } from '../../utils/api';
import styles from './Dashboard.module.css';

const { Title, Text, Paragraph } = Typography;
const { confirm } = Modal;
const { TextArea } = Input;

const Dashboard: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editProjectId, setEditProjectId] = useState<string>('');
  const [form] = Form.useForm();
  const [editLoading, setEditLoading] = useState(false);
  const [projectStats, setProjectStats] = useState<{[key: string]: any}>({});

  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const data = await projectService.getProjects();

      // 获取项目列表
      const projectList = Array.isArray(data) ? data : (data.items || []);
      setProjects(projectList);

      // 获取每个项目的统计信息
      const stats: {[key: string]: any} = {};

      // 为每个项目获取统计信息
      for (const project of projectList) {
        try {
          // 获取项目关联的数据集及问题数量
          const datasets = await api.get<any[]>(`/v1/projects/${project.id}/datasets`);

          // 获取项目的精度测试
          const accuracyTests = await api.get<any[]>(`/v1/accuracy/project/${project.id}`);

          // 获取项目的性能测试
          const performanceTests = await api.get<any[]>(`/v1/performance/project/${project.id}`);

          // 计算总问题数
          const totalQuestions = datasets.reduce((sum: number, dataset: any) => sum + (dataset.question_count || 0), 0);

          // 获取最新的已完成精度测试
          const completedAccuracyTests = accuracyTests.filter((test: any) => test.status === 'completed');
          const latestAccuracyTest = completedAccuracyTests.length > 0
            ? completedAccuracyTests.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
            : null;

          const latestPerformanceTest = performanceTests.length > 0
            ? performanceTests.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
            : null;

          // 获取最新评分
          let latestScore = null;

          console.log('DEBUG - 精度测试数据:', {
            testId: latestAccuracyTest?.id,
            resultsSummary: latestAccuracyTest?.results_summary,
            status: latestAccuracyTest?.status
          });

          if (latestAccuracyTest && latestAccuracyTest.results_summary) {
            console.log('DEBUG - 结果摘要详情:', latestAccuracyTest.results_summary);

            // 根据后端代码，评分存储在overall_score字段中
            latestScore = latestAccuracyTest.results_summary.overall_score || null;

            console.log('DEBUG - 提取的评分:', latestScore);
          }

          // 计算评测数量和数据集数量
          const accuracyTestCount = accuracyTests.length;
          const performanceTestCount = performanceTests.length;
          const datasetCount = datasets.length;

          stats[project.id] = {
            totalQuestions,
            latestScore,
            accuracyTestCount,
            performanceTestCount,
            datasetCount,
            latestAccuracyTest,
            latestPerformanceTest
          };
        } catch (error) {
          console.error(`获取项目 ${project.id} 统计信息失败:`, error);
          stats[project.id] = {
            totalQuestions: 0,
            latestScore: null,
            accuracyTestCount: 0,
            performanceTestCount: 0,
            datasetCount: 0
          };
        }
      }

      setProjectStats(stats);
    } catch (error) {
      console.error('获取项目失败:', error);
    } finally {
      setLoading(false);
    }
  };



  const getProjectIcon = (name: string) => {
    if (name.includes('产品') || name.includes('助手')) {
      return <RobotOutlined style={{ color: 'white' }} />;
    } else if (name.includes('知识库') || name.includes('搜索')) {
      return <SearchOutlined style={{ color: 'white' }} />;
    } else {
      return <FileTextOutlined style={{ color: 'white' }} />;
    }
  };

  const getIconBackground = (name: string) => {
    if (name.includes('产品') || name.includes('助手')) {
      return '#1890ff';
    } else if (name.includes('知识库') || name.includes('搜索')) {
      return '#722ed1';
    } else {
      return '#8c8c8c';
    }
  };

  const handleCreateProject = () => {
    navigate('/projects/create');
  };

  const handleEditProject = (project: Project) => {
    setEditProjectId(project.id);

    // 初始化表单值
    form.setFieldsValue({
      name: project.name,
      description: project.description,
      evaluation_method: project.evaluation_method,
      scoring_scale: project.scoring_scale,
    });

    setEditModalVisible(true);
  };

  const handleEditModalCancel = () => {
    setEditModalVisible(false);
    form.resetFields();
  };

  const handleEditModalSubmit = async () => {
    try {
      setEditLoading(true);
      const values = await form.validateFields();

      if (!editProjectId) return;

      const projectData: Partial<CreateProjectRequest> = {
        name: values.name,
        description: values.description,
        evaluation_method: values.evaluation_method,
        scoring_scale: values.scoring_scale,
      };

      const result = await projectService.updateProject(editProjectId, projectData);
      if (result) {
        message.success('项目更新成功');
        setEditModalVisible(false);
        fetchProjects(); // 重新获取项目列表
      }
    } catch (error) {
      console.error('更新项目失败:', error);
      message.error('更新项目失败，请重试');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteProject = (project: Project) => {
    confirm({
      title: '确定要删除此项目吗?',
      content: '删除后无法恢复，项目中的所有问题和评测结果将被永久删除。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          // 在API调用前添加日志，帮助调试
          console.log('准备删除项目:', project.id);

          const success = await projectService.deleteProject(project.id);
          console.log('删除项目响应:', success);

          if (success) {
            message.success('项目已成功删除');
            fetchProjects(); // 重新加载项目列表
          } else {
            message.error('删除项目失败，请重试');
          }
        } catch (error) {
          console.error('删除项目失败:', error);
          message.error('删除项目失败，请重试');
        }
      }
    });
  };

  const handleDuplicateProject = (project: Project) => {
    confirm({
      title: '复制项目',
      content: '这将创建一个包含相同配置的新项目。是否继续？',
      onOk: async () => {
        try {
          // 构建新项目数据
          const newProject = {
            name: `${project.name} - 副本`,
            description: project.description,
            evaluation_method: project.evaluation_method,
            scoring_scale: project.scoring_scale,
            settings: project.settings
          };

          const result = await projectService.createProject(newProject);
          if (result) {
            message.success('项目已成功复制');
            fetchProjects(); // 重新加载项目列表
          }
        } catch (error) {
          console.error('复制项目失败:', error);
          message.error('复制项目失败，请重试');
        }
      },
      okText: '复制',
      cancelText: '取消',
    });
  };

  const handleExportProject = (_project: Project) => {
    message.info('项目导出功能正在开发中');
    // 导出项目功能的实现将在后续添加
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const renderProjectCard = (project: Project) => {
    // 获取项目统计信息
    const stats = projectStats[project.id] || {
      totalQuestions: 0,
      latestScore: null,
      accuracyTestCount: 0,
      performanceTestCount: 0,
      datasetCount: 0
    };

    const iconBg = getIconBackground(project.name);

    // 评分显示
    const scoreDisplay = stats.latestScore !== null && stats.latestScore !== undefined
      ? `${Number(stats.latestScore).toFixed(1)}分`
      : '暂无评分';

    // 评分颜色
    const getScoreColor = (score: number | null) => {
      if (score === null || score === undefined) return '#8c8c8c';
      if (score >= 4) return '#52c41a';
      if (score >= 3) return '#faad14';
      return '#f5222d';
    };

    // 设置菜单项
    const settingsMenuItems: MenuProps['items'] = [
      {
        key: 'edit',
        icon: <EditOutlined />,
        label: '编辑项目',
        onClick: (e) => {
          e.domEvent.stopPropagation(); // 阻止事件冒泡
          handleEditProject(project);
        }
      },
      // {
      //   key: 'duplicate',
      //   icon: <CopyOutlined />,
      //   label: '复制项目',
      //   onClick: (e) => {
      //     e.domEvent.stopPropagation(); // 阻止事件冒泡
      //     handleDuplicateProject(project);
      //   }
      // }
    ];

    // 更多操作菜单项
    const moreMenuItems: MenuProps['items'] = [
      {
        key: 'export',
        icon: <ExportOutlined />,
        label: '导出项目',
        onClick: (e) => {
          e.domEvent.stopPropagation(); // 阻止事件冒泡
          handleExportProject(project);
        }
      },
      {
        type: 'divider'
      },
      {
        key: 'delete',
        icon: <DeleteOutlined />,
        label: '删除项目',
        danger: true,
        onClick: (e) => {
          e.domEvent.stopPropagation(); // 阻止事件冒泡
          handleDeleteProject(project);
        }
      }
    ];

    return (
      <Card
        className={styles.projectCard}
        hoverable
      >
        <div
          className={styles.cardContent}
          onClick={() => navigate(`/projects/${project.id}`)}
        >
          <div className={styles.projectHeader}>
            <div className={styles.projectIcon} style={{ backgroundColor: iconBg }}>
              {getProjectIcon(project.name)}
            </div>
            <div className={styles.projectTitle}>
              <Title level={5} ellipsis>{project.name}</Title>
              <div className={styles.projectMeta}>
                <Text type="secondary">创建于 {formatDate(project.created_at)}</Text>
              </div>
            </div>
          </div>

          <div className={styles.statsSection}>
            <div className={styles.statsRow}>
              <div className={styles.statItem}>
                <Text type="secondary">精度评测</Text>
                <Text strong>{stats.accuracyTestCount}</Text>
              </div>
              <div className={styles.statItem}>
                <Text type="secondary">性能评测</Text>
                <Text strong>{stats.performanceTestCount}</Text>
              </div>
              <div className={styles.statItem}>
                <Text type="secondary">数据集</Text>
                <Text strong>{stats.datasetCount}</Text>
              </div>
            </div>
          </div>

          <div className={styles.scoreSection}>
            <Text>最新评分：
              <Text strong style={{ color: getScoreColor(stats.latestScore) }}>
                {scoreDisplay}
              </Text>
            </Text>
            {project.description && (
              <Paragraph ellipsis={{ rows: 2 }} className={styles.projectDescription}>
                {project.description}
              </Paragraph>
            )}
          </div>
        </div>

        <div className={styles.cardFooter}>
          <Button type="link" className={styles.detailLink}
            onClick={() => navigate(`/projects/${project.id}`)}>
            查看详情
          </Button>
          <Space>
            <Dropdown menu={{ items: settingsMenuItems }} trigger={['click']} placement="bottomRight">
              <Button type="text" icon={<SettingOutlined />} />
            </Dropdown>
            <Dropdown menu={{ items: moreMenuItems }} trigger={['click']} placement="bottomRight">
              <Button type="text" icon={<EllipsisOutlined />} />
            </Dropdown>
          </Space>
        </div>
      </Card>
    );
  };

  return (
    <div className={styles.dashboardContainer}>
      <div className={styles.dashboardHeader}>
        <Title level={2}>我的项目</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreateProject}
        >
          创建项目
        </Button>
      </div>

      {loading ? (
        <div className={styles.loadingContainer}>
          <Spin size="large" />
        </div>
      ) : (
        <Row gutter={[16, 16]}>
          {(Array.isArray(projects) ? projects : []).map(project => (
            <Col xs={24} sm={12} md={8} key={project.id}>
              {renderProjectCard(project)}
            </Col>
          ))}

          <Col xs={24} sm={12} md={8}>
            <Card className={styles.newProjectCard} onClick={handleCreateProject}>
              <div className={styles.newProjectContent}>
                <PlusOutlined className={styles.plusIcon} />
                <Title level={5}>创建新项目</Title>
                <Text type="secondary">开始一个新的RAG评测项目</Text>
              </div>
            </Card>
          </Col>
        </Row>
      )}

      {/* 编辑项目模态框 */}
      <Modal
        title="编辑项目"
        open={editModalVisible}
        onCancel={handleEditModalCancel}
        onOk={handleEditModalSubmit}
        confirmLoading={editLoading}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            evaluation_method: 'auto',
            scoring_scale: '1-5',
          }}
        >
          <Form.Item
            name="name"
            label="项目名称"
            rules={[{ required: true, message: '请输入项目名称' }]}
          >
            <Input placeholder="给项目起一个名字" />
          </Form.Item>

          <Form.Item
            name="description"
            label="项目描述"
          >
            <TextArea
              rows={4}
              placeholder="简单描述这个项目的目的和内容"
            />
          </Form.Item>

        </Form>
      </Modal>
    </div>
  );
};

export default Dashboard;
