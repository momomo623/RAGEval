import React, { useState, useEffect } from 'react';
import {
  Layout, Typography, Button, Card, Spin, message,
  Modal, Tabs, Breadcrumb, Form, Select
} from 'antd';
import {
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { DatasetDetail, Question } from '../../../types/dataset';
import { datasetService } from '../../../services/dataset.service';
import { ragAnswerService } from '../../../services/rag-answer.service';
import styles from './DatasetDetail.module.css';
import QuestionGenerationContent from '../../QuestionGeneration/QuestionGenerationContent';

// 导入子组件
import DatasetHeader from './components/DatasetHeader';
import QuestionListTab from './components/QuestionListTab';
import RelatedProjectsTab from './components/RelatedProjectsTab';
import AddQuestionModal from './components/AddQuestionModal';
import RagAnswerModal from './components/RagAnswerModal';

const { Title, Text } = Typography;
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
  const [form] = Form.useForm();
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [isRagAnswerModalVisible, setIsRagAnswerModalVisible] = useState(false);
  const [editingRagAnswer, setEditingRagAnswer] = useState<any>(null);
  const [currentQuestionId, setCurrentQuestionId] = useState<string>('');
  const [ragAnswerForm] = Form.useForm();
  const [activeTabKey, setActiveTabKey] = useState<string>('questions');

  useEffect(() => {
    if (id) {
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
    if (!datasetId) {
      console.error('获取问题列表失败: 数据集ID未提供');
      return;
    }

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

  const handleAddQuestion = () => {
    setIsAddModalVisible(true);
  };

  const handleSearch = (value: string) => {
    setSearchText(value);
    setCurrentPage(1);
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
            answer_text: rag_answer, // 使用answer_text字段名以匹配后端期望
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
            question_text: values.question_text,
            standard_answer: values.standard_answer,
            category: values.category,
            difficulty: values.difficulty,
            tags: values.tags,
            rag_answer: {
              answer_text: values.rag_answer, // 使用answer_text字段名以匹配后端期望
              version: values.rag_version || 'v1',
              collection_method: 'manual',
              source_system: 'manual input'
            }
          };

          // 不再删除rag_answer字段，确保RAG回答数据被发送到后端
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

        let result: { success: boolean; imported_count: number };
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

      // 创建请求数据对象
      const requestData = {
        answer: values.answer, // 这里使用answer字段，因为ragAnswerService.createRagAnswer和updateRagAnswer期望这个字段名
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
  const handleDeleteRagAnswer = async (ragAnswerId: string, _questionId: string) => {
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

  const handleTabChange = (key: string) => {
    setActiveTabKey(key);

    // 当切换到问题列表标签页时，重新加载问题数据
    if (key === 'questions' && id) {
      fetchQuestions(id, {
        page: currentPage,
        size: pageSize,
        search: searchText,
        category: categoryFilter,
        difficulty: difficultyFilter
      });
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

      {/* 数据集头部信息 */}
      <DatasetHeader
        dataset={dataset}
        isOwner={isOwner}
        onEditDataset={handleEditDataset}
        onDeleteDataset={handleDeleteDataset}
        onImportData={handleImportData}
        onExportData={handleExport}
      />

      <Card className={styles.contentCard}>
        <Tabs defaultActiveKey="questions" activeKey={activeTabKey} onChange={handleTabChange}>
          <TabPane tab="问题列表" key="questions">
            <QuestionListTab
              questions={questions}
              questionsLoading={questionsLoading}
              total={total}
              currentPage={currentPage}
              pageSize={pageSize}
              searchText={searchText}
              categoryFilter={categoryFilter}
              difficultyFilter={difficultyFilter}
              selectedRowKeys={selectedRowKeys}
              editingKey={editingKey}
              expandedRowKeys={expandedRowKeys}
              form={form}
              onAddQuestion={handleAddQuestion}
              onSearch={handleSearch}
              onSelectChange={handleSelectChange}
              onBatchDelete={handleBatchDelete}
              onEdit={edit}
              onSave={save}
              onCancel={cancel}
              onDeleteQuestion={handleDeleteQuestion}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              onExpandedRowsChange={setExpandedRowKeys}
              showAddRagAnswerModal={showAddRagAnswerModal}
              showEditRagAnswerModal={showEditRagAnswerModal}
              handleDeleteRagAnswer={handleDeleteRagAnswer}
            />
          </TabPane>

          <TabPane tab="关联项目" key="projects">
            <RelatedProjectsTab dataset={dataset} />
          </TabPane>

          {/* AI生成问答对 */}
          <TabPane tab="AI生成问答对" key="generate-qa">
            {dataset && id && (
              <QuestionGenerationContent
                datasetId={id}
                onGenerationComplete={() => {
                  fetchQuestions(id, {
                    page: currentPage,
                    size: pageSize,
                    search: searchText,
                    category: categoryFilter,
                    difficulty: difficultyFilter
                  });
                }}
              />
            )}
          </TabPane>
        </Tabs>
      </Card>

      {/* 添加问题模态框 */}
      <AddQuestionModal
        visible={isAddModalVisible}
        onCancel={() => {
          setIsAddModalVisible(false);
          addForm.resetFields();
          setBatchQuestions('');
          setBatchPreview([]);
          setIncludeRagAnswer(false);
        }}
        onSubmit={handleAddSubmit}
        form={addForm}
        batchQuestions={batchQuestions}
        batchPreview={batchPreview}
        includeRagAnswer={includeRagAnswer}
        setIncludeRagAnswer={setIncludeRagAnswer}
        addTabMode={addTabMode}
        setAddTabMode={setAddTabMode}
        delimiterType={delimiterType}
        setDelimiterType={setDelimiterType}
        onBatchTextChange={handleBatchTextChange}
      />

      {/* RAG回答编辑模态框 */}
      <RagAnswerModal
        visible={isRagAnswerModalVisible}
        editingRagAnswer={editingRagAnswer}
        onCancel={() => setIsRagAnswerModalVisible(false)}
        onSubmit={handleRagAnswerSubmit}
        form={ragAnswerForm}
      />
    </Layout.Content>
  );
};

export default DatasetDetailPage;
