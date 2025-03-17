import React, { useState, useEffect } from 'react';
import {
  Layout, Typography, Button, Card, Spin, message,
  Checkbox, Input, Empty, Divider, Tag, Tabs, Row, Col, Pagination
} from 'antd';
import { ArrowLeftOutlined, SearchOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { Dataset } from '../../../types/dataset';
import { datasetService } from '../../../services/dataset.service';
import { projectService } from '../../../services/project.service';
import styles from './SelectDatasets.module.css';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;
const { TabPane } = Tabs;

const SelectDatasetsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [myDatasetsLoading, setMyDatasetsLoading] = useState(false);
  const [publicDatasetsLoading, setPublicDatasetsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [myDatasets, setMyDatasets] = useState<Dataset[]>([]);
  const [publicDatasets, setPublicDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetIds, setSelectedDatasetIds] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState('my'); // 'my' 或 'public'
  const [myDatasetsTotal, setMyDatasetsTotal] = useState(0);
  const [publicDatasetsTotal, setPublicDatasetsTotal] = useState(0);
  const [myDatasetsPage, setMyDatasetsPage] = useState(1);
  const [publicDatasetsPage, setPublicDatasetsPage] = useState(1);
  const [pageSize] = useState(8);
  
  // 获取项目信息和已关联的数据集
  useEffect(() => {
    if (projectId) {
      fetchProjectInfo();
    }
  }, [projectId]);
  
  // 获取我的数据集
  useEffect(() => {
    if (activeTab === 'my') {
      fetchMyDatasets();
    }
  }, [activeTab, myDatasetsPage, searchText]);
  
  // 获取公开数据集
  useEffect(() => {
    if (activeTab === 'public') {
      fetchPublicDatasets();
    }
  }, [activeTab, publicDatasetsPage, searchText]);
  
  // 获取项目信息
  const fetchProjectInfo = async () => {
    try {
      setLoading(true);
      const project = await projectService.getProject(projectId!);
      if (project) {
        setProjectName(project.name);
        
        // 获取已关联的数据集ID
        const linkedDatasets = await datasetService.getProjectDatasets(projectId!);
        const linkedIds = linkedDatasets.map(d => d.id);
        setSelectedDatasetIds(linkedIds);
      }
    } catch (error) {
      console.error('获取项目信息失败:', error);
      message.error('获取项目信息失败');
    } finally {
      setLoading(false);
    }
  };
  
  // 获取我的数据集
  const fetchMyDatasets = async () => {
    try {
      setMyDatasetsLoading(true);
      const params = {
        page: myDatasetsPage,
        size: pageSize,
        search: searchText || undefined
      };
      
      const result = await datasetService.getDatasets(params);
      setMyDatasets(result.datasets);
      setMyDatasetsTotal(result.total);
    } catch (error) {
      console.error('获取我的数据集失败:', error);
      message.error('获取我的数据集失败');
    } finally {
      setMyDatasetsLoading(false);
    }
  };
  
  // 获取公开数据集
  const fetchPublicDatasets = async () => {
    try {
      setPublicDatasetsLoading(true);
      const params = {
        page: publicDatasetsPage,
        size: pageSize,
        search: searchText || undefined
      };
      
      const result = await datasetService.getPublicDatasets(params);
      setPublicDatasets(result.datasets);
      setPublicDatasetsTotal(result.total);
    } catch (error) {
      console.error('获取公开数据集失败:', error);
      message.error('获取公开数据集失败');
    } finally {
      setPublicDatasetsLoading(false);
    }
  };
  
  // 切换选择状态
  const toggleDatasetSelection = (datasetId: string) => {
    setSelectedDatasetIds(prev => 
      prev.includes(datasetId)
        ? prev.filter(id => id !== datasetId)
        : [...prev, datasetId]
    );
  };
  
  // 提交选择
  const handleSubmit = async () => {
    if (!projectId || selectedDatasetIds.length === 0) return;
    
    try {
      setSubmitting(true);
      await datasetService.batchLinkDatasetsToProject({
        project_id: projectId,
        dataset_ids: selectedDatasetIds
      });
      
      message.success('数据集已关联到项目');
      navigate(`/projects/${projectId}`);
    } catch (error) {
      console.error('关联数据集失败:', error);
      message.error('关联数据集失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };
  
  // 搜索数据集
  const handleSearch = (value: string) => {
    setSearchText(value);
    // 重置页码
    if (activeTab === 'my') {
      setMyDatasetsPage(1);
    } else {
      setPublicDatasetsPage(1);
    }
  };
  
  // 切换标签页
  const handleTabChange = (key: string) => {
    setActiveTab(key);
  };
  
  // 页码变更
  const handleMyDatasetsPageChange = (page: number) => {
    setMyDatasetsPage(page);
  };
  
  const handlePublicDatasetsPageChange = (page: number) => {
    setPublicDatasetsPage(page);
  };
  
  // 创建新数据集
  const handleCreateDataset = () => {
    navigate('/datasets/create', { state: { returnTo: `/projects/${projectId}/select-datasets` } });
  };
  
  // 渲染数据集卡片
  const renderDatasetCard = (dataset: Dataset) => {
    const isSelected = selectedDatasetIds.includes(dataset.id);
    
    return (
      <Card 
        className={`${styles.datasetCard} ${isSelected ? styles.selectedCard : ''}`}
        hoverable
        onClick={() => toggleDatasetSelection(dataset.id)}
      >
        <div className={styles.cardHeader}>
          <Checkbox checked={isSelected} />
          <div className={styles.cardTitle}>
            <Text strong>{dataset.name}</Text>
            {dataset.is_public && (
              <Tag color="green">公开</Tag>
            )}
          </div>
        </div>
        <Paragraph className={styles.cardDescription} ellipsis={{ rows: 2 }}>
          {dataset.description || '无描述'}
        </Paragraph>
        <div className={styles.cardTags}>
          {dataset.tags && dataset.tags.map(tag => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
        <div className={styles.cardFooter}>
          <Text type="secondary">问题数量: {dataset.question_count}</Text>
        </div>
      </Card>
    );
  };
  
  // 如果正在加载项目信息，显示加载中
  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <Spin size="large" />
      </div>
    );
  }
  
  return (
    <Layout.Content className={styles.pageContainer}>
      <div className={styles.pageHeader}>
        <Button 
          type="link" 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate(`/projects/${projectId}`)}
        >
          返回项目
        </Button>
        <Title level={4}>为项目 "{projectName}" 选择数据集</Title>
      </div>
      
      <Card className={styles.selectionCard}>
        <div className={styles.selectedInfo}>
          已选择 <Text strong>{selectedDatasetIds.length}</Text> 个数据集
        </div>
        
        <div className={styles.searchContainer}>
          <Search
            placeholder="搜索数据集"
            allowClear
            enterButton={<SearchOutlined />}
            onSearch={handleSearch}
            style={{ width: 300 }}
          />
        </div>
        
        <Tabs activeKey={activeTab} onChange={handleTabChange}>
          <TabPane tab="我的数据集" key="my">
            <div className={styles.datasetsContainer}>
              {myDatasetsLoading ? (
                <div className={styles.tabLoading}>
                  <Spin />
                </div>
              ) : myDatasets.length > 0 ? (
                <>
                  <Row gutter={[16, 16]}>
                    {myDatasets.map(dataset => (
                      <Col xs={24} sm={12} md={8} lg={6} key={dataset.id}>
                        {renderDatasetCard(dataset)}
                      </Col>
                    ))}
                  </Row>
                  {myDatasetsTotal > pageSize && (
                    <div className={styles.pagination}>
                      <Pagination 
                        current={myDatasetsPage}
                        pageSize={pageSize}
                        total={myDatasetsTotal}
                        onChange={handleMyDatasetsPageChange}
                        hideOnSinglePage
                      />
                    </div>
                  )}
                </>
              ) : (
                <Empty description="暂无数据集" />
              )}
            </div>
          </TabPane>
          
          <TabPane tab="公开数据集" key="public">
            <div className={styles.datasetsContainer}>
              {publicDatasetsLoading ? (
                <div className={styles.tabLoading}>
                  <Spin />
                </div>
              ) : publicDatasets.length > 0 ? (
                <>
                  <Row gutter={[16, 16]}>
                    {publicDatasets.map(dataset => (
                      <Col xs={24} sm={12} md={8} lg={6} key={dataset.id}>
                        {renderDatasetCard(dataset)}
                      </Col>
                    ))}
                  </Row>
                  {publicDatasetsTotal > pageSize && (
                    <div className={styles.pagination}>
                      <Pagination 
                        current={publicDatasetsPage}
                        pageSize={pageSize}
                        total={publicDatasetsTotal}
                        onChange={handlePublicDatasetsPageChange}
                        hideOnSinglePage
                      />
                    </div>
                  )}
                </>
              ) : (
                <Empty description="暂无公开数据集" />
              )}
            </div>
          </TabPane>
        </Tabs>
        
        <div className={styles.createDatasetLink}>
          <Button 
            type="link" 
            icon={<PlusOutlined />} 
            onClick={handleCreateDataset}
          >
            创建新数据集
          </Button>
        </div>
        
        <div className={styles.formActions}>
          <Button 
            onClick={() => navigate(`/projects/${projectId}`)}
          >
            取消
          </Button>
          <Button 
            type="primary" 
            onClick={handleSubmit} 
            loading={submitting}
            disabled={selectedDatasetIds.length === 0}
          >
            确认选择
          </Button>
        </div>
      </Card>
    </Layout.Content>
  );
};

export default SelectDatasetsPage; 