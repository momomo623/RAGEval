import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Button, Typography, Progress, Tag, Space, Skeleton, Spin, Dropdown, Menu, Modal, message, Form, Input, Select } from 'antd';
import { PlusOutlined, SettingOutlined, EllipsisOutlined, RobotOutlined, SearchOutlined, FileTextOutlined, EditOutlined, DeleteOutlined, ExportOutlined, CopyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { Project, projectService, CreateProjectRequest } from '../../services/project.service';
import styles from './Dashboard.module.css';

const { Title, Text, Paragraph } = Typography;
const { confirm } = Modal;
const { Option } = Select;
const { TextArea } = Input;

const Dashboard: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editProjectId, setEditProjectId] = useState<string>('');
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [form] = Form.useForm();
  const [editLoading, setEditLoading] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const data = await projectService.getProjects();
      setProjects(data);
    } catch (error) {
      console.error('获取项目失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'completed':
        return <Tag color="success">已完成</Tag>;
      case 'in_progress':
        return <Tag color="warning">进行中</Tag>;
      case 'created':
        return <Tag color="default">未开始</Tag>;
      default:
        return <Tag color="default">未开始</Tag>;
    }
  };

  const getProgressPercent = (status: string) => {
    switch (status) {
      case 'completed':
        return 100;
      case 'in_progress':
        return 65;
      case 'created':
        return 5;
      default:
        return 0;
    }
  };

  const getProgressColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#52c41a';
      case 'in_progress':
        return '#faad14';
      case 'created':
        return '#d9d9d9';
      default:
        return '#d9d9d9';
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
    setCurrentProject(project);
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

  const handleExportProject = (project: Project) => {
    message.info('项目导出功能正在开发中');
    // 导出项目功能的实现将在后续添加
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const handleClickProject = (id: string) => {
    navigate(`/projects/${id}`);
  };

  const renderProjectCard = (project: Project) => {
    const progressPercent = getProgressPercent(project.status);
    const progressColor = getProgressColor(project.status);
    const statusTag = getStatusTag(project.status);
    const iconBg = getIconBackground(project.name);

    // 设置菜单
    const settingsMenu = (
      <Menu>
        <Menu.Item key="edit" icon={<EditOutlined />} onClick={() => handleEditProject(project)}>
          编辑项目
        </Menu.Item>
        <Menu.Item key="duplicate" icon={<CopyOutlined />} onClick={() => handleDuplicateProject(project)}>
          复制项目
        </Menu.Item>
      </Menu>
    );

    // 更多操作菜单
    const moreMenu = (
      <Menu>
        <Menu.Item key="export" icon={<ExportOutlined />} onClick={() => handleExportProject(project)}>
          导出项目
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item key="delete" icon={<DeleteOutlined />} danger onClick={() => handleDeleteProject(project)}>
          删除项目
        </Menu.Item>
      </Menu>
    );

    return (
      <Card 
        className={styles.projectCard} 
        hoverable
        onClick={() => handleClickProject(project.id)}
      >
        <div className={styles.projectHeader}>
          <div className={styles.projectIcon} style={{ backgroundColor: iconBg }}>
            {getProjectIcon(project.name)}
          </div>
          <div className={styles.projectTitle}>
            <Title level={5} ellipsis>{project.name}</Title>
            <div className={styles.projectMeta}>
              <Text type="secondary">创建于 {formatDate(project.created_at)}</Text>
              <span className={styles.statusTag}>{statusTag}</span>
            </div>
          </div>
        </div>
        
        <div className={styles.progressSection}>
          <Progress 
            percent={progressPercent} 
            strokeColor={progressColor}
            size="small"
          />
          <div className={styles.progressInfo}>
            <span>{progressPercent}%</span>
            <span>150/150 问题</span>
          </div>
        </div>
        
        <div className={styles.scoreSection}>
          <Text>总体评分：<Text strong style={{ color: '#52c41a' }}>**分</Text></Text>
          {project.description && (
            <Paragraph ellipsis={{ rows: 2 }} className={styles.projectDescription}>
              {project.description}
            </Paragraph>
          )}
        </div>
        
        <div className={styles.cardFooter}>
          <Button type="link" className={styles.detailLink} 
            onClick={() => navigate(`/projects/${project.id}`)}>
            {project.status === 'in_progress' ? '继续评测' : 
             project.status === 'created' ? '开始评测' : '查看详情'}
          </Button>
          <Space>
            <Dropdown overlay={settingsMenu} trigger={['click']} placement="bottomRight">
              <Button type="text" icon={<SettingOutlined />} />
            </Dropdown>
            <Dropdown overlay={moreMenu} trigger={['click']} placement="bottomRight">
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
          {projects.items.map(project => (
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
                {/* <Button type="primary" className={styles.createButton}>
                  创建项目
                </Button> */}
              </div>
            </Card>
          </Col>
        </Row>
      )}
      
      {/* 编辑项目模态框 */}
      <Modal
        title="编辑项目"
        visible={editModalVisible}
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

          <Form.Item
            name="evaluation_method"
            label="评测方式"
          >
            <Select>
              <Option value="auto">自动评测</Option>
              <Option value="manual">人工评测</Option>
              <Option value="hybrid">混合评测</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="scoring_scale"
            label="评分规则"
          >
            <Select>
              <Option value="1-3">三分量表（较差/一般/优秀）</Option>
              <Option value="binary">二元评分（正确/错误）</Option>
              <Option value="1-5">五分量表（1-5分）</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Dashboard; 