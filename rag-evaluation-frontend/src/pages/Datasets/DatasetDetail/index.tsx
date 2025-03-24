import React, { useState, useEffect } from 'react';
import { 
  Layout, Typography, Button, Card, Tag, Spin, message,
  Table, Space, Input, Select, Modal, Menu, Dropdown,
  Tooltip, Checkbox, Row, Col, Divider, Tabs, Breadcrumb,
  Form, Popconfirm, Radio, Empty
} from 'antd';
import { 
  ArrowLeftOutlined, EditOutlined, DeleteOutlined, DownloadOutlined,
  PlusOutlined, ExclamationCircleOutlined, LinkOutlined, UploadOutlined,
  SearchOutlined, FilterOutlined, EyeOutlined, LockOutlined, CopyOutlined,
  QuestionOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { DatasetDetail, Question } from '../../../types/dataset';
import { datasetService } from '../../../services/dataset.service';
import { ragAnswerService } from '../../../services/rag-answer.service';
import styles from './DatasetDetail.module.css';
import TextArea from 'antd/es/input/TextArea';
import QuestionGenerationContent from '../../QuestionGeneration/QuestionGenerationContent';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;
const { confirm } = Modal;

interface QuestionWithRag extends Question {
  rag_answers?: Array<{
    id: string;
    answer: string;
    version: string;
    collection_method: string;
    created_at: string;
    first_response_time?: number;
    total_response_time?: number;
    character_count?: number;
    characters_per_second?: number;
  }>;
}

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
  const [isOwner, setIsOwner] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState('');
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [addForm] = Form.useForm();
  const [batchQuestions, setBatchQuestions] = useState<string>('');
  const [batchPreview, setBatchPreview] = useState<any[]>([]);
  const [addTabMode, setAddTabMode] = useState<'single' | 'batch'>('single');
  const [delimiterType, setDelimiterType] = useState<'tab' | 'symbol'>('tab');
  const [includeRagAnswer, setIncludeRagAnswer] = useState<boolean>(false);
  const [ragVersion, setRagVersion] = useState<string>('v1');
  const [form] = Form.useForm();
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [isRagAnswerModalVisible, setIsRagAnswerModalVisible] = useState(false);
  const [editingRagAnswer, setEditingRagAnswer] = useState<any>(null);
  const [currentQuestionId, setCurrentQuestionId] = useState<string>('');
  const [ragAnswerForm] = Form.useForm();
  
  useEffect(() => {
    if (id) {
      // fetchDatasetDetail(id);
      fetchQuestions(id, {
        page: currentPage,
        size: pageSize,
        search: searchText,
        category: categoryFilter,
        difficulty: difficultyFilter
      });
    }
  }, [id, currentPage, pageSize, searchText, categoryFilter, difficultyFilter]);
  useEffect(() => {
    if (id) {
      fetchDatasetDetail(id);
    }
  }, [id]);
  
  useEffect(() => {
    // 获取当前用户信息
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setCurrentUserId(user.id || null);
    
    if (dataset && user.id) {
      setIsOwner(dataset.user_id === user.id);
    }
  }, [dataset]);
  
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
  
  const fetchQuestions = async (datasetId: string, params?: any) => {
    setQuestionsLoading(true);
    try {
      console.log('正在获取问题列表，参数:', params);
      const response = await datasetService.getQuestions(datasetId, params);
      console.log('获取到的问题数据:', response);
      
      setQuestions(response.questions || []);

      setTotal(response.total || 0);
    } catch (error) {
      console.error('获取问题列表失败:', error);
      message.error('获取问题列表失败');
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
    setIsAddModalVisible(true);
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
    setSelectedRowKeys(selectedRowKeys);
  };
  
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请至少选择一个问题');
      return;
    }
    
    confirm({
      title: `确定要删除所选的 ${selectedRowKeys.length} 个问题吗?`,
      icon: <ExclamationCircleOutlined />,
      content: '此操作不可恢复',
      onOk: async () => {
        try {
          await datasetService.batchDeleteQuestions(id!, selectedRowKeys as string[]);
          message.success(`成功删除 ${selectedRowKeys.length} 个问题`);
          setSelectedRowKeys([]);
          fetchQuestions(id!, {
            page: currentPage,
            size: pageSize,
            search: searchText,
            category: categoryFilter,
            difficulty: difficultyFilter
          });
        } catch (error) {
          console.error('批量删除失败:', error);
          message.error('批量删除失败');
        }
      }
    });
  };
  
  const handleCopyDataset = () => {
    Modal.confirm({
      title: '复制到我的数据集',
      content: (
        <div>
          <p>您将创建此数据集的个人副本，包括其中所有问题。</p>
          <Input 
            placeholder="新数据集名称（可选）" 
            id="new-dataset-name"
          />
        </div>
      ),
      onOk: async () => {
        try {
          const nameInput = document.getElementById('new-dataset-name') as HTMLInputElement;
          if (!dataset) {
            message.error('数据集信息不存在');
            return;
          }
          const newName = nameInput?.value || `${dataset.name} (复制)`;
          
          const newDataset = await datasetService.copyDataset(dataset.id, newName);
          message.success('数据集已复制到您的账户');
          navigate(`/datasets/${newDataset.id}`);
        } catch (error) {
          console.error('复制数据集失败:', error);
          message.error('复制数据集失败，请重试');
        }
      }
    });
  };
  
  const isEditing = (record: Question) => record.id === editingKey;
  
  const edit = (record: Question) => {
    form.setFieldsValue({
      question_text: record.question_text,
      standard_answer: record.standard_answer,
      category: record.category || '',
      difficulty: record.difficulty || '',
    });
    setEditingKey(record.id);
  };
  
  const cancel = () => {
    setEditingKey('');
  };
  
  const save = async (questionId: string) => {
    try {
      const row = await form.validateFields();
      
      await datasetService.updateQuestion(id!, questionId, row);
      message.success('问题已更新');
      setEditingKey('');
      
      fetchQuestions(id!, {
        page: currentPage,
        size: pageSize,
        search: searchText,
        category: categoryFilter,
        difficulty: difficultyFilter
      });
    } catch (error) {
      console.error('更新问题失败:', error);
      message.error('更新失败，请重试');
    }
  };
  
  const handleDeleteQuestion = async (questionId: string) => {
    try {
      await datasetService.deleteQuestion(id!, questionId);
      message.success('问题已删除');
      fetchQuestions(id!, {
        page: currentPage,
        size: pageSize,
        search: searchText,
        category: categoryFilter,
        difficulty: difficultyFilter
      });
    } catch (error) {
      console.error('删除问题失败:', error);
      message.error('删除问题失败');
    }
  };
  
  const handleBatchTextChange = (text: string) => {
    setBatchQuestions(text);
    
    if (!text.trim()) {
      setBatchPreview([]);
      return;
    }
    
    try {
      // 解析文本为问题对象数组
      const lines = text.split('\n').filter(line => line.trim());
      const preview = lines.map(line => {
        let parts;
        
        // 根据选择的分隔符类型进行分割
        if (delimiterType === 'tab') {
          parts = line.split('\t');
        } else {
          parts = line.split('@@');
        }
        
        // 解析基本字段和可选的RAG回答
        const [question_text, standard_answer = '', category = '', difficulty = '', rag_answer = '', version = 'v1'] = parts;
        
        const result: any = {
          question_text,
          standard_answer,
          category: category || 'general',
          difficulty: difficulty || 'medium'
        };
        
        // 如果包含RAG回答字段，添加到结果中
        if (includeRagAnswer && rag_answer) {
          result.rag_answer = {
            answer: rag_answer,
            version: version || 'v1',
            collection_method: 'import',
            source_system: 'manual import'
          };
        }
        
        return result;
      });
      
      setBatchPreview(preview);
    } catch (error) {
      console.error('解析批量问题失败:', error);
      message.error('解析批量问题失败，请检查格式');
      setBatchPreview([]);
    }
  };
  
  const handleAddSubmit = async () => {
    try {
      if (addTabMode === 'single') {
        const values = await addForm.validateFields();
        
        if (includeRagAnswer && values.rag_answer?.trim()) {
          // 构建包含RAG回答的请求
          const questionWithRag = {
            ...values,
            rag_answer: {
              answer: values.rag_answer,
              version: values.rag_version || 'v1',
              collection_method: 'manual',
              source_system: 'manual input'
            }
          };
          
          delete questionWithRag.rag_answer;
          delete questionWithRag.rag_version;
          
          await datasetService.createQuestionWithRag(id!, questionWithRag);
        } else {
          await datasetService.createQuestion(id!, values);
        }
        
        message.success('问题已添加');
      } else {
        if (batchPreview.length === 0) {
          message.error('没有有效的问题可以添加');
          return;
        }
        
        const MAX_BATCH_SIZE = 500;
        if (batchPreview.length > MAX_BATCH_SIZE) {
          message.warning(`批量添加数量过多（${batchPreview.length}），已限制为${MAX_BATCH_SIZE}条。请分批添加。`);
          setBatchPreview(batchPreview.slice(0, MAX_BATCH_SIZE));
          return;
        }
        
        const hasRagAnswers = batchPreview.some(item => item.rag_answer);
        
        let result;
        if (hasRagAnswers) {
          result = await datasetService.batchCreateQuestionsWithRag(id!, batchPreview);
        } else {
          result = await datasetService.batchCreateQuestions(id!, batchPreview);
        }
        
        message.success(`成功添加 ${result.imported_count} 个问题`);
      }
      
      addForm.resetFields();
      setBatchQuestions('');
      setBatchPreview([]);
      setIsAddModalVisible(false);
      fetchQuestions(id!, {
        page: currentPage,
        size: pageSize,
        search: searchText,
        category: categoryFilter,
        difficulty: difficultyFilter
      });
    } catch (error) {
      console.error('添加问题失败:', error);
      message.error('添加问题失败');
    }
  };
  
  // 添加表格样式
  const tableStyle = {
    width: '100%',
    overflow: 'auto'
  };
  
  const renderRagAnswers = (ragAnswers: any[], questionId: string) => {
    // 确保ragAnswers是数组
    if (!ragAnswers) {
      ragAnswers = [];
    }
    
    // 当没有RAG回答时显示更友好的界面
    if (ragAnswers.length === 0) {
      return (
        <div className={styles.ragAnswersContainer}>
          <div className={styles.emptyRagContainer}>
            <div className={styles.emptyRagIcon}>
              <QuestionOutlined />
            </div>
            <div className={styles.emptyRagText}>
              该问题还没有RAG回答
            </div>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => showAddRagAnswerModal(questionId)}
            >
              添加RAG回答
            </Button>
          </div>
        </div>
      );
    }
    
    // 按版本分组
    const versionGroups = ragAnswers.reduce((groups: any, answer: any) => {
      const version = answer.version || '未知版本';
      if (!groups[version]) {
        groups[version] = [];
      }
      groups[version].push(answer);
      return groups;
    }, {});
    
    return (
      <div className={styles.ragAnswersContainer}>
        <div className={styles.ragAnswersHeader}>
          <span style={{fontSize: '16px', fontWeight: 'bold'}}>RAG系统回答 ({ragAnswers.length}个)</span>
          <Button 
            type="primary" 
            size="small" 
            icon={<PlusOutlined />}
            onClick={() => showAddRagAnswerModal(questionId)}
          >
            添加RAG回答
          </Button>
        </div>
        
        <Tabs type="card" size="small">
          {Object.entries(versionGroups).map(([version, answers]) => {
            const answerArray = Array.isArray(answers) ? answers : [];
            return (
              <TabPane tab={`${version} (${answerArray.length})`} key={version}>
                {answerArray.map((answer) => (
                  <Card 
                    key={answer.id} 
                    size="small" 
                    className={styles.ragAnswerCard}
                    title={
                      <div className={styles.ragAnswerHeader}>
                        <span>版本: {answer.version || '未知'}</span>
                        <span>收集方式: {answer.collection_method}</span>
                        <span>时间: {new Date(answer.created_at).toLocaleString()}</span>
                        <div className={styles.ragAnswerActions}>
                          <Button 
                            type="link" 
                            icon={<EditOutlined />} 
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              showEditRagAnswerModal(answer, questionId);
                            }}
                          >
                            编辑
                          </Button>
                          <Popconfirm
                            title="确定要删除此RAG回答吗?"
                            onConfirm={(e) => {
                              e?.stopPropagation();
                              handleDeleteRagAnswer(answer.id, questionId);
                            }}
                            onCancel={(e) => e?.stopPropagation()}
                          >
                            <Button 
                              type="link" 
                              danger 
                              icon={<DeleteOutlined />} 
                              size="small"
                              onClick={(e) => e.stopPropagation()}
                            >
                              删除
                            </Button>
                          </Popconfirm>
                        </div>
                      </div>
                    }
                  >
                    <div className={styles.ragAnswerContent}>
                      {answer.answer}
                    </div>
                    {answer.first_response_time && (
                      <div className={styles.ragAnswerPerformance}>
                        <Tag color="blue">首次响应: {answer.first_response_time.toFixed(2)}秒</Tag>
                        <Tag color="green">总响应时间: {answer.total_response_time?.toFixed(2)}秒</Tag>
                        <Tag color="purple">字符数: {answer.character_count}</Tag>
                        <Tag color="orange">生成速度: {answer.characters_per_second?.toFixed(2)}字/秒</Tag>
                      </div>
                    )}
                  </Card>
                ))}
              </TabPane>
            );
          })}
        </Tabs>
      </div>
    );
  };
  
  // 显示添加 RAG 回答模态框
  const showAddRagAnswerModal = (questionId: string) => {
    setCurrentQuestionId(questionId);
    setEditingRagAnswer(null);
    ragAnswerForm.resetFields();
    setIsRagAnswerModalVisible(true);
  };
  
  // 显示编辑 RAG 回答模态框
  const showEditRagAnswerModal = (ragAnswer: any, questionId: string) => {
    setCurrentQuestionId(questionId);
    setEditingRagAnswer(ragAnswer);
    ragAnswerForm.setFieldsValue({
      answer: ragAnswer.answer,
      version: ragAnswer.version,
      collection_method: ragAnswer.collection_method || 'manual'
    });
    setIsRagAnswerModalVisible(true);
  };
  
  // 处理 RAG 回答提交
  const handleRagAnswerSubmit = async () => {
    try {
      const values = await ragAnswerForm.validateFields();
      
      // 创建请求数据对象，使用 answer 而不是 answer
      const requestData = editingRagAnswer ? {
        answer: values.answer,  // 更新时使用 answer
        version: values.version,
        collection_method: values.collection_method,
        question_id: currentQuestionId
      } : {
        answer: values.answer,      // 创建时使用 answer
        version: values.version,
        collection_method: values.collection_method,
        question_id: currentQuestionId
      };
      
      if (editingRagAnswer) {
        // 更新现有回答
        await ragAnswerService.updateRagAnswer(editingRagAnswer.id, requestData);
        message.success('RAG回答已更新');
      } else {
        // 添加新回答
        await ragAnswerService.createRagAnswer(requestData);
        message.success('RAG回答已添加');
      }
      
      setIsRagAnswerModalVisible(false);
      
      // 刷新问题列表以显示更新
      fetchQuestions(id!, {
        page: currentPage,
        size: pageSize,
        search: searchText,
        category: categoryFilter,
        difficulty: difficultyFilter
      });
      
    } catch (error) {
      console.error('保存RAG回答失败:', error);
      message.error('保存失败，请重试');
    }
  };
  
  // 处理删除 RAG 回答
  const handleDeleteRagAnswer = async (ragAnswerId: string, questionId: string) => {
    try {
      await ragAnswerService.deleteRagAnswer(ragAnswerId);
      message.success('RAG回答已删除');
      
      // 刷新问题列表
      fetchQuestions(id!, {
        page: currentPage,
        size: pageSize,
        search: searchText,
        category: categoryFilter,
        difficulty: difficultyFilter
      });
      
    } catch (error) {
      console.error('删除RAG回答失败:', error);
      message.error('删除失败，请重试');
    }
  };
  
  const columns = [
    {
      title: '序号',
      dataIndex: 'index',
      key: 'index',
      width: 60,
      // 居中
      align: 'center',
      render: (_: any, __: any, index: number) => (currentPage - 1) * pageSize + index + 1,
    },
    {
      title: '问题',
      dataIndex: 'question_text',
      key: 'question_text',
      width: 300,
      ellipsis: true,
      render: (text: string, record: QuestionWithRag) => {
        if (isEditing(record)) {
          return (
            <Form.Item
              name="question_text"
              style={{ margin: 0 }}
              rules={[{ required: true, message: '请输入问题' }]}
            >
              <Input.TextArea autoSize />
            </Form.Item>
          );
        }
        
        return (
          <div 
            className={styles.questionContainer}
            onClick={() => {
              // 无论是否有RAG回答，点击都可以展开
              if (expandedRowKeys.includes(record.id)) {
                setExpandedRowKeys([]);
              } else {
                setExpandedRowKeys([record.id]);
              }
            }}
          >
            <div className={styles.questionText}>
              <Tooltip title={text} placement="topLeft" overlayStyle={{ maxWidth: '600px' }}>
                <span>{text}</span>
              </Tooltip>
            </div>
            {/* 改为始终显示RAG标签，只是根据有无回答来区分样式 */}
            <Tag 
              color={record.rag_answers?.length ? "blue" : "default"} 
              className={styles.ragBadge}
              onClick={(e) => {
                e.stopPropagation();
                if (expandedRowKeys.includes(record.id)) {
                  setExpandedRowKeys([]);
                } else {
                  setExpandedRowKeys([record.id]);
                }
              }}
            >
              {record.rag_answers?.length ? (
                <>
                  <span className={styles.ragCount}>{record.rag_answers.length}</span>
                  <span className={styles.ragLabel}>RAG</span>
                </>
              ) : (
                <span className={styles.ragLabel}>添加RAG</span>
              )}
            </Tag>
          </div>
        );
      },
    },
    {
      title: '标准答案',
      width: 350,
      dataIndex: 'standard_answer',
      key: 'standard_answer',
      ellipsis: true,
      render: (text: string, record: Question) => {
        if (isEditing(record)) {
          return (
            <Form.Item
              name="standard_answer"
              style={{ margin: 0 }}
              rules={[{ required: true, message: '请输入标准答案' }]}
            >
              <Input.TextArea autoSize />
            </Form.Item>
          );
        }
        return (
          <Tooltip title={text} placement="topLeft" overlayStyle={{ maxWidth: '600px' }}>
            <span>{text}</span>
          </Tooltip>
        );
      },
    },
    {
      title: '难度',
      dataIndex: 'difficulty',
      key: 'difficulty',
      width: 100,
      render: (text) => {
        const difficultyMap = {
          'easy': '简单',
          'medium': '中等',
          'hard': '困难'
        };
        return difficultyMap[text] || text;
      }
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (text) => {
        const categoryMap = {
          'factoid': '事实型',
          'conceptual': '概念型',
          'procedural': '程序型',
          'comparative': '比较型'
        };
        return categoryMap[text] || text;
      }
    },
    
    {
      title: '操作',
      key: 'action',
      width: 140, // 减小宽度
      fixed: 'right',
      render: (_: any, record: Question) => {
        const editable = isEditing(record);
        return editable ? (
          <span>
            <Button 
              type="link" 
              onClick={() => save(record.id)} 
              style={{ marginRight: 8 }}
            >
              保存
            </Button>
            <Button type="link" onClick={cancel}>取消</Button>
          </span>
        ) : (
          <Space>
            <Button 
              type="link" 
              disabled={editingKey !== ''} 
              onClick={() => edit(record)}
            >
              编辑
            </Button>
            <Popconfirm
              title="确定要删除此问题吗?"
              onConfirm={() => handleDeleteQuestion(record.id)}
            >
              <Button type="link" danger>删除</Button>
            </Popconfirm>
          </Space>
        );
      }
    },
  ];
  
  const rowSelection = {
    selectedRowKeys,
    onChange: handleSelectChange,
  };
  
  const handlePageChange = (page: number, pageSize?: number) => {
    setCurrentPage(page);
    if (pageSize) setPageSize(pageSize);
    
    if (id) {
      fetchQuestions(id, {
        page,
        size: pageSize || 10,
        search: searchText,
        category: categoryFilter,
        difficulty: difficultyFilter
      });
    }
  };
  
  const handlePageSizeChange = (current: number, size: number) => {
    setCurrentPage(current);
    setPageSize(size);
  };
  
  const handleExport = async () => {
    try {
      // 收集当前的过滤条件
      const filters = {
        search: searchText,
        category: categoryFilter,
        difficulty: difficultyFilter
      };
      
      // 导出当前筛选的数据
      await datasetService.exportQuestions(id!, filters);
    } catch (error) {
      message.error('导出失败，请重试');
      console.error('导出错误:', error);
    }
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
              {isOwner ? (
                /* 所有者可以编辑和删除 */
                <>
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
                        <Menu.Item key="export" icon={<DownloadOutlined />} onClick={handleExport}>
                          导出数据
                        </Menu.Item>
                      </Menu>
                    }
                  >
                    <Button>
                      更多 <DownloadOutlined />
                    </Button>
                  </Dropdown>
                </>
              ) : (
                /* 非所有者只能查看和复制 */
                <>
                  {dataset.is_public && (
                    <Button 
                      type="primary"
                      icon={<CopyOutlined />} 
                      onClick={handleCopyDataset}
                    >
                      复制到我的数据集
                    </Button>
                  )}
                  <Button 
                    icon={<DownloadOutlined />} 
                    onClick={handleExport}
                  >
                    导出数据
                  </Button>
                </>
              )}
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
                {selectedRowKeys.length > 0 && (
                  <Button 
                    danger 
                    icon={<DeleteOutlined />} 
                    onClick={handleBatchDelete}
                  >
                    删除所选 ({selectedRowKeys.length})
                  </Button>
                )}
              </div>
              <div className={styles.tableFilters}>
                {/* <Select 
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
                </Select> */}
                <Input.Search
                  placeholder="搜索问题"
                  allowClear
                  onSearch={handleSearch}
                  style={{ width: 250 }}
                />
              </div>
            </div>
            
            {!questionsLoading && questions.length > 0 ? (
              <div className={styles.tableContainer}>
                <Form form={form}>
                  <Table
                    rowSelection={rowSelection}
                    columns={columns as any}
                    dataSource={questions as QuestionWithRag[]}
                    rowKey="id"
                    pagination={{
                      current: currentPage,
                      pageSize: pageSize,
                      total: total,
                      onChange: handlePageChange,
                      showSizeChanger: true,
                      onShowSizeChange: handlePageSizeChange
                    }}
                    expandable={{
                      expandedRowKeys,
                      onExpand: (expanded, record) => {
                        setExpandedRowKeys(expanded ? [record.id] : []);
                      },
                      expandedRowRender: (record: QuestionWithRag) => 
                        renderRagAnswers(record.rag_answers || [], record.id),
                      showExpandColumn: false,
                    }}
                    scroll={{ x: 950 }}
                  />
                </Form>
              </div>
            ) : (
              <Empty description={questionsLoading ? "加载中..." : "暂无数据"} />
            )}
          </TabPane>
          <TabPane tab="关联项目" key="projects">
            <div className={styles.projectsContainer}>
              {dataset.projects && dataset.projects.length > 0 ? (
                <div className={styles.projectList}>

                  {(dataset.projects || []).map(project => (
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

          {/* AI生成问答对 */}
          <TabPane tab="AI生成问答对" key="generate-qa">
            {dataset && id && <QuestionGenerationContent datasetId={id} />}
          </TabPane>

        </Tabs>
      </Card>
      
      <Modal
        title="添加新问题"
        visible={isAddModalVisible}
        onOk={handleAddSubmit}
        onCancel={() => {
          setIsAddModalVisible(false);
          addForm.resetFields();
          setBatchQuestions('');
          setBatchPreview([]);
          setIncludeRagAnswer(false);
        }}
        width={800}
        okText="添加"
        cancelText="取消"
      >
        <Tabs defaultActiveKey="single" onChange={(key) => setAddTabMode(key as 'single' | 'batch')}>
          <TabPane tab="单个添加" key="single">
            <Form
              form={addForm}
              layout="vertical"
            >
              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item
                    name="question_text"
                    label="问题"
                    rules={[{ required: true, message: '请输入问题' }]}
                  >
                    <TextArea rows={4} placeholder="请输入问题内容" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="standard_answer"
                    label="标准答案"
                    
                    rules={[{ required: true, message: '请输入标准答案' }]}
                  >
                    <TextArea rows={4} placeholder="请输入标准答案" />
                  </Form.Item>
                </Col>

    


              </Row>
              
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    name="category"
                    label="分类"
                    initialValue="general"
                  >
                    <Select>
                      <Option value="factoid">事实型</Option>
                      <Option value="conceptual">概念型</Option>
                      <Option value="procedural">程序型</Option>
                      <Option value="comparative">比较型</Option>
                    </Select>
                  </Form.Item>
                </Col>
                
                <Col span={8}>
                  <Form.Item
                    name="difficulty"
                    label="难度"
                    initialValue="medium"
                  >
                    <Select>
                      <Option value="easy">简单</Option>
                      <Option value="medium">中等</Option>
                      <Option value="hard">困难</Option>
                    </Select>
                  </Form.Item>
                </Col>
                
                <Col span={8}>
                  <Form.Item
                    name="tags"
                    label="标签"
                  >
                    <Select mode="tags" placeholder="添加标签">
                      <Option value="important">重要</Option>
                      <Option value="api">API</Option>
                      <Option value="feature">功能</Option>
                      <Option value="all">可自定义输入</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              
              <Divider>
                <Checkbox 
                  checked={includeRagAnswer} 
                  onChange={(e) => setIncludeRagAnswer(e.target.checked)}
                >
                  包含RAG系统回答
                </Checkbox>
              </Divider>
              
              {includeRagAnswer && (
                <div className={styles.ragAnswerSection}>
                  <Row gutter={24}>
                    <Col span={18}>
                      <Form.Item
                        name="rag_answer"
                        label="RAG系统回答"
                      >
                        <TextArea rows={4} placeholder="请输入RAG系统的回答内容" />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item
                        name="rag_version"
                        label="版本"
                        initialValue="v1"
                      >
                        <Input placeholder="版本号，如v1" />
                      </Form.Item>
                    </Col>
                  </Row>
                </div>
              )}
            </Form>
          </TabPane>
          
          <TabPane tab="批量添加" key="batch">
            <div className={styles.batchAddContainer}>
              <div className={styles.batchInstructions}>
                <Title level={5}>批量添加说明</Title>
                <div >
                  <Radio.Group 
                    value={delimiterType} 
                    onChange={(e) => setDelimiterType(e.target.value)}
                    style={{ marginBottom: '8px' }}
                  >
                    <Radio value="tab">Tab分隔（支持表格直接复制）</Radio>
                    <Radio value="symbol">@@符号分隔</Radio>
                  </Radio.Group>
                  
                  <Checkbox 
                    checked={includeRagAnswer} 
                    onChange={(e) => setIncludeRagAnswer(e.target.checked)}
                    style={{ marginLeft: '16px' }}
                  >
                    包含RAG回答字段
                  </Checkbox>
                </div>  
                
                <Text>每行一个问题，格式为：</Text>
                {includeRagAnswer ? (
                  <Text>问题<span style={{color: 'red'}}>{delimiterType === 'tab' ? '[Tab]' : '@@'}</span>标准答案<span style={{color: 'red'}}>{delimiterType === 'tab' ? '[Tab]' : '@@'}</span>分类<span style={{color: 'red'}}>{delimiterType === 'tab' ? '[Tab]' : '@@'}</span>难度<span style={{color: 'red'}}>{delimiterType === 'tab' ? '[Tab]' : '@@'}</span>RAG回答<span style={{color: 'red'}}>{delimiterType === 'tab' ? '[Tab]' : '@@'}</span>版本</Text>
                ) : (
                  <Text>问题<span style={{color: 'red'}}>{delimiterType === 'tab' ? '[Tab]' : '@@'}</span>标准答案<span style={{color: 'red'}}>{delimiterType === 'tab' ? '[Tab]' : '@@'}</span>分类<span style={{color: 'red'}}>{delimiterType === 'tab' ? '[Tab]' : '@@'}</span>难度</Text>
                )}
                <Text type="secondary">。分类、难度{includeRagAnswer ? '和版本' : ''}可以省略，将使用默认值。</Text>
                {/* <Text type="secondary">Tab分隔支持从Excel或表格直接复制</Text> */}
              </div>
              
              <Form.Item
                label="批量输入问题"
                required
              >
                <TextArea 
                  rows={10} 
                  value={batchQuestions}
                  onChange={(e) => handleBatchTextChange(e.target.value)}
                  placeholder={
                    includeRagAnswer 
                      ? `问题1${delimiterType === 'tab' ? '\t' : '@@'}标准答案1${delimiterType === 'tab' ? '\t' : '@@'}分类1${delimiterType === 'tab' ? '\t' : '@@'}难度1${delimiterType === 'tab' ? '\t' : '@@'}RAG回答1${delimiterType === 'tab' ? '\t' : '@@'}v1\n问题2${delimiterType === 'tab' ? '\t' : '@@'}标准答案2${delimiterType === 'tab' ? '\t' : '@@'}分类2${delimiterType === 'tab' ? '\t' : '@@'}难度2${delimiterType === 'tab' ? '\t' : '@@'}RAG回答2${delimiterType === 'tab' ? '\t' : '@@'}v1`
                      : `问题1${delimiterType === 'tab' ? '\t' : '@@'}标准答案1${delimiterType === 'tab' ? '\t' : '@@'}分类1${delimiterType === 'tab' ? '\t' : '@@'}难度1\n问题2${delimiterType === 'tab' ? '\t' : '@@'}标准答案2${delimiterType === 'tab' ? '\t' : '@@'}分类2${delimiterType === 'tab' ? '\t' : '@@'}难度2`
                  }
                />
              </Form.Item>
              
              {batchPreview.length > 0 && (
                <div className={styles.batchPreview}>
                  <Divider orientation="left">预览 ({batchPreview.length}个问题)</Divider>
                  <div className={styles.previewList}>
                    {batchPreview.slice(0, 5).map((question, index) => (
                      <div key={index} className={styles.previewItem}>
                        <div className={styles.previewQuestion}>
                          <Text strong>问题 {index + 1}:</Text> {question.question_text}
                        </div>
                        <div className={styles.previewAnswer}>
                          <Text type="secondary">标准答案:</Text> {question.standard_answer || '(无)'}
                        </div>
                        {question.rag_answer && (
                          <div className={styles.previewRagAnswer}>
                            <Text type="secondary">RAG回答:</Text> {question.rag_answer.answer} 
                            <Tag color="purple" style={{ marginLeft: 8 }}>版本: {question.rag_answer.version}</Tag>
                          </div>
                        )}
                        <div className={styles.previewMeta}>
                          <Tag color="blue">{question.category || 'general'}</Tag>
                          <Tag color="orange">{question.difficulty || 'medium'}</Tag>
                        </div>
                      </div>
                    ))}
                    {batchPreview.length > 5 && (
                      <div className={styles.previewMore}>
                        还有 {batchPreview.length - 5} 个问题...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </TabPane>
        </Tabs>
      </Modal>

      {/* RAG 回答编辑模态框 */}
      <Modal
        title={editingRagAnswer ? "编辑RAG回答" : "添加RAG回答"}
        visible={isRagAnswerModalVisible}
        onOk={handleRagAnswerSubmit}
        onCancel={() => setIsRagAnswerModalVisible(false)}
        width={700}
        okText={editingRagAnswer ? "更新" : "添加"}
        cancelText="取消"
      >
        <Form
          form={ragAnswerForm}
          layout="vertical"
        >
          <Form.Item
            name="answer"
            label="回答内容"
            rules={[{ required: true, message: '请输入回答内容' }]}
          >
            <TextArea rows={8} placeholder="请输入RAG系统回答内容" />
          </Form.Item>
          
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                name="version"
                label="版本"
                initialValue="v1"
                rules={[{ required: true, message: '请输入版本' }]}
              >
                <Input placeholder="如：v1, v2, gpt-4等" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="collection_method"
                label="收集方式"
                initialValue="manual"
                rules={[{ required: true, message: '请选择收集方式' }]}
              >
                <Select>
                  <Option value="manual">手动输入</Option>
                  <Option value="api">API调用</Option>
                  <Option value="import">导入</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </Layout.Content>
  );
};

export default DatasetDetailPage; 