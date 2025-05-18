import React, { useState } from 'react';
import { 
  Modal, Form, Input, Select, Tabs, Row, Col, 
  Divider, Checkbox, Radio, Tag, Typography
} from 'antd';
import TextArea from 'antd/es/input/TextArea';
import styles from '../DatasetDetail.module.css';

const { Option } = Select;
const { TabPane } = Tabs;
const { Text } = Typography;

interface AddQuestionModalProps {
  visible: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  form: any;
  batchQuestions: string;
  batchPreview: any[];
  includeRagAnswer: boolean;
  setIncludeRagAnswer: (value: boolean) => void;
  addTabMode: 'single' | 'batch';
  setAddTabMode: (mode: 'single' | 'batch') => void;
  delimiterType: 'tab' | 'symbol';
  setDelimiterType: (type: 'tab' | 'symbol') => void;
  onBatchTextChange: (text: string) => void;
}

const AddQuestionModal: React.FC<AddQuestionModalProps> = ({
  visible,
  onCancel,
  onSubmit,
  form,
  batchQuestions,
  batchPreview,
  includeRagAnswer,
  setIncludeRagAnswer,
  addTabMode,
  setAddTabMode,
  delimiterType,
  setDelimiterType,
  onBatchTextChange
}) => {
  return (
    <Modal
      title="添加新问题"
      visible={visible}
      onOk={onSubmit}
      onCancel={onCancel}
      width={800}
      okText="添加"
      cancelText="取消"
    >
      <Tabs defaultActiveKey="single" onChange={(key) => setAddTabMode(key as 'single' | 'batch')}>
        <TabPane tab="单个添加" key="single">
          <Form
            form={form}
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
                  initialValue="事实型"
                >
                  <Select>
                    <Option value="事实型">事实型</Option>
                    <Option value="概念型">概念型</Option>
                    <Option value="程序型">程序型</Option>
                    <Option value="比较型">比较型</Option>
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
              <Typography.Title level={5}>批量添加说明</Typography.Title>
              <div>
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
            </div>
            
            <Form.Item
              label="批量输入问题"
              required
            >
              <TextArea 
                rows={10} 
                value={batchQuestions}
                onChange={(e) => onBatchTextChange(e.target.value)}
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
  );
};

export default AddQuestionModal;
