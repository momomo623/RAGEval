import React, { useState, useEffect } from 'react';
import { 
  Layout, Typography, Button, Card, Tag, Row, Col, Input, 
  Select, Pagination, Empty, Spin, message, Dropdown, Menu,
  Modal
} from 'antd';
import { 
  PlusOutlined, SearchOutlined, SettingOutlined, 
  EllipsisOutlined, ExclamationCircleOutlined,
  EyeOutlined, LockOutlined, EditOutlined, DeleteOutlined,
  BookOutlined, TagOutlined, QuestionOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { Dataset } from '../../types/dataset';
import { datasetService } from '../../services/dataset.service';
import styles from './Datasets.module.css';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { confirm } = Modal;

const DatasetsPage: React.FC = () => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [searchText, setSearchText] = useState('');
  const [filterTag, setFilterTag] = useState<string | undefined>(undefined);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterTags, setFilterTags] = useState<string | undefined>(undefined);
  const [searchKeyword, setSearchKeyword] = useState<string | undefined>(undefined);
  
  const navigate = useNavigate();

  useEffect(() => {
    fetchDatasets(currentPage, pageSize, filterType, filterTags || filterTag, searchKeyword || searchText);
  }, [currentPage, pageSize, filterType, filterTags, filterTag, searchKeyword, searchText]);

  const fetchDatasets = async (
    page: number, 
    size: number, 
    filterType: string = 'all',
    tags?: string,
    search?: string
  ) => {
    setLoading(true);
    try {
      const response = await datasetService.getDatasets({
        page,
        size,
        filter_type: filterType as 'all' | 'my' | 'public' | 'private',
        tags,
        search
      });
      
      setDatasets(response.datasets);
      setTotal(response.total);
    } catch (error) {
      console.error('获取数据集列表失败:', error);
      message.error('获取数据集列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDataset = () => {
    navigate('/datasets/create');
  };

  const handleViewDataset = (id: string) => {
    navigate(`/datasets/${id}`);
  };

  const handleEditDataset = (id: string) => {
    navigate(`/datasets/${id}/edit`);
  };

  const handleDeleteDataset = (dataset: Dataset) => {
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
          fetchDatasets(currentPage, pageSize, filterType, filterTags || filterTag, searchKeyword || searchText);
        } catch (error) {
          console.error('删除数据集失败:', error);
          message.error('删除数据集失败，请重试');
        }
      }
    });
  };

  const handlePageChange = (page: number, size?: number) => {
    setCurrentPage(page);
    if (size) setPageSize(size);
    fetchDatasets(page, size || pageSize, filterType, filterTags, searchKeyword);
  };

  const handleSearch = (value: string) => {
    setSearchKeyword(value || undefined);
    setCurrentPage(1);
  };

  const handleFilterTypeChange = (value: string) => {
    setFilterType(value);
    setCurrentPage(1);
  };

  const handleFilterTagChange = (value: string) => {
    const tags = value ? value : undefined;
    setFilterTags(tags);
    setCurrentPage(1);
  };

  const renderDatasetCard = (dataset: Dataset) => {
    const menu = (
      <Menu>
        <Menu.Item key="edit" icon={<EditOutlined />} onClick={() => handleEditDataset(dataset.id)}>
          编辑数据集
        </Menu.Item>
        <Menu.Item key="delete" icon={<DeleteOutlined />} onClick={() => handleDeleteDataset(dataset)}>
          删除数据集
        </Menu.Item>
      </Menu>
    );

    return (
      <Card 
        className={styles.datasetCard} 
        hoverable
        onClick={() => handleViewDataset(dataset.id)}
      >
        <div className={styles.cardHeader}>
          <div className={styles.cardIcon}>
            <BookOutlined />
          </div>
          <div className={styles.cardTitle}>
            <Title level={5} ellipsis={{ rows: 1 }}>{dataset.name}</Title>
            <div className={styles.cardMeta}>
              <Text type="secondary">{`${dataset.question_count}个问题`}</Text>
              {dataset.is_public ? (
                <Tag color="green" icon={<EyeOutlined />}>公开</Tag>
              ) : (
                <Tag color="default" icon={<LockOutlined />}>私有</Tag>
              )}
            </div>
          </div>
          <Dropdown 
            overlay={menu} 
            trigger={['click']} 
            placement="bottomRight"
          >
            <Button 
              type="text" 
              icon={<EllipsisOutlined />} 
              onClick={(e) => e.stopPropagation()}
            />
          </Dropdown>
        </div>

        {dataset.description && (
          <Paragraph 
            ellipsis={{ rows: 2 }} 
            className={styles.cardDescription}
          >
            {dataset.description}
          </Paragraph>
        )}

        {dataset.tags && dataset.tags.length > 0 && (
          <div className={styles.cardTags}>
            {dataset.tags.slice(0, 3).map((tag, index) => (
              <Tag key={index} color="blue">{tag}</Tag>
            ))}
            {dataset.tags.length > 3 && (
              <Tag>+{dataset.tags.length - 3}</Tag>
            )}
          </div>
        )}

        <div className={styles.cardFooter}>
          <Text type="secondary">
            创建于 {new Date(dataset.created_at).toLocaleDateString()}
          </Text>
        </div>
      </Card>
    );
  };

  return (
    <Layout.Content className={styles.pageContainer}>
      <div className={styles.pageHeader}>
        <div>
          <Title level={2}>数据集管理</Title>
          <Text type="secondary">
            管理问答数据集，可用于多个项目的评测任务
          </Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreateDataset}
        >
          创建数据集
        </Button>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.leftFilters}>
          <Select 
            defaultValue="all" 
            style={{ width: 130 }} 
            onChange={handleFilterTypeChange}
          >
            <Option value="all">所有数据集</Option>
            <Option value="my">我的数据集</Option>
            <Option value="public">公开数据集</Option>
            <Option value="private">私有数据集</Option>
          </Select>
          <Input
            placeholder="输入标签搜索"
            allowClear
            style={{ width: 130 }}
            onChange={(e) => {
              const value = e.target.value;
              const tags = value ? value : undefined;
              setFilterTags(tags);
              setCurrentPage(1);
            }}
            onPressEnter={(e) => {
              const value = (e.target as HTMLInputElement).value;
              const tags = value ? value : undefined;
              setFilterTags(tags);
              setCurrentPage(1);
            }}
          />
        </div>
        <Input.Search
          placeholder="搜索数据集"
          allowClear
          onSearch={handleSearch}
          style={{ width: 250 }}
        />
      </div>

      <div className={styles.datasetsContainer}>
        {loading ? (
          <div className={styles.loadingContainer}>
            <Spin size="large" />
          </div>
        ) : datasets && datasets.length > 0 ? (
          <>
            <Row gutter={[16, 16]}>
              {datasets.map(dataset => (
                <Col xs={24} sm={12} md={8} lg={6} key={dataset.id}>
                  {renderDatasetCard(dataset)}
                </Col>
              ))}
              <Col xs={24} sm={12} md={8} lg={6}>
                <Card 
                  className={styles.newDatasetCard} 
                  onClick={handleCreateDataset}
                >
                  <div className={styles.newDatasetContent}>
                    <PlusOutlined className={styles.plusIcon} />
                    <div className={styles.newDatasetText}>
                      <Title level={5}>创建新数据集</Title>
                      <Text type="secondary">添加新的问答数据集</Text>
                    </div>
                  </div>
                </Card>
              </Col>
            </Row>

            <div className={styles.pagination}>
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={total}
                onChange={handlePageChange}
                showSizeChanger
                showQuickJumper
                showTotal={(total) => `共 ${total} 条数据`}
              />
            </div>
          </>
        ) : (
          <Empty 
            description="暂无数据集" 
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button type="primary" onClick={handleCreateDataset}>
              创建第一个数据集
            </Button>
          </Empty>
        )}
      </div>
    </Layout.Content>
  );
};

export default DatasetsPage; 