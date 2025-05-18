import React, { useState } from 'react';
import {
  Button, Table, Space, Input, Form, Tag, Tooltip,
  Popconfirm, Empty, message, Card, Tabs
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined,
  QuestionOutlined
} from '@ant-design/icons';

import { Question } from '../../../../types/dataset';
import styles from '../DatasetDetail.module.css';

const { TabPane } = Tabs;

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

interface QuestionListTabProps {
  questions: Question[];
  questionsLoading: boolean;
  total: number;
  currentPage: number;
  pageSize: number;
  searchText: string;
  categoryFilter?: string;
  difficultyFilter?: string;
  selectedRowKeys: React.Key[];
  editingKey: string;
  expandedRowKeys: string[];
  form: any;
  onAddQuestion: () => void;
  onSearch: (value: string) => void;
  onSelectChange: (selectedRowKeys: React.Key[]) => void;
  onBatchDelete: () => void;
  onEdit: (record: Question) => void;
  onSave: (questionId: string) => void;
  onCancel: () => void;
  onDeleteQuestion: (questionId: string) => void;
  onPageChange: (page: number, pageSize?: number) => void;
  onPageSizeChange: (current: number, size: number) => void;
  onExpandedRowsChange: (expandedRows: string[]) => void;
  showAddRagAnswerModal: (questionId: string) => void;
  showEditRagAnswerModal: (ragAnswer: any, questionId: string) => void;
  handleDeleteRagAnswer: (ragAnswerId: string, questionId: string) => void;
}

const QuestionListTab: React.FC<QuestionListTabProps> = ({
  questions,
  questionsLoading,
  total,
  currentPage,
  pageSize,
  searchText,
  categoryFilter,
  difficultyFilter,
  selectedRowKeys,
  editingKey,
  expandedRowKeys,
  form,
  onAddQuestion,
  onSearch,
  onSelectChange,
  onBatchDelete,
  onEdit,
  onSave,
  onCancel,
  onDeleteQuestion,
  onPageChange,
  onPageSizeChange,
  onExpandedRowsChange,
  showAddRagAnswerModal,
  showEditRagAnswerModal,
  handleDeleteRagAnswer
}) => {
  const isEditing = (record: Question) => record.id === editingKey;

  // 渲染RAG回答列表
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

  const columns = [
    {
      title: '序号',
      dataIndex: 'index',
      key: 'index',
      width: 60,
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
                onExpandedRowsChange([]);
              } else {
                onExpandedRowsChange([record.id]);
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
                  onExpandedRowsChange([]);
                } else {
                  onExpandedRowsChange([record.id]);
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
      width: 140,
      fixed: 'right',
      render: (_: any, record: Question) => {
        const editable = isEditing(record);
        return editable ? (
          <span>
            <Button
              type="link"
              onClick={() => onSave(record.id)}
              style={{ marginRight: 8 }}
            >
              保存
            </Button>
            <Button type="link" onClick={onCancel}>取消</Button>
          </span>
        ) : (
          <Space>
            <Button
              type="link"
              disabled={editingKey !== ''}
              onClick={() => onEdit(record)}
            >
              编辑
            </Button>
            <Popconfirm
              title="确定要删除此问题吗?"
              onConfirm={() => onDeleteQuestion(record.id)}
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
    onChange: onSelectChange,
  };

  return (
    <div>
      <div className={styles.tableHeader}>
        <div className={styles.tableActions}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={onAddQuestion}
          >
            添加问题
          </Button>
          {selectedRowKeys.length > 0 && (
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={onBatchDelete}
            >
              删除所选 ({selectedRowKeys.length})
            </Button>
          )}
        </div>
        <div className={styles.tableFilters}>
          <Input.Search
            placeholder="搜索问题"
            allowClear
            onSearch={onSearch}
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
                onChange: onPageChange,
                showSizeChanger: true,
                onShowSizeChange: onPageSizeChange
              }}
              expandable={{
                expandedRowKeys,
                onExpand: (expanded, record) => {
                  onExpandedRowsChange(expanded ? [record.id] : []);
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
    </div>
  );
};

export default QuestionListTab;
