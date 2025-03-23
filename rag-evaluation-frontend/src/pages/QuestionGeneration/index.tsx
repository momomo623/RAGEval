import React, { useState, useEffect } from 'react';
import { Card, Button, Upload, Spin, Form, InputNumber, Select, Radio, Divider, message, Table, Progress, Alert } from 'antd';
import { UploadOutlined, FileTextOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useConfigContext } from '../../contexts/ConfigContext';
import { questionGeneratorService } from '../../services/QuestionGeneratorService';
import { TextChunk, GenerationParams, GeneratedQA, ProgressInfo } from '../../types/question-generator';
import styles from './QuestionGeneration.module.css';

const { Option } = Select;
const { Column } = Table;

const QuestionGenerationPage: React.FC = () => {
  const { datasetId } = useParams<{ datasetId: string }>();
  const navigate = useNavigate();
  const { getLLMConfig } = useConfigContext();
  const [form] = Form.useForm();
  
  const [isConfigured, setIsConfigured] = useState(false);
  const [fileList, setFileList] = useState<any[]>([]);
  const [chunks, setChunks] = useState<TextChunk[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQAs, setGeneratedQAs] = useState<GeneratedQA[]>([]);
  const [progress, setProgress] = useState<ProgressInfo>({
    totalChunks: 0,
    completedChunks: 0,
    totalQAPairs: 0,
    generatedQAPairs: 0,
    isCompleted: false
  });
  const [currentTab, setCurrentTab] = useState<'upload' | 'chunks' | 'generate' | 'results'>('upload');
  
  useEffect(() => {
    // 检查LLM配置
    const llmConfig = getLLMConfig();
    setIsConfigured(!!llmConfig);
  }, [getLLMConfig]);
  
  const handleFileUpload = async (info: any) => {
    let fileList = [...info.fileList];
    // 限制最多上传5个文件
    fileList = fileList.slice(-5);
    setFileList(fileList);
    
    if (info.file.status === 'done') {
      message.success(`${info.file.name} 上传成功`);
    } else if (info.file.status === 'error') {
      message.error(`${info.file.name} 上传失败`);
    }
  };
  
  const handleProcessFiles = async () => {
    if (fileList.length === 0) {
      message.warning('请先上传文件');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const files = fileList.map(file => file.originFileObj);
      const processedChunks = await questionGeneratorService.processFiles(files);
      setChunks(processedChunks);
      setCurrentTab('chunks');
      message.success('文件处理完成，请确认文本分块');
    } catch (error) {
      message.error(`处理文件失败: ${(error as Error).message}`);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleChunkSelectionChange = (chunkId: string, selected: boolean) => {
    questionGeneratorService.updateChunkSelection(chunkId, selected);
    setChunks(prevChunks => 
      prevChunks.map(chunk => 
        chunk.id === chunkId ? { ...chunk, selected } : chunk
      )
    );
  };
  
  const handleGenerateQA = async () => {
    try {
      await form.validateFields();
      
      const llmConfig = getLLMConfig();
      if (!llmConfig) {
        message.error('请先配置大模型API');
        return;
      }
      
      if (!datasetId) {
        message.error('数据集ID不能为空');
        return;
      }
      
      const values = form.getFieldsValue();
      const params: GenerationParams = {
        count: values.count,
        difficulty: values.difficulty,
        questionTypes: values.questionTypes,
        maxTokens: values.maxTokens
      };
      
      setIsGenerating(true);
      setCurrentTab('generate');
      setGeneratedQAs([]);
      
      // 开始生成问答对
      await questionGeneratorService.generateQAPairs(
        params,
        datasetId,
        llmConfig,
        (newProgress, newQAs) => {
          setProgress(newProgress);
          if (newQAs) {
            setGeneratedQAs(prev => [...prev, ...newQAs]);
          }
          
          // 如果生成完成，跳转到结果页
          if (newProgress.isCompleted) {
            setCurrentTab('results');
            setIsGenerating(false);
          }
        }
      );
    } catch (error) {
      message.error(`生成问答对失败: ${(error as Error).message}`);
      setIsGenerating(false);
    }
  };
  
  const handleStopGeneration = () => {
    questionGeneratorService.stopGeneration();
    message.info('正在停止生成...');
  };
  
  const handleFinish = () => {
    message.success('问答对已保存到数据集');
    navigate(`/datasets/${datasetId}`);
  };
  
  const renderUploadContent = () => (
    <Card title="上传文档" className={styles.card}>
      <Upload.Dragger
        multiple
        fileList={fileList}
        onChange={handleFileUpload}
        beforeUpload={() => false}
        accept=".txt,.pdf,.docx,.html,.md"
      >
        <p className="ant-upload-drag-icon">
          <UploadOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
        <p className="ant-upload-hint">
          支持 PDF、DOCX、TXT、HTML、Markdown 格式
        </p>
      </Upload.Dragger>
      
      <div className={styles.actionBar}>
        <Button
          type="primary"
          onClick={handleProcessFiles}
          loading={isProcessing}
          disabled={fileList.length === 0}
        >
          处理文件
        </Button>
      </div>
    </Card>
  );
  
  const renderChunksContent = () => (
    <Card title="文本分块确认" className={styles.card}>
      <div className={styles.chunksInfo}>
        <p>共分割出 {chunks.length} 个文本块，请确认要处理的块</p>
        <p>选中的块: {chunks.filter(c => c.selected).length} / {chunks.length}</p>
      </div>
      
      <div className={styles.chunksList}>
        {chunks.map(chunk => (
          <Card 
            key={chunk.id}
            className={`${styles.chunkCard} ${chunk.selected ? styles.chunkSelected : ''}`}
            size="small"
          >
            <div className={styles.chunkHeader}>
              <div className={styles.chunkInfo}>
                <span>ID: {chunk.id.substring(0, 8)}</span>
                <span>约 {chunk.tokens} tokens</span>
              </div>
              <div>
                <Radio 
                  checked={chunk.selected}
                  onChange={(e) => handleChunkSelectionChange(chunk.id, e.target.checked)}
                />
              </div>
            </div>
            <div className={styles.chunkContent}>
              {chunk.content.substring(0, 200)}...
            </div>
          </Card>
        ))}
      </div>
      
      <Divider />
      
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          count: 3,
          difficulty: 'mixed',
          questionTypes: ['factoid', 'conceptual'],
          maxTokens: 1000
        }}
      >
        <div className={styles.formGrid}>
          <Form.Item 
            name="count" 
            label="每个块生成问题数量"
            rules={[{ required: true, message: '请输入数量' }]}
          >
            <InputNumber min={1} max={10} />
          </Form.Item>
          
          <Form.Item 
            name="difficulty" 
            label="问题难度"
            rules={[{ required: true, message: '请选择难度' }]}
          >
            <Select>
              <Option value="easy">简单</Option>
              <Option value="medium">中等</Option>
              <Option value="hard">困难</Option>
              <Option value="mixed">混合难度</Option>
            </Select>
          </Form.Item>
          
          <Form.Item 
            name="questionTypes" 
            label="问题类型"
            rules={[{ required: true, message: '请选择问题类型' }]}
          >
            <Select mode="multiple">
              <Option value="factoid">事实型</Option>
              <Option value="conceptual">概念型</Option>
              <Option value="procedural">程序型</Option>
              <Option value="comparative">比较型</Option>
            </Select>
          </Form.Item>
          
          <Form.Item 
            name="maxTokens" 
            label="回答最大长度"
            rules={[{ required: true, message: '请输入最大长度' }]}
          >
            <InputNumber min={100} max={2000} step={100} />
          </Form.Item>
        </div>
      </Form>
      
      <div className={styles.actionBar}>
        <Button onClick={() => setCurrentTab('upload')}>
          返回上传
        </Button>
        <Button
          type="primary"
          onClick={handleGenerateQA}
          disabled={chunks.filter(c => c.selected).length === 0 || !isConfigured}
        >
          开始生成问答对
        </Button>
      </div>
      
      {!isConfigured && (
        <Alert
          message="请先配置大模型API"
          description="生成问答对需要配置大模型API"
          type="warning"
          showIcon
          style={{ marginTop: 16 }}
        />
      )}
    </Card>
  );
  
  const renderGenerationContent = () => (
    <Card title="生成问答对" className={styles.card}>
      <div className={styles.progressCard}>
        <div className={styles.progressInfo}>
          <div>
            <p>处理进度：{progress.completedChunks} / {progress.totalChunks} 个文本块</p>
            <Progress 
              percent={Math.round((progress.completedChunks / progress.totalChunks) * 100)} 
              status={progress.error ? 'exception' : 'active'}
            />
          </div>
          
          <div>
            <p>生成进度：{progress.generatedQAPairs} / {progress.totalQAPairs} 个问答对</p>
            <Progress 
              percent={Math.round((progress.generatedQAPairs / progress.totalQAPairs) * 100)} 
              status={progress.error ? 'exception' : 'active'}
            />
          </div>
        </div>
        
        {progress.currentChunk && (
          <div className={styles.currentChunk}>
            <p>当前处理块: ID {progress.currentChunk.id.substring(0, 8)}</p>
            <div className={styles.chunkContent}>
              {progress.currentChunk.content.substring(0, 150)}...
            </div>
          </div>
        )}
        
        {progress.error && (
          <Alert
            message="生成出错"
            description={progress.error}
            type="error"
            showIcon
          />
        )}
        
        <div className={styles.generationPreview}>
          <h3>已生成的问答对 ({generatedQAs.length})</h3>
          {generatedQAs.slice(-5).map(qa => (
            <div key={qa.id} className={styles.qaPreview}>
              <div className={styles.question}>Q: {qa.question}</div>
              <div className={styles.answer}>A: {qa.answer.substring(0, 100)}...</div>
            </div>
          ))}
        </div>
        
        <div className={styles.actionBar}>
          <Button
            danger
            onClick={handleStopGeneration}
            disabled={progress.isCompleted}
          >
            停止生成
          </Button>
          {progress.isCompleted && (
            <Button
              type="primary"
              onClick={() => setCurrentTab('results')}
            >
              查看结果
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
  
  const renderResultsContent = () => (
    <Card title="生成结果" className={styles.card}>
      <div className={styles.resultSummary}>
        <div className={styles.statCard}>
          <FileTextOutlined className={styles.statIcon} />
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{chunks.filter(c => c.selected).length}</div>
            <div className={styles.statLabel}>处理的文本块</div>
          </div>
        </div>
        
        <div className={styles.statCard}>
          <CheckCircleOutlined className={styles.statIcon} />
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{generatedQAs.length}</div>
            <div className={styles.statLabel}>生成的问答对</div>
          </div>
        </div>
        
        {progress.error && (
          <div className={styles.statCard}>
            <CloseCircleOutlined className={styles.statIcon} style={{ color: '#ff4d4f' }} />
            <div className={styles.statInfo}>
              <div className={styles.statValue}>错误</div>
              <div className={styles.statLabel}>{progress.error}</div>
            </div>
          </div>
        )}
      </div>
      
      <Divider />
      
      <Table
        dataSource={generatedQAs}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        scroll={{ y: 400 }}
      >
        <Column title="问题" dataIndex="question" key="question" ellipsis />
        <Column title="回答" dataIndex="answer" key="answer" ellipsis />
        <Column title="难度" dataIndex="difficulty" key="difficulty" width={100} />
        <Column title="类别" dataIndex="category" key="category" width={100} />
      </Table>
      
      <div className={styles.actionBar}>
        <Button onClick={() => setCurrentTab('chunks')}>
          返回设置
        </Button>
        <Button type="primary" onClick={handleFinish}>
          完成
        </Button>
      </div>
    </Card>
  );
  
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>生成问答对</h1>
        <p>通过大模型根据文档自动生成高质量问答对</p>
      </div>
      
      <div className={styles.content}>
        {currentTab === 'upload' && renderUploadContent()}
        {currentTab === 'chunks' && renderChunksContent()}
        {currentTab === 'generate' && renderGenerationContent()}
        {currentTab === 'results' && renderResultsContent()}
      </div>
    </div>
  );
};

export default QuestionGenerationPage; 