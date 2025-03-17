import React, { useState, useEffect } from 'react';
import { 
  Layout, Typography, Button, Card, Tag, Spin, message,
  Table, Space, Input, Select, Modal, Menu, Dropdown,
  Tooltip, Checkbox, Row, Col, Divider, Tabs, Breadcrumb
} from 'antd';
import { 
  ArrowLeftOutlined, EditOutlined, DeleteOutlined, DownloadOutlined,
  PlusOutlined, ExclamationCircleOutlined, LinkOutlined, UploadOutlined,
  SearchOutlined, FilterOutlined, EyeOutlined, LockOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { DatasetDetail, Question } from '../../../types/dataset';
import { datasetService } from '../../../services/dataset.service';
import styles from './DatasetDetail.module.css';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;
const { confirm } = Modal;

const DatasetDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [dataset, setDataset] = useState<DatasetDetail | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);
  const [difficultyFilter, setDifficultyFilter] = useState<string | undefined>(undefined);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  useEffect(() => {
    if (id) {
      fetchDatasetDetail(id);
    }
  }, [id]);
  
  useEffect(() => {
    if (id) {
      fetchQuestions(id);
    }
  }, [id, currentPage, pageSize, searchText, categoryFilter, difficultyFilter]);
  
  const fetchDatasetDetail = async (datasetId: string) => {
    setLoading(true);
    try {
      const data = await datasetService.getDataset(datasetId);
      setDataset(data);
    } catch (error) {
      console.error('获取数据集详情失败:', error);
      message.error('获取数据集详情失败，请重试');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchQuestions = async (datasetId: string) => {
    setQuestionsLoading(true);
    try {
      const params: any = {
        skip: (currentPage - 1) * pageSize,
        limit: pageSize,
        category: categoryFilter,
        difficulty: difficultyFilter
      };
      
      const data = await datasetService.getDatasetQuestions(datasetId, params);
      setQuestions(data);
      setTotal(data.length >= pageSize ? currentPage * pageSize + 1 : currentPage * pageSize);
    } catch (error) {
      console.error('获取问题列表失败:', error);
      message.error('获取问题列表失败，请重试');
    } finally {
      setQuestionsLoading(false);
    }
  };
  
  const handleEditDataset = () => {
    navigate(`/datasets/${id}/edit`);
  };
  
  const handleDeleteDataset = () => {
    if (!dataset) return;
    
    confirm({
      title: '确定要删除此数据集吗?',
      icon: <ExclamationCircleOutlined />,
      content: '删除后无法恢复，数据集中的所有问题将被永久删除。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await datasetService.deleteDataset(dataset.id);
          message.success('数据集已删除');
          navigate('/datasets');
        } catch (error) {
          console.error('删除数据集失败:', error);
          message.error('删除数据集失败，请重试');
        }
      }
    });
  };
  
  const handleImportData = () => {
    navigate(`/datasets/${id}/import`);
  };
  
  const handleExportData = () => {
    message.info('导出功能正在开发中');
  };
  
  const handleAddQuestion = () => {
    message.info('添加问题功能正在开发中');
  };
  
  const handleSearch = (value: string) => {
    setSearchText(value);
    setCurrentPage(1);
  };
  
  const handleCategoryFilterChange = (value: string) => {
    setCategoryFilter(value === 'all' ? undefined : value);
    setCurrentPage(1);
  };
  
  const handleDifficultyFilterChange = (value: string) => {
    setDifficultyFilter(value === 'all' ? undefined : value);
    setCurrentPage(1);
  };
  
  const handleTableChange = (pagination: any) => {
    setCurrentPage(pagination.current);
    setPageSize(pagination.pageSize);
  };
  
  const handleSelectChange = (selectedRowKeys: React.Key[]) => {
    setSelectedRowKeys(selectedKeys);
  };
  
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.info('请先选择要删除的问题');
      return;
    }
    
    confirm({
      title: `确定要删除选中的 ${selectedRowKeys.length} 个问题吗?`,
      icon: <ExclamationCircleOutlined />,
      content: '删除后无法恢复。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        message.info('批量删除功能正在开发中');
        // TODO: 实现批量删除问题的API
        // 然后重新获取问题列表
        // fetchQuestions(id!);
      }
    });
  };
  
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      ellipsis: true,
      render: (text: string) => <span>{text.substring(0, 8)}...</span>
    },
    {
      title: '问题',
      dataIndex: 'question_text',
      key: 'question_text',
      ellipsis: true,
    },
    {
      title: '标准答案',
      dataIndex: 'standard_answer',
      key: 'standard_answer',
      ellipsis: true,
      render: (text: string) => <Tooltip title={text}>{text.length > 50 ? `${text.substring(0, 50)}...` : text}</Tooltip>
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
    },
    {
      title: '难度',
      dataIndex: 'difficulty',
      key: 'difficulty',
      width: 100,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: Question) => (
        <Space size="small">
          <Button type="text" size="small" icon={<EditOutlined />} />
          <Button 
            type="text" 
            size="small" 
            icon={<DeleteOutlined />} 
            danger
            onClick={(e) => {
              e.stopPropagation();
              confirm({
                title: '确定要删除这个问题吗?',
                icon: <ExclamationCircleOutlined />,
                content: '删除后无法恢复。',
                okText: '删除',
                okType: 'danger',
                cancelText: '取消',
                onOk: async () => {
                  message.info('删除功能正在开发中');
                  // TODO: 实现删除问题的API
                  // 然后重新获取问题列表
                  // fetchQuestions(id!);
                }
              });
            }}
          />
        </Space>
      ),
    },
  ];
  
  const rowSelection = {
    selectedRowKeys,
    onChange: handleSelectChange,
  };
  
  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <Spin size="large" />
      </div>
    );
  }
  
  if (!dataset) {
    return (
      <div className={styles.emptyContainer}>
        <div className={styles.emptyContent}>
          <Title level={4}>未找到数据集</Title>
          <Text type="secondary">该数据集可能已被删除或您没有访问权限</Text>
          <Button 
            type="primary" 
            onClick={() => navigate('/datasets')}
            className={styles.backButton}
          >
            返回数据集列表
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <Layout.Content className={styles.pageContainer}>
      <Breadcrumb className={styles.breadcrumb}>
        <Breadcrumb.Item>
          <a onClick={() => navigate('/datasets')}>数据集管理</a>
        </Breadcrumb.Item>
        <Breadcrumb.Item>{dataset.name}</Breadcrumb.Item>
      </Breadcrumb>
      
      <div className={styles.pageHeader}>
        <div className={styles.titleSection}>
          <div className={styles.titleInfo}>
            <Title level={2}>{dataset.name}</Title>
            <div className={styles.titleMeta}>
              {dataset.is_public ? (
                <Tag color="green" icon={<EyeOutlined />}>公开</Tag>
              ) : (
                <Tag color="default" icon={<LockOutlined />}>私有</Tag>
              )}
              <Text type="secondary">
                {dataset.question_count} 个问题 | 创建于 {new Date(dataset.created_at).toLocaleDateString()}
              </Text>
            </div>
          </div>
          <div className={styles.actionButtons}>
            <Space>
              <Button 
                icon={<EditOutlined />} 
                onClick={handleEditDataset}
              >
                编辑
              </Button>
              <Button 
                icon={<DeleteOutlined />} 
                danger
                onClick={handleDeleteDataset}
              >
                删除
              </Button>
              <Dropdown 
                overlay={
                  <Menu>
                    <Menu.Item key="import" icon={<UploadOutlined />} onClick={handleImportData}>
                      导入数据
                    </Menu.Item>
                    <Menu.Item key="export" icon={<DownloadOutlined />} onClick={handleExportData}>
                      导出数据
                    </Menu.Item>
                  </Menu>
                }
              >
                <Button>
                  更多 <DownloadOutlined />
                </Button>
              </Dropdown>
            </Space>
          </div>
        </div>
        
        {dataset.description && (
          <Paragraph className={styles.description}>
            {dataset.description}
          </Paragraph>
        )}
        
        {dataset.tags && dataset.tags.length > 0 && (
          <div className={styles.tags}>
            {dataset.tags.map((tag, index) => (
              <Tag key={index} color="blue">{tag}</Tag>
            ))}
          </div>
        )}
      </div>
      
      <Card className={styles.contentCard}>
        <Tabs defaultActiveKey="questions">
          <TabPane tab="问题列表" key="questions">
            <div className={styles.tableHeader}>
              <div className={styles.tableActions}>
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />}
                  onClick={handleAddQuestion}
                >
                  添加问题
                </Button>
                <Button 
                  icon={<DeleteOutlined />} 
                  disabled={selectedRowKeys.length === 0}
                  onClick={handleBatchDelete}
                >
                  批量删除
                </Button>
              </div>
              <div className={styles.tableFilters}>
                <Select 
                  defaultValue="all" 
                  style={{ width: 120 }} 
                  onChange={handleCategoryFilterChange}
                >
                  <Option value="all">所有分类</Option>
                  <Option value="factual">事实型</Option>
                  <Option value="conceptual">概念型</Option>
                  <Option value="procedural">操作型</Option>
                </Select>
                <Select 
                  defaultValue="all" 
                  style={{ width: 120 }} 
                  onChange={handleDifficultyFilterChange}
                >
                  <Option value="all">所有难度</Option>
                  <Option value="easy">简单</Option>
                  <Option value="medium">中等</Option>
                  <Option value="hard">困难</Option>
                </Select>
                <Input.Search
                  placeholder="搜索问题"
                  allowClear
                  onSearch={handleSearch}
                  style={{ width: 250 }}
                />
              </div>
            </div>
            
            <Table
              rowSelection={rowSelection}
              columns={columns}
              dataSource={questions}
              rowKey="id"
              loading={questionsLoading}
              pagination={{
                current: currentPage,
                pageSize: pageSize,
                total: total,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 条数据`,
              }}
              onChange={handleTableChange}
              className={styles.table}
            />
          </TabPane>
          <TabPane tab="关联项目" key="projects">
            <div className={styles.projectsContainer}>
              {dataset.projects && dataset.projects.length > 0 ? (
                <div className={styles.projectList}>
                  {dataset.projects.items.map(project => (
                    <Card key={project.id} className={styles.projectCard}>
                      <div className={styles.projectInfo}>
                        <Title level={5}>{project.name}</Title>
                      </div>
                      <div className={styles.projectActions}>
                        <Button 
                          type="link" 
                          onClick={() => navigate(`/projects/${project.id}`)}
                        >
                          查看项目
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyProjects}>
                  <Text type="secondary">该数据集尚未与任何项目关联</Text>
                </div>
              )}
            </div>
          </TabPane>
        </Tabs>
      </Card>
    </Layout.Content>
  );
};

export default DatasetDetailPage; 