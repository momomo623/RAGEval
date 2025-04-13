import React, { useState, useEffect } from 'react';
import { Card, Button, Upload, Spin, Form, InputNumber, Select, Radio, Divider, message, Table, Progress, Alert, Checkbox, Slider, Modal, Tooltip, Input, Badge, Space, Collapse, Typography, Empty } from 'antd';
import { UploadOutlined, FileTextOutlined, CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined, FullscreenOutlined, DeleteOutlined, EyeOutlined, WarningOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useConfigContext } from '../../contexts/ConfigContext';
import { questionGeneratorService, SplitterType, FailedRequestRecord } from '../../services/QuestionGeneratorService';
import { TextChunk, GenerationParams, GeneratedQA, ProgressInfo } from '../../types/question-generator';
import styles from './QuestionGeneration.module.css';
import ConfigButton from "../../components/ConfigButton";

const { Option } = Select;
const { Column } = Table;

interface QuestionGenerationContentProps {
  datasetId: string;
  onGenerationComplete?: () => void;
}

// 新增类型，用于保存文件内容
interface FileContent {
  name: string;
  content: string;
}

const QuestionGenerationContent: React.FC<QuestionGenerationContentProps> = ({ datasetId, onGenerationComplete }) => {
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
  const [chunkSize, setChunkSize] = useState<number>(1000);
  const [isRechunking, setIsRechunking] = useState(false);

  // 修改状态，保存文件内容而不是File对象
  const [uploadedContents, setUploadedContents] = useState<FileContent[]>([]);

  // 添加分割方式状态
  const [splitterType, setSplitterType] = useState<SplitterType>('recursive');

  // 添加新状态用于展开/折叠功能和模态窗口
  const [expandedChunks, setExpandedChunks] = useState<Set<string>>(new Set());
  const [modalVisible, setModalVisible] = useState(false);
  const [currentChunk, setCurrentChunk] = useState<TextChunk | null>(null);

  // 添加选择行状态
  const [selectedQAKeys, setSelectedQAKeys] = useState<React.Key[]>([]);

  // 添加提示词预览功能
  const [promptTemplate, setPromptTemplate] = useState<string>('');
  const [promptModalVisible, setPromptModalVisible] = useState(false);

  // 在组件的状态部分添加自定义提示词模板的状态
  const [customPromptTemplate, setCustomPromptTemplate] = useState<string>('');
  const [useCustomPrompt, setUseCustomPrompt] = useState(false);
  
  // 添加查看原始响应的状态
  const [rawResponseModalVisible, setRawResponseModalVisible] = useState(false);
  const [currentRawResponse, setCurrentRawResponse] = useState<string>('');
  
  // 添加失败记录列表状态
  const [failedRequestsModalVisible, setFailedRequestsModalVisible] = useState(false);
  const [failedRequests, setFailedRequests] = useState<FailedRequestRecord[]>([]);

  useEffect(() => {
    // 检查LLM配置
    const llmConfig = getLLMConfig();
    setIsConfigured(!!llmConfig);
  }, [getLLMConfig]);

  // 在组件初始化时，获取默认提示词模板
  useEffect(() => {
    // 获取默认提示词模板
    const defaultTemplate = questionGeneratorService.getDefaultPromptTemplate();
    setCustomPromptTemplate(defaultTemplate);
  }, []);

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

      // 读取并保存所有文件内容
      const contents: FileContent[] = [];
      for (const file of files) {
        const content = await readFileContent(file);
        contents.push({
          name: file.name,
          content
        });
      }

      // 保存文件内容
      setUploadedContents(contents);
      console.log('保存了文件内容:', contents.map(c => c.name));

      // 使用默认分块大小进行初始分块
      const processedChunks = await questionGeneratorService.processContentFiles(contents);
      setChunks(processedChunks);
      setCurrentTab('chunks');
      message.success('文件处理完成，请确认文本分块');
    } catch (error) {
      message.error(`处理文件失败: ${(error as Error).message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 读取文件内容的辅助函数
  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as string);
        } else {
          reject(new Error('读取文件内容失败'));
        }
      };

      reader.onerror = () => {
        reject(new Error(`读取文件出错: ${file.name}`));
      };

      reader.readAsText(file);
    });
  };

  // 修改重新分块功能，传入分割类型
  const handleRechunk = async () => {
    if (uploadedContents.length === 0) {
      message.warning('没有可用的文件内容进行重新分块');
      return;
    }

    setIsRechunking(true);

    try {
      console.log(`开始重新分块，设置大小: ${chunkSize}，文件数: ${uploadedContents.length}，分割策略: ${splitterType}`);
      // 使用新的分块大小和分割策略进行分块
      const processedChunks = await questionGeneratorService.processContentFiles(uploadedContents, chunkSize, splitterType);

      console.log(`重新分块完成，生成了 ${processedChunks.length} 个块`);
      setChunks(processedChunks);
      message.success(`已使用新的块大小 (${chunkSize} 字符) 和分割策略 (${splitterType}) 完成分块`);
    } catch (error) {
      message.error(`重新分块失败: ${(error as Error).message}`);
    } finally {
      setIsRechunking(false);
    }
  };

  const handleChunkSelectionChange = (chunkId: string, selected: boolean) => {
    setChunks(prevChunks =>
      prevChunks.map(chunk =>
        chunk.id === chunkId ? { ...chunk, selected } : chunk
      )
    );
  };

  // 添加处理提示词更改的函数
  const handlePromptChange = (value: string) => {
    setCustomPromptTemplate(value);
  };

  // 修改预览提示词的函数，使其使用自定义提示词
  const previewPrompt = () => {
    if (chunks.filter(c => c.selected).length === 0) {
      message.warning('请至少选择一个文本块');
      return;
    }

    const values = form.getFieldsValue();
    const params: GenerationParams = {
      count: values.count,
      difficulty: values.difficulty,
      questionTypes: values.questionTypes,
      maxTokens: values.maxTokens
    };

    // 获取第一个选中的文本块作为示例
    const sampleChunk = chunks.find(c => c.selected);
    if (sampleChunk) {
      // 使用服务中的buildPrompt方法获取实际的提示词，传入自定义模板
      const promptPreview = questionGeneratorService.previewPrompt(
        sampleChunk.content,
        params,
        useCustomPrompt ? customPromptTemplate : undefined
      );
      setPromptTemplate(promptPreview);
      setPromptModalVisible(true);
    }
  };

  // 修改生成问答对的函数，传递并发数
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
        maxTokens: values.maxTokens,
        concurrency: values.concurrency // 添加并发数
      };

      setIsGenerating(true);
      setCurrentTab('generate');
      setGeneratedQAs([]);

      // 开始生成问答对，传入自定义提示词和并发数
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
        },
        useCustomPrompt ? customPromptTemplate : undefined
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
    if (onGenerationComplete) {
      onGenerationComplete();
    }
    navigate(`/datasets/${datasetId}`);
  };

  // 添加用于处理展开/折叠的函数
  const toggleChunkExpand = (chunkId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 防止触发点击卡片的事件
    setExpandedChunks(prev => {
      const next = new Set(prev);
      if (next.has(chunkId)) {
        next.delete(chunkId);
      } else {
        next.add(chunkId);
      }
      return next;
    });
  };

  // 添加用于显示模态窗口的函数
  const showChunkModal = (chunk: TextChunk) => {
    setCurrentChunk(chunk);
    setModalVisible(true);
  };

  // 添加选择行处理函数
  const handleQASelectChange = (selectedRowKeys: React.Key[]) => {
    setSelectedQAKeys(selectedRowKeys);
  };

  // 添加处理已选项的函数
  const handleDeleteSelectedQAs = () => {
    if (selectedQAKeys.length === 0) {
      message.warning('请至少选择一项');
      return;
    }

    Modal.confirm({
      title: `确定要删除所选的 ${selectedQAKeys.length} 个问答对吗?`,
      content: '删除后不会影响已保存到数据集的问答对',
      onOk: () => {
        const filteredQAs = generatedQAs.filter(
          qa => !selectedQAKeys.includes(qa.id)
        );
        setGeneratedQAs(filteredQAs);
        setSelectedQAKeys([]);
        message.success(`已删除 ${selectedQAKeys.length} 个问答对`);
      }
    });
  };

  // 在表单下方添加提示词模板编辑区域
  const renderPromptTemplateEditor = () => (
    <div className={styles.promptTemplateEditor}>
      <Divider>提示词模板设置</Divider>
      <div className={styles.promptTemplateHeader}>
        <Checkbox
          checked={useCustomPrompt}
          onChange={(e) => setUseCustomPrompt(e.target.checked)}
        >
          使用自定义提示词模板
        </Checkbox>
        {useCustomPrompt && (
          <Button
            size="small"
            onClick={() => {
              const defaultTemplate = questionGeneratorService.getDefaultPromptTemplate();
              setCustomPromptTemplate(defaultTemplate);
            }}
          >
            恢复默认
          </Button>
        )}
      </div>
      {useCustomPrompt && (
        <div className={styles.promptTemplateContent}>
          <Alert
            message="提示词模板说明"
            description={
              <>
                <p>在模板中可以使用以下占位符：</p>
                <ul>
                  <li><code>{'{{text}}'}</code> - 文本块内容</li>
                  <li><code>{'{{count}}'}</code> - 每块生成的问题数量</li>
                </ul>
                <p>修改提示词模板可能会影响解析，请确保输出格式保持一致。</p>
              </>
            }
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Input.TextArea
            value={customPromptTemplate}
            onChange={(e) => handlePromptChange(e.target.value)}
            autoSize={{ minRows: 6, maxRows: 12 }}
            disabled={!useCustomPrompt}
          />
        </div>
      )}
    </div>
  );

  const renderUploadContent = () => (
    <Card title="上传文件" className={styles.card}>
      <div className={styles.uploadSection}>
        {!isConfigured && (
          <Alert
            message="未配置大模型API"
            description={
              <div className={styles.alertContent}>
                <p className={styles.alertText}>请先配置大模型API才能使用问答对生成功能</p>
                <ConfigButton 
                  text="系统配置" 
                  type="default" 
                  className={styles.configButton} 
                />
              </div>
            }
            type="warning"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}


        <Upload.Dragger
          multiple
          fileList={fileList}
          onChange={handleFileUpload}
          beforeUpload={() => false}
          accept=".txt,.pdf,.docx,.doc,.md,.html"
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">
            支持 TXT, MD 格式文件，建议文件大小不超过10MB
          </p>
          <p className="ant-upload-hint">
            因为本系统不专注于文件格式转换，所以请上传纯文本文件，您可以在其他平台转换文件格式后上传。
          </p>
        </Upload.Dragger>

        <div className={styles.actionBar}>
          <Button
            type="primary"
            onClick={handleProcessFiles}
            disabled={fileList.length === 0 || isProcessing || !isConfigured}
            loading={isProcessing}
          >
            {isProcessing ? '处理中...' : '处理文件'}
          </Button>
        </div>
      </div>
    </Card>
  );

  const renderChunksContent = () => (
    <Card title="文本分块" className={styles.card}>
      <div className={styles.chunksInfo}>
        <p>
          系统已将文件内容分成了{chunks.length}个文本块，共{chunks.filter(c => c.selected).length}个块被选中用于生成问答对。
          您可以通过下方的复选框选择或取消某些块。
        </p>

        {/* 添加到分块预览页面的分块大小控制 */}
        <div className={styles.chunkSizeSlider}>
          <h4>文本块大小设置 ({chunkSize} 字符)</h4>
          <div className={styles.sliderContainer}>
            <div className={styles.sliderLabel}>较小块 (500)</div>
            <div className={styles.sliderMain}>
              <Slider
                min={500}
                max={3000}
                value={chunkSize}
                onChange={(value) => setChunkSize(value)}
                step={500}
                marks={{
                  500: '500',
                  1000: '1000',
                  2000: '2000',
                  3000: '3000'
                }}
                tooltip={{ formatter: (value) => `${value} 字符` }}
              />
            </div>
            <div className={styles.sliderLabel}>较大块 (3000)</div>
          </div>

          {/* 添加分割策略选择器 */}
          <div className={styles.splitterSelector}>
            <h4>分割策略(使用LangChain)</h4>
            <Radio.Group
              value={splitterType}
              onChange={(e) => setSplitterType(e.target.value)}
              options={[
                { label: '递归字符分割 (通用)', value: 'recursive' },
                { label: '代码分割 (针对程序代码)', value: 'code' },
                { label: 'Markdown分割', value: 'markdown' },
                { label: 'HTML分割', value: 'html' },
                // { label: 'LaTeX分割', value: 'latex' }
              ]}
              optionType="button"
              buttonStyle="solid"
            />
          </div>

          <div className={styles.sliderDescription}>
            <p>
              较小的文本块适合生成简单、聚焦的问题，较大的文本块适合生成复杂、综合性的问题。
              调整块大小和分割策略后点击"重新分块"按钮应用更改。
            </p>
          </div>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={handleRechunk}
            loading={isRechunking}
            style={{ marginTop: '8px' }}
          >
            重新分块
          </Button>
        </div>
      </div>

      <div className={styles.chunksList}>
        {chunks.map(chunk => (
          <Card
            key={chunk.id}
            size="small"
            className={`${styles.chunkCard} ${chunk.selected ? styles.chunkSelected : ''}`}
            onClick={() => showChunkModal(chunk)}
          >
            <div className={styles.chunkHeader}>
              <Checkbox
                checked={chunk.selected}
                onChange={(e) => {
                  e.stopPropagation(); // 防止触发卡片点击事件
                  handleChunkSelectionChange(chunk.id, e.target.checked);
                }}
              />
              <div className={styles.chunkInfo}>
                <span>ID: {chunk.id.substring(0, 6)}...</span>
                <span>{chunk.tokens} 字符</span>
                <span
                  style={{ cursor: 'pointer', color: '#1890ff' }}
                  onClick={(e) => {
                    e.stopPropagation(); // 防止触发卡片点击事件
                    showChunkModal(chunk);
                  }}
                >
                  <FullscreenOutlined /> 查看全文
                </span>
              </div>
            </div>
            <div
              className={`${styles.chunkContent} ${expandedChunks.has(chunk.id) ? styles.chunkContentExpanded : ''}`}
            >
              {chunk.content}
            </div>
            <div
              className={styles.viewMoreBtn}
              onClick={(e) => toggleChunkExpand(chunk.id, e)}
            >
              {expandedChunks.has(chunk.id) ? '收起' : '展开'}
            </div>
          </Card>
        ))}
      </div>

      <Form
        form={form}
        layout="horizontal"
        initialValues={{
          count: 3,
          difficulty: 'medium',
          questionTypes: ['factoid', 'conceptual'],
          maxTokens: 1000
        }}
      >
        <div className={styles.formGrid}>
          <Form.Item
            name="count"
            label="每块问题数量"
            rules={[{ required: true }]}
          >
            <InputNumber min={1} max={10} />
          </Form.Item>

          {/* <Form.Item
            name="difficulty"
            label="问题难度"
            rules={[{ required: true }]}
          >
            <Select>
              <Option value="easy">简单</Option>
              <Option value="medium">中等</Option>
              <Option value="hard">困难</Option>
              <Option value="mixed">混合</Option>
            </Select>
          </Form.Item> */}

          <Form.Item
            name="questionTypes"
            label="问题类型"
            rules={[{ required: true }]}
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
            label="回答最大长度(字符)"
            rules={[{ required: true }]}
          >
            <InputNumber min={50} max={1000} />
          </Form.Item>

          <Form.Item
            name="concurrency"
            label="并发请求数"
            rules={[{ required: true }]}
            initialValue={3}
            tooltip="同时处理的文本块数量，较高的值可能加快生成速度但会增加API调用的频率"
          >
            <InputNumber min={1} max={10} style={{ width: '100%' }} />
          </Form.Item>
        </div>
      </Form>

      {renderPromptTemplateEditor()}

      <div className={styles.actionBar}>
        <Button onClick={() => setCurrentTab('upload')}>
          返回上传
        </Button>
        <Button
          onClick={previewPrompt}
          icon={<EyeOutlined />}
        >
          预览提示词
        </Button>
        <Button
          type="primary"
          onClick={handleGenerateQA}
          disabled={chunks.filter(c => c.selected).length === 0}
        >
          开始生成
        </Button>
      </div>

      {/* 添加模态窗口显示完整内容 */}
      <Modal
        title="文本块详情"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="back" onClick={() => setModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        {currentChunk && (
          <>
            <div className={styles.modalHeader}>
              <h3>文本块 ID: {currentChunk.id}</h3>
              <div className={styles.modalInfo}>
                <span>字符数量: {currentChunk.tokens}</span>
                <span>来源文件: {questionGeneratorService.getChunkSourceFile(currentChunk.id) || '未知'}</span>
              </div>
            </div>
            <div className={styles.modalContent}>
              {currentChunk.content}
            </div>
          </>
        )}
      </Modal>
    </Card>
  );

  const renderGenerationContent = () => (
    <Card title="生成问答对" className={styles.card}>
      <div className={styles.progressCard}>
        <div className={styles.progressInfo}>
          <div>
            <div>文本块: {progress.completedChunks} / {progress.totalChunks}</div>
            <Progress
              percent={Math.round((progress.completedChunks / progress.totalChunks) * 100)}
              status={progress.error ? 'exception' : 'active'}
            />
          </div>

          <div>
            <div>问答对: {progress.generatedQAPairs} / {progress.totalQAPairs}</div>
            <Progress
              percent={Math.round((progress.generatedQAPairs / progress.totalQAPairs) * 100)}
              status={progress.error ? 'exception' : 'active'}
            />
          </div>
        </div>

        {progress.currentChunk && (
          <div className={styles.currentChunk}>
            <div>正在处理:</div>
            <div>{progress.currentChunk.content.substring(0, 100)}...</div>
          </div>
        )}

        {progress.error && (
          <Alert
            message="生成中出错（仍在继续生成中...）"
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

  // 处理查看原始响应的函数
  const handleViewRawResponse = (record: GeneratedQA) => {
    if (record.rawResponse) {
      setCurrentRawResponse(record.rawResponse);
      setRawResponseModalVisible(true);
    } else {
      message.info('没有可用的原始响应');
    }
  };
  
  // 查看失败记录列表
  const handleViewFailedRecords = () => {
    // 从服务获取失败记录列表
    const records = questionGeneratorService.getFailedRequests();
    setFailedRequests(records);
    setFailedRequestsModalVisible(true);
  };

  // 添加一个状态标记是否已加载失败记录
  const [failedRecordsLoaded, setFailedRecordsLoaded] = useState(false);
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // 在切换到结果页时加载失败记录
  useEffect(() => {
    if (currentTab === 'results' && !failedRecordsLoaded) {
      const records = questionGeneratorService.getFailedRequests();
      setFailedRequests(records);
      setFailedRecordsLoaded(true);
    }
  }, [currentTab, failedRecordsLoaded]);
  
  const renderResultsContent = () => {
    // 计算失败的问答对数量
    const failedQAsCount = failedRequests.length;
    const successQAsCount = generatedQAs.length;
    
    return (
    <Card title="生成结果" className={styles.card}>
      <div className={styles.resultSummary}>
        <div className={styles.statCard}>
          <FileTextOutlined className={styles.statIcon} />
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{chunks.filter(c => c.selected).length}</div>
            <div className={styles.statLabel}>处理的文本块</div>
          </div>
        </div>

        {/* 成功的问答对   */}
        { (
          <div className={styles.statCard} >
            <CheckCircleOutlined className={styles.statIcon} style={{ color: '#52c41a' }} />
            <div className={styles.statInfo}>
              <div className={styles.statValue}>{successQAsCount}</div>
              <div className={styles.statLabel}>
                成功的生成
              </div>
            </div>
          </div>
        )}

        
        { (
          <div className={styles.statCard} onClick={handleViewFailedRecords} style={{ cursor: 'pointer' }}>
            <CloseCircleOutlined className={styles.statIcon} style={{ color: '#ff4d4f' }} />
            <div className={styles.statInfo}>
              <div className={styles.statValue}>{failedQAsCount}</div>
              <div className={styles.statLabel}>失败的文本块</div>
              <div className={styles.viewDetails}>点击查看详情</div>
            </div>
          </div>
        )}

        {/* {progress.error && (
          <div className={styles.statCard}>
            <CloseCircleOutlined className={styles.statIcon} style={{ color: '#ff4d4f' }} />
            <div className={styles.statInfo}>
              <div className={styles.statValue}>错误</div>
              <div className={styles.statLabel}>{progress.error}</div>
            </div>
          </div>
        )} */}
      </div>

{/* TODO 生成后立即保存，目前不能删除所选 */}
      <div className={styles.tableHeader}>
        <div className={styles.tableActions}>
          {selectedQAKeys.length > 0 && (
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={handleDeleteSelectedQAs}
            >
              删除所选 ({selectedQAKeys.length})
            </Button>
          )}
        </div>
      </div>

      <Divider />

      <div className={styles.tableContainer}>
        <Table
          dataSource={generatedQAs}
          rowKey="id"
          // rowSelection={{
          //   selectedRowKeys: selectedQAKeys,
          //   onChange: handleQASelectChange
          // }}
          pagination={{ 
            current: currentPage,
            pageSize: pageSize,
            showTotal: (total, range) => `共 ${total} 条记录，当前显示 ${range[0]}-${range[1]} 条`,
            onChange: (page, pageSize) => {
              setCurrentPage(page);
              setPageSize(pageSize);
            }
          }}
          scroll={{ x: 1200, y: 400 }}
          rowClassName={(record) => record.status === 'failed' ? styles.failedRow : ''}
        >
          <Column
            title="序号"
            key="index"
            width={80}
            align="center"
            render={(_, __, index) => {
              // 使用React状态中的currentPage和pageSize
              // 计算全局序号
              return (currentPage - 1) * pageSize + index + 1;
            }}
          />

          <Column
            title="状态"
            key="status"
            width={80}
            render={(_, record: GeneratedQA) => (
              <span>
                {record.status === 'failed' ? (
                  <Tooltip title={record.errorReason || '生成失败'}>
                    <CloseCircleOutlined style={{ color: '#ff4d4f' }} /> 失败
                  </Tooltip>
                ) : (
                  <span>
                    <CheckCircleOutlined style={{ color: '#52c41a' }} /> 成功
                  </span>
                )}
              </span>
            )}
          />
          <Column
            title="问题"
            dataIndex="question"
            key="question"
            width={300}
            ellipsis={{ showTitle: false }}
            render={(text) => (
              <Tooltip placement="topLeft" title={text} overlayStyle={{ maxWidth: '600px' }}>
                <span>{text}</span>
              </Tooltip>
            )}
          />
          <Column
            title="回答"
            dataIndex="answer"
            key="answer"
            width={400}
            ellipsis={{ showTitle: false }}
            render={(text) => (
              <Tooltip placement="topLeft" title={text} overlayStyle={{ maxWidth: '600px' }}>
                <span>{text}</span>
              </Tooltip>
            )}
          />
          <Column
            title="难度"
            dataIndex="difficulty"
            key="difficulty"
            width={100}
            render={(text) => {
              const difficultyMap = {
                'easy': '简单',
                'medium': '中等',
                'hard': '困难'
              };
              return (difficultyMap as any)[text] || text;
            }}
          />
          <Column
            title="类别"
            dataIndex="category"
            key="category"
            width={100}
            render={(text) => {
              const categoryMap = {
                'factoid': '事实型',
                'conceptual': '概念型',
                'procedural': '程序型',
                'comparative': '比较型'
              };
              return (categoryMap as any)[text] || text;
            }}
          />
          <Column title="来源文件" dataIndex="sourceFileName" key="sourceFileName" width={150} ellipsis />
          
        </Table>
      </div>

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
  };

  return (
    <div className={styles.content}>
      {currentTab === 'upload' && renderUploadContent()}
      {currentTab === 'chunks' && renderChunksContent()}
      {currentTab === 'generate' && renderGenerationContent()}
      {currentTab === 'results' && renderResultsContent()}

      {/* 添加提示词预览模态窗口 */}
      <Modal
        title="提示词预览"
        open={promptModalVisible}
        onCancel={() => setPromptModalVisible(false)}
        footer={[
          <Button key="back" onClick={() => setPromptModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        <div className={styles.promptPreview}>
          <pre>{promptTemplate}</pre>
        </div>
      </Modal>
      
      {/* 添加查看原始响应模态窗口 */}
      <Modal
        title="大模型原始响应"
        open={rawResponseModalVisible}
        onCancel={() => setRawResponseModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setRawResponseModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        <div className={styles.rawResponsePreview}>
          <pre>{currentRawResponse}</pre>
        </div>
      </Modal>
      
      {/* 添加失败记录列表模态窗口 */}
      <Modal
        title={
          <div className={styles.failedRecordsHeader}>
            <WarningOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
            失败记录详情
            <span className={styles.failedRecordsCount}>
              (共 {failedRequests.length} 条)
            </span>
          </div>
        }
        open={failedRequestsModalVisible}
        onCancel={() => setFailedRequestsModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setFailedRequestsModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={900}
        bodyStyle={{ maxHeight: '70vh', overflow: 'auto' }}
      >
        {failedRequests.length > 0 ? (
          <div className={styles.failedRecordsList}>
            <Collapse accordion>
              {failedRequests.map((record, index) => (
                <Collapse.Panel 
                  key={record.id} 
                  header={
                    <div className={styles.failedRecordHeader}>
                      <Badge status="error" />
                      <span className={styles.failedRecordTitle}>
                        失败记录 #{index + 1}: {record.sourceFileName}
                      </span>
                      <span className={styles.failedRecordError}>
                        {record.errorMessage}
                      </span>
                      <span className={styles.failedRecordTime}>
                        {new Date(record.timestamp).toLocaleString()}
                      </span>
                    </div>
                  }
                >

                  

                  <div className={styles.failedRecordDetail}>
                    {record.chunkContent && (
                      <div >
                        <Typography.Title level={5}>文本块内容</Typography.Title>
                        <div   style={{ marginBottom: '16px', width: '100%', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',background: '#f5f5f5', borderRadius: '4px', padding: '8px' }}>
                          <pre>{record.chunkContent.slice(0, 100)} ...</pre>
                        </div>
                      </div>
                    )}

                    {/* <Typography.Title level={5}>请求提示词</Typography.Title>
                    <div className={styles.promptPreview}>
                      <pre>{record.promptText}</pre>
                    </div> */}
                    
                    <Divider />
                    
                    <Typography.Title level={5}>错误信息</Typography.Title>
                    <div className={styles.errorMessage}>
                      <Typography.Text type="danger">
                        {record.errorMessage}
                      </Typography.Text>
                    </div>
                    
                    {record.rawResponse && (
                      <>
                        <Divider />
                        <Typography.Title level={5}>原始响应</Typography.Title>
                        <div className={styles.rawResponsePreview}>
                          <pre>{record.rawResponse}</pre>
                        </div>
                      </>
                    )}
                  </div>
                </Collapse.Panel>
              ))}
            </Collapse>
          </div>
        ) : (
          <Empty 
            description="没有失败记录" 
            image={Empty.PRESENTED_IMAGE_SIMPLE} 
          />
        )}
      </Modal>
    </div>
  );
};

export default QuestionGenerationContent; 