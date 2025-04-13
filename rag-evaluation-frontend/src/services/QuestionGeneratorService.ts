import { v4 as uuidv4 } from 'uuid';
import { 
  TextChunk, 
  GenerationParams, 
  GeneratedQA, 
  ProgressInfo,
  LLMRequestPayload
} from '../types/question-generator';
import { datasetService } from './dataset.service';

// 替换为新的导入路径
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
import OpenAI from 'openai';

// 定义分割策略类型
export type SplitterType = 'recursive' | 'code' | 'markdown' | 'html' | 'latex';

// 失败记录的详细信息类型
export interface FailedRequestRecord {
  id: string;
  chunkId: string;
  sourceFileName: string;
  timestamp: string;
  promptText: string; // 请求提示词
  errorMessage: string; // 错误信息
  rawResponse?: string; // 大模型原始响应（如果有）
  chunkContent?: string; // 失败的文本块内容
}

export class QuestionGeneratorService {
  private chunks: TextChunk[] = [];
  private generatedQAs: GeneratedQA[] = [];
  private progress: ProgressInfo = {
    totalChunks: 0,
    completedChunks: 0,
    totalQAPairs: 0,
    generatedQAPairs: 0,
    isCompleted: false
  };
  private abortController: AbortController | null = null;
  private processingPromises: Promise<any>[] = [];
  private maxConcurrentRequests = 3;
  private datasetId: string | null = null;
  private fileSourceMap: Map<string, string> = new Map(); // 用于存储分块ID和源文件名的映射
  private defaultChunkSize = 1000;
  private splitterType: SplitterType = 'recursive';
  
  // 失败记录列表
  private failedRequests: FailedRequestRecord[] = [];

// TODO 5. 原文依据:原文依据应该来源于原文，并不超过10个字
  

  // 默认提示词模板
  private defaultPromptTemplate = `你是一个专业的问答对生成专家，擅长根据文本生成多样性高、质量优的问答对。
请根据以下文本生成 {{count}} 个问答对：

文本内容：
"{{text}}"

### 生成要求：
1. **问题：** 
   - 问题要精准、清晰，直接基于文本内容，避免使用“本文”、“文中”、“文章中”等字眼。
   - 模拟用户提问的方式，问题应自然流畅，覆盖不同角度，包括细节、概念、流程、对比等。
2. **答案：**
   - 简明扼要，紧扣问题核心，不要超出文本信息。
3. **难度：**
   - 覆盖 简单、中等 和 困难 三个难度，难度层次合理分布。
4. **类别：**
   - 包括以下类别： 
     - 事实型：基于文本事实的信息
     - 概念型：解释或阐述某个概念
     - 程序型：涉及操作步骤或流程
     - 比较型：比较不同信息或观点

### 输出格式要求：
- 以 JSON 数组格式返回，格式如下：
\`\`\`json
[
  {
    "question": "问题内容",
    "answer": "答案内容",
    "difficulty": "简单/中等/困难",
    "category": "事实型/概念型/程序型/比较型"
  }
]
\`\`\`
请注意：
1. 确保问答对具有高质量、多样性，并严格按照指定格式输出。
2. category 字段必须从以下值中选择之一：事实型、概念型、程序型、比较型。
`;

  constructor() {
    this.resetState();
  }

  public resetState(): void {
    this.chunks = [];
    this.generatedQAs = [];
    this.progress = {
      totalChunks: 0,
      completedChunks: 0,
      totalQAPairs: 0,
      generatedQAPairs: 0,
      isCompleted: false
    };
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();
    this.processingPromises = [];
    this.fileSourceMap = new Map();
    // 重置失败记录
    this.failedRequests = [];
  }
  
  // 获取失败记录列表
  public getFailedRequests(): FailedRequestRecord[] {
    return this.failedRequests;
  }

  // 处理和分析上传的文件
  public async processFiles(files: File[], chunkSize?: number): Promise<TextChunk[]> {
    this.resetState();
    const textContents: {content: string, fileName: string}[] = [];
    
    // 使用传入的chunkSize或默认值
    const targetChunkSize = chunkSize || this.defaultChunkSize;

    // 读取所有文件内容
    for (const file of files) {
      const content = await this.readFileContent(file);
      textContents.push({
        content,
        fileName: file.name
      });
    }

    // 处理每个文件并保留文件名信息
    for (const {content, fileName} of textContents) {
      // 传递目标块大小
      const fileChunks = this.splitTextIntoChunks(content, fileName, targetChunkSize);
      this.chunks.push(...fileChunks);
    }
    
    this.progress.totalChunks = this.chunks.filter(chunk => chunk.selected).length;
    
    return this.chunks;
  }

  // 读取文件内容
  private async readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as string);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error(`Error reading file: ${file.name}`));
      };
      
      // 根据文件类型处理
      if (file.type === 'application/pdf') {
        // 实际项目中应该使用PDF解析库
        // 这里简化处理，假设PDF被读作文本
        reader.readAsText(file);
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        // 实际项目中应该使用DOCX解析库
        // 这里简化处理，假设DOCX被读作文本
        reader.readAsText(file);
      } else {
        // 对于文本文件直接读取
        reader.readAsText(file);
      }
    });
  }

  // 文本分块
  private splitTextIntoChunks(text: string, fileName: string, targetChunkSize: number): TextChunk[] {
    // 基本的分块策略，按段落分割并合并到合适大小
    const paragraphs = text.split(/\n\s*\n/);
    console.log(`分块: ${fileName}, 共 ${paragraphs.length} 个段落, 目标大小: ${targetChunkSize} 字符`);
    
    const chunks: TextChunk[] = [];
    
    let currentChunk = '';
    let currentTokens = 0;
    
    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) continue;
      
      // 估算段落的token数
      const paragraphTokens = this.calculateCharCount(paragraph);
      
      if (currentTokens + paragraphTokens > targetChunkSize && currentChunk !== '') {
        // 创建新块
        const chunkId = uuidv4();
        chunks.push({
          id: chunkId,
          content: currentChunk,
          tokens: currentTokens,
          selected: true
        });
        this.fileSourceMap.set(chunkId, fileName);
        
        currentChunk = paragraph;
        currentTokens = paragraphTokens;
      } else {
        // 添加到当前块
        if (currentChunk !== '') {
          currentChunk += '\n\n';
        }
        currentChunk += paragraph;
        currentTokens += paragraphTokens;
      }
    }
    
    // 添加最后一个块
    if (currentChunk !== '') {
      const chunkId = uuidv4();
      chunks.push({
        id: chunkId,
        content: currentChunk,
        tokens: currentTokens,
        selected: true
      });
      this.fileSourceMap.set(chunkId, fileName);
    }
    
    console.log(`${fileName} 分块完成，共 ${chunks.length} 个块`);
    return chunks;
  }

  // 更新块的选择状态
  public updateChunkSelection(chunkId: string, selected: boolean): void {
    const chunk = this.chunks.find(c => c.id === chunkId);
    if (chunk) {
      chunk.selected = selected;
      this.progress.totalChunks = this.chunks.filter(c => c.selected).length;
    }
  }

  // 生成问答对
  public async generateQAPairs(
    params: GenerationParams, 
    datasetId: string,
    llmConfig: any, 
    onProgress: (progress: ProgressInfo, newQAs?: GeneratedQA[]) => void,
    customPromptTemplate?: string
  ): Promise<GeneratedQA[]> {
    this.datasetId = datasetId;
    this.abortController = new AbortController();
    
    // 设置并发数
    if (params.concurrency && params.concurrency > 0) {
      this.maxConcurrentRequests = params.concurrency;
      console.log(`设置并发请求数为: ${this.maxConcurrentRequests}`);
    }
    
    // 计算总共需要生成的问答对数量
    const selectedChunks = this.chunks.filter(chunk => chunk.selected);
    this.progress.totalChunks = selectedChunks.length;
    this.progress.totalQAPairs = selectedChunks.length * params.count;
    this.progress.completedChunks = 0;
    this.progress.generatedQAPairs = 0;
    this.progress.isCompleted = false;
    
    onProgress({...this.progress});
    
    // 设置并发处理队列
    let activePromises: Promise<any>[] = [];
    this.generatedQAs = [];

    for (const chunk of selectedChunks) {
      // 如果已中止，停止处理
      if (this.abortController.signal.aborted) {
        break;
      }
      
      this.progress.currentChunk = chunk;
      onProgress({...this.progress});
      
      // 创建当前块的处理Promise
      const processPromise = this.processChunk(chunk, params, llmConfig, customPromptTemplate)
        .then(qaPairs => {
          // 更新进度
          this.progress.completedChunks++;
          this.progress.generatedQAPairs += qaPairs.length;
          this.progress.currentChunk = undefined;
          
          // 将生成的问答对添加到结果中
          this.generatedQAs.push(...qaPairs);
          
          // 回调，传递进度和新生成的问答对
          onProgress({...this.progress}, qaPairs);
          
          // 如果是增量保存，这里可以调用保存API
          if (this.datasetId) {
            this.saveQAPairsBatch(qaPairs, this.datasetId);
          }
          
          return qaPairs;
        })
        .catch(error => {
          console.error('处理分块时出错:', error);
          this.progress.error = `处理分块时出错: ${error.message}`;
          this.progress.completedChunks++;
          onProgress({...this.progress});  
          // // 创建失败的问答对记录（简化版本，只用于表格显示）
          // const sourceFileName = this.fileSourceMap.get(chunk.id) || '未知文件';
          // const failedQA: GeneratedQA = {
          //   id: uuidv4(),
          //   question: '生成失败',
          //   answer: '生成失败',
          //   difficulty: 'medium',
          //   category: 'factoid',
          //   sourceChunkId: chunk.id,
          //   sourceFileName: sourceFileName,
          //   status: 'failed',
          //   errorReason: error.message
          // };
          
          // // 将失败记录添加到结果中
          // this.generatedQAs.push(failedQA);
          
          // // 回调，传递进度和新生成的问答对（包括失败记录）
          // onProgress({...this.progress}, [failedQA]);
        });
      
      activePromises.push(processPromise);
      
      // 如果达到最大并发数，等待其中一个完成
      if (activePromises.length >= this.maxConcurrentRequests) {
        let completedPromiseIndex: number | null = null;
        
        await Promise.race(activePromises)
          .then(() => {
            // 一旦有Promise完成，我们只需要从列表中移除它
            // 简化处理：移除第一个已完成的Promise
            completedPromiseIndex = 0;
          });
        
        // 移除一个已完成的Promise
        if (completedPromiseIndex !== null) {
          activePromises.splice(completedPromiseIndex, 1);
        }
      }
    }
    
    // 等待所有剩余的处理完成
    await Promise.all(activePromises);
    
    // 标记为完成
    this.progress.isCompleted = true;
    onProgress({...this.progress});
    
    return this.generatedQAs;
  }

  // 处理单个文本块
  private async processChunk(
    chunk: TextChunk, 
    params: GenerationParams, 
    llmConfig: any,
    customPromptTemplate?: string
  ): Promise<GeneratedQA[]> {
    // 构建提示词，传入自定义模板
    const prompt = this.buildPrompt(chunk.content, params, customPromptTemplate);

    try {
      // 调用LLM API
      const response = await this.callLLMAPI(prompt, params, llmConfig);
      
      // 解析响应生成问答对
      const qaPairs = this.parseResponse(response, chunk.id);
      
      return qaPairs;
    } catch (error) {
      console.error(`处理分块 ${chunk.id} 失败:`, error);
      console.error('处理分块失败:', error);

      
      // 记录失败详情
      const sourceFileName = this.fileSourceMap.get(chunk.id) || '未知文件';
      
      // 创建失败记录
      const failedRecord: FailedRequestRecord = {
        id: uuidv4(),
        chunkId: chunk.id,
        sourceFileName,
        timestamp: new Date().toISOString(),
        promptText: prompt,
        errorMessage: error.message,
        chunkContent: chunk.content,
        rawResponse: error.rawResponse || '',
        
      };

      console.log('失败记录:', failedRecord);
      
      // 添加到失败记录列表
      this.failedRequests.push(failedRecord);
      
      throw error;
    }
  }

  // 构建提示词
  private buildPrompt(text: string, params: GenerationParams, customTemplate?: string): string {
    let prompt = customTemplate || this.defaultPromptTemplate;
    
    // 替换占位符
    prompt = prompt.replace(/\{\{text\}\}/g, text);
    prompt = prompt.replace(/\{\{count\}\}/g, params.count.toString());
    
    // 如果是使用默认模板，还需处理其他替换
    if (!customTemplate) {
      prompt = prompt.replace(/\{\{difficulty\}\}/g, params.difficulty);
      
      // 添加对问题类型的处理
      if (params.questionTypes && params.questionTypes.length > 0) {
        // 构建类别描述（使用中文类别）
        const categoryMap: Record<string, string> = {
          'factoid': '事实型：基于文本事实的信息',
          'conceptual': '概念型：解释或阐述某个概念',
          'procedural': '程序型：涉及操作步骤或流程',
          'comparative': '比较型：比较不同信息或观点'
        };
        
        // 根据用户选择的类型过滤
        const selectedCategories = params.questionTypes
          .map(type => categoryMap[type])
          .filter(Boolean);
        
        // 如果用户有选择类型，替换模板中的类别部分
        if (selectedCategories.length > 0) {
          // 使用正则表达式替换类别部分
          prompt = prompt.replace(
            /4\. \*\*类别：\*\*\s*- 包括以下类别：\s*([\s\S]*?)(?=\n\n|\n###)/m,
            `4. **类别：**\n   - 仅包括以下用户选择的类别：\n     - ${selectedCategories.join('\n     - ')}`
          );
          
          // 修改输出格式要求中的category说明
          const categoryValueMap: Record<string, string> = {
            'factoid': '事实型',
            'conceptual': '概念型',
            'procedural': '程序型',
            'comparative': '比较型'
          };
          
          const categoryValues = params.questionTypes
            .map(type => categoryValueMap[type])
            .filter(Boolean)
            .join('/');
          
          // 替换输出格式中的category部分
          prompt = prompt.replace(
            /"category": "事实型\/概念型\/程序型\/比较型"/,
            `"category": "${categoryValues}"`
          );
          
          // 更新注意事项中的category说明
          const categoryMapping = params.questionTypes
            .map(type => `${categoryValueMap[type]}`)
            .join('、');
          
          prompt = prompt.replace(
            /2\. category 字段必须从以下值中选择之一：事实型、概念型、程序型、比较型。/,
            `2. category 字段必须从以下值中选择之一：${categoryMapping}。`
          );
        }
      }
    }
    
    return prompt;
  }

  // 调用LLM API
  private async callLLMAPI(prompt: string, params: GenerationParams, llmConfig: any): Promise<string> {
    try {
      // 创建OpenAI客户端
      const openai = new OpenAI({
        apiKey: llmConfig.apiKey,
        baseURL: llmConfig.baseUrl,
        dangerouslyAllowBrowser: true // 在浏览器中使用
      });

      // 准备请求体
      const requestBody = {
        model: llmConfig.modelName,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant specialized in generating high-quality question-answer pairs.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: params.maxTokens || 1000
      };

      // 调用LLM API
      const completion = await openai.chat.completions.create(requestBody);

      return completion.choices[0].message.content;
    } catch (error: any) {
      // 增强错误处理，保存更多错误信息
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('请求已取消');
      }
      
      // 捕获更多错误信息
      const enhancedError: any = new Error(`API调用失败: ${error.message}`);
      enhancedError.status = error.status || error.statusCode;
      enhancedError.statusText = error.statusText;
      enhancedError.headers = error.headers;
      enhancedError.requestBody = {
        model: llmConfig.modelName,
        messages: [...requestBody.messages],
        temperature: requestBody.temperature,
        max_tokens: requestBody.max_tokens
      };
      
      // 如果有原始响应体，添加到错误对象
      if (error.response) {
        try {
          enhancedError.responseBody = typeof error.response === 'string' 
            ? JSON.parse(error.response) 
            : error.response;
        } catch {
          enhancedError.responseBody = error.response;
        }
      }
      
      throw enhancedError;
    }
  }

  // 解析LLM响应
  private parseResponse(response: string, chunkId: string): GeneratedQA[] {
    try {
      // 尝试提取JSON部分
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      
      if (!jsonMatch) {
        throw new Error('无法从响应中提取JSON格式的问答对');
      }
      
      const qaPairsData = JSON.parse(jsonMatch[0]);
      
      // 获取文件名
      const sourceFileName = this.fileSourceMap.get(chunkId) || '未知文件';
      
      // 验证并转换为标准格式
      const qaPairs: GeneratedQA[] = qaPairsData.map((item: any) => ({
        id: uuidv4(),
        question: item.question,
        answer: item.answer,
        difficulty: item.difficulty || 'medium',
        category: item.category || 'factoid',
        sourceChunkId: chunkId,
        sourceFileName: sourceFileName
      }));
      
      return qaPairs;
    } catch (error) {
      console.error('解析LLM响应失败:', error, 'Response:', response);
      const errorInfo = {
        // 原始响应
        rawResponse: response,
        // 错误信息
        message: '解析响应失败: ' + (error as Error).message
      };
      
      throw errorInfo;
    }
  }

  // 保存问答对到后端
  private async saveQAPairsBatch(qaPairs: GeneratedQA[], datasetId: string): Promise<void> {
    try {
      // 转换为后端API需要的格式
      const questions = qaPairs.map(qa => ({
        question_text: qa.question,
        standard_answer: qa.answer,
        category: qa.category,
        difficulty: qa.difficulty,
        type: qa.category,
        tags: [],
        question_metadata: {
          source_chunk_id: qa.sourceChunkId,
          source_file_name: qa.sourceFileName,
          generated_by: "auto_qa_generator"
        }
      }));
      
      // 调用后端API保存
      await datasetService.batchCreateQuestions(datasetId, questions);
    } catch (error) {
      console.error('保存问答对失败:', error);
      // 如果失败，可以考虑添加重试逻辑
    }
  }

  // 中止生成过程
  public stopGeneration(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.progress.error = '生成已手动停止';
      this.progress.isCompleted = true;
    }
  }

  // 修改方法名和实现
  private calculateCharCount(text: string): number {
    // 直接返回字符数而不是token数
    return text.length;
  }

  // 将原来的estimateTokenCount方法使用新方法替代
  private estimateTokenCount(text: string): number {
    return this.calculateCharCount(text);
  }

  // 设置分割策略
  public setSplitterType(type: SplitterType): void {
    this.splitterType = type;
    console.log(`分割策略已设置为: ${type}`);
  }
  
  // 获取当前分割策略
  public getSplitterType(): SplitterType {
    return this.splitterType;
  }
  
  // 使用LangChain文本分割器处理文本
  private async splitTextWithLangChain(text: string, fileName: string, targetChunkSize: number): Promise<TextChunk[]> {
    console.log(`使用LangChain分割文本，策略: ${this.splitterType}, 目标大小: ${targetChunkSize} 字符`);
    
    let splitter;
    let docs: Document[] = [];
    
    try {
      // 根据文件名判断文件类型，用于代码分割器
      const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
      
      // 定义支持的语言类型，与 RecursiveCharacterTextSplitter.fromLanguage 匹配
      type SupportedLanguage = 'markdown' | 'html' | 'latex' | 'go' | 'ruby' | 'js' | 'python' | 'java' | 'cpp' | 'php' | 'proto' | 'rst' | 'rust' | 'scala' | 'swift' | 'sol';
      
      let codeLanguage: SupportedLanguage | undefined;
      
      // 根据文件扩展名映射到代码语言
      switch (fileExtension) {
        case 'js':
        case 'jsx':
          codeLanguage = 'js';
          break;
        case 'ts':
        case 'tsx':
          codeLanguage = 'js'; // 使用js分割器处理TypeScript
          break;
        case 'py':
          codeLanguage = 'python';
          break;
        case 'java':
          codeLanguage = 'java';
          break;
        case 'html':
          codeLanguage = 'html';
          break;
        case 'md':
          codeLanguage = 'markdown';
          break;
        case 'tex':
          codeLanguage = 'latex';
          break;
        // 可以根据需要添加更多映射
      }
      
      // 根据设置的分割策略创建分割器
      switch (this.splitterType) {
        case 'code':
          if (codeLanguage) {
            // 如果文件扩展名映射到了支持的代码语言，使用代码分割器
            splitter = RecursiveCharacterTextSplitter.fromLanguage(codeLanguage, {
              chunkSize: targetChunkSize,
              chunkOverlap: Math.min(Math.floor(targetChunkSize * 0.1), 100)
            });
          } else {
            // 否则使用通用递归分割器
            splitter = new RecursiveCharacterTextSplitter({
              chunkSize: targetChunkSize,
              chunkOverlap: Math.min(Math.floor(targetChunkSize * 0.1), 100)
            });
          }
          break;
        case 'markdown':
          splitter = RecursiveCharacterTextSplitter.fromLanguage('markdown', {
            chunkSize: targetChunkSize,
            chunkOverlap: Math.min(Math.floor(targetChunkSize * 0.1), 100)
          });
          break;
        case 'html':
          splitter = RecursiveCharacterTextSplitter.fromLanguage('html', {
            chunkSize: targetChunkSize,
            chunkOverlap: Math.min(Math.floor(targetChunkSize * 0.1), 100)
          });
          break;
        case 'latex':
          splitter = RecursiveCharacterTextSplitter.fromLanguage('latex', {
            chunkSize: targetChunkSize,
            chunkOverlap: Math.min(Math.floor(targetChunkSize * 0.1), 100)
          });
          break;
        case 'recursive':
        default:
          // 默认使用递归字符分割器
          splitter = new RecursiveCharacterTextSplitter({
            chunkSize: targetChunkSize,
            chunkOverlap: Math.min(Math.floor(targetChunkSize * 0.1), 100)
          });
          break;
      }
      
      // 使用LangChain分割文本
      docs = await splitter.createDocuments([text]);
      console.log(`LangChain分割完成，共 ${docs.length} 个块`);
      
    } catch (error) {
      console.error('LangChain分割文本出错:', error);
      // 如果LangChain分割失败，回退到原来的分割方法
      console.log('回退到基础分割方法');
      return this.legacySplitTextIntoChunks(text, fileName, targetChunkSize);
    }
    
    // 将LangChain文档转换为我们的TextChunk格式
    const chunks: TextChunk[] = [];
    for (const doc of docs) {
      const content = doc.pageContent;
      if (!content.trim()) continue;
      
      const chunkId = uuidv4();
      // 使用字符数
      const charCount = this.calculateCharCount(content);
      
      chunks.push({
        id: chunkId,
        content: content,
        tokens: charCount, // 这里仍使用tokens字段但实际是字符数
        selected: true
      });
      
      // 保存源文件信息
      this.fileSourceMap.set(chunkId, fileName);
    }
    
    return chunks;
  }
  
  // 原来的分割方法保留为备用
  private legacySplitTextIntoChunks(text: string, fileName: string, targetChunkSize: number): TextChunk[] {
    // 原来的分块实现
    const paragraphs = text.split(/\n\s*\n/);
    console.log(`原始分块: ${fileName}, 共 ${paragraphs.length} 个段落, 目标大小: ${targetChunkSize} 字符`);
    
    const chunks: TextChunk[] = [];
    
    let currentChunk = '';
    let currentTokens = 0;
    
    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) continue;
      
      // 估算段落的token数
      const paragraphTokens = this.calculateCharCount(paragraph);
      
      if (currentTokens + paragraphTokens > targetChunkSize && currentChunk !== '') {
        // 创建新块
        const chunkId = uuidv4();
        chunks.push({
          id: chunkId,
          content: currentChunk,
          tokens: currentTokens,
          selected: true
        });
        this.fileSourceMap.set(chunkId, fileName);
        
        currentChunk = paragraph;
        currentTokens = paragraphTokens;
      } else {
        // 添加到当前块
        if (currentChunk !== '') {
          currentChunk += '\n\n';
        }
        currentChunk += paragraph;
        currentTokens += paragraphTokens;
      }
    }
    
    // 添加最后一个块
    if (currentChunk !== '') {
      const chunkId = uuidv4();
      chunks.push({
        id: chunkId,
        content: currentChunk,
        tokens: currentTokens,
        selected: true
      });
      this.fileSourceMap.set(chunkId, fileName);
    }
    
    console.log(`${fileName} 分块完成，共 ${chunks.length} 个块`);
    return chunks;
  }
  
  // 修改处理文本内容的方法，使用新的分割器
  public async processContentFiles(contentFiles: {name: string, content: string}[], chunkSize?: number, splitterType?: SplitterType): Promise<TextChunk[]> {
    this.resetState();
    
    // 设置分割策略（如果提供）
    if (splitterType) {
      this.setSplitterType(splitterType);
    }
    
    // 使用传入的chunkSize或默认值
    const targetChunkSize = chunkSize || this.defaultChunkSize;
    console.log(`处理文本内容，使用块大小: ${targetChunkSize} 字符, 分割策略: ${this.splitterType}`);
    
    // 处理每个文件并保留文件名信息
    for (const {content, name} of contentFiles) {
      // 传递目标块大小，使用LangChain分割器
      console.log(`处理文件: ${name}, 内容大小: ${content.length} 字符`);
      const fileChunks = await this.splitTextWithLangChain(content, name, targetChunkSize);
      console.log(`文件 ${name} 生成了 ${fileChunks.length} 个块`);
      this.chunks.push(...fileChunks);
    }
    
    this.progress.totalChunks = this.chunks.filter(chunk => chunk.selected).length;
    
    return this.chunks;
  }

  // 添加获取块源文件的方法
  public getChunkSourceFile(chunkId: string): string | undefined {
    return this.fileSourceMap.get(chunkId);
  }

  // 添加公共方法用于预览提示词
  public previewPrompt(text: string, params: GenerationParams, customTemplate?: string): string {
    return this.buildPrompt(text, params, customTemplate);
  }

  // 添加获取默认提示词模板的方法
  public getDefaultPromptTemplate(): string {
    return this.defaultPromptTemplate;
  }
}

// 导出单例实例
export const questionGeneratorService = new QuestionGeneratorService(); 