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

// 定义分割策略类型
export type SplitterType = 'recursive' | 'code' | 'markdown' | 'html' | 'latex';

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

// 5. 原文依据:原文依据应该来源于原文，并不超过10个字
  

  // 默认提示词模板
  private defaultPromptTemplate = `你是一个专业的问答对生成专家。根据给定的文本，生成高质量的问答对。
文本内容: "{{text}}"

请根据上述文本生成{{count}}个问答对，问题难度为{{difficulty}}。
每个问答对包含以下内容：
1. 问题：清晰简洁，直接从文本内容出发
2. 答案：答案应该简明扼要，不要冗长，以最短的文字回答
3. 难度：easy/medium/hard
4. 类别：factoid（事实型）/conceptual（概念型）/procedural（程序型）/comparative（比较型）


请以JSON格式输出，格式如下：
[
  {
    "question": "问题内容",
    "answer": "答案内容",
    "difficulty": "难度级别",
    "category": "问题类别",
  }
]`;

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
    onProgress: (progress: ProgressInfo, newQAs?: GeneratedQA[]) => void
  ): Promise<GeneratedQA[]> {
    this.datasetId = datasetId;
    this.abortController = new AbortController();
    
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
      const processPromise = this.processChunk(chunk, params, llmConfig)
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
        });
      
      activePromises.push(processPromise);
      
      // 如果达到最大并发数，等待其中一个完成
      if (activePromises.length >= this.maxConcurrentRequests) {
        await Promise.race(activePromises).then(() => {
          // 移除已完成的Promise，这里不能用isFulfilled，改用Promise.race的结果
          activePromises = activePromises.filter(p => !p.isFulfilled && !p.isResolved);
        });
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
    llmConfig: any
  ): Promise<GeneratedQA[]> {
    try {
      // 构建提示词
      const prompt = this.buildPrompt(chunk.content, params);
      
      // 调用LLM API
      const response = await this.callLLMAPI(prompt, params, llmConfig);
      
      // 解析响应生成问答对
      const qaPairs = this.parseResponse(response, chunk.id);
      
      return qaPairs;
    } catch (error) {
      console.error(`处理分块 ${chunk.id} 失败:`, error);
      throw error;
    }
  }

  // 构建提示词
  private buildPrompt(text: string, params: GenerationParams): string {
    let prompt = this.defaultPromptTemplate;
    
    // 替换占位符
    prompt = prompt.replace('{{text}}', text);
    prompt = prompt.replace('{{count}}', params.count.toString());
    prompt = prompt.replace('{{difficulty}}', params.difficulty);
    
    return prompt;
  }

  // 调用LLM API
  private async callLLMAPI(prompt: string, params: GenerationParams, llmConfig: any): Promise<string> {
    const payload: LLMRequestPayload = {
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
      temperature: 0.7,
      max_tokens: 2000
    };

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${llmConfig.apiKey}`
    };

    try {
      const response = await fetch(`${llmConfig.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: this.abortController?.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API调用失败: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('请求已取消');
      }
      throw error;
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
      throw new Error(`解析响应失败: ${(error as Error).message}`);
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
      let codeLanguage: string | undefined;
      
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
}

// 导出单例实例
export const questionGeneratorService = new QuestionGeneratorService(); 