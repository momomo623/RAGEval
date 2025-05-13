import { RagAnswer } from '../types/ragAnswer';
import { api } from '../utils/api';
import { performanceService } from './performance.service';
import { executeRAGRequest, RAGRequestConfig } from '../utils/ragUtils';
import { ConfigManager } from '../utils/configManager';
import { streamRAGResponse } from '../pages/Settings/RAGTemplates/rag-request';
import { message } from 'antd';

// 测试进度数据结构
export interface TestProgress {
  total: number;
  completed: number;
  success: number;
  failed: number;
  averageResponseTime?: number;
  remainingTimeEstimate?: number;
  startTime?: number;
  real_total?: number;
  elapsedTime?: number; // 新增：已花费的时间（毫秒）
}

// 单个测试结果数据结构
interface TestResult {
  questionId: string;
  success: boolean;
  firstResponseTime?: number;
  totalResponseTime?: number;
  characterCount?: number;
  charactersPerSecond?: number;
  errorDetails?: any;
  response?: string;
  version?: string;
  performance_test_id?: string;
  // retrievedDocs?: any[];
  sequenceNumber: number;
}

/**
 * 执行单个RAG请求并计时
 */
const executeRagRequest = async (question: any, test: any): Promise<TestResult> => {
  try {
    // 拆分rag_config
    if (!test.rag_config) {
      message.error('未配置RAG系统');
      return {
        questionId: question.id,
        success: false,
        errorDetails: { message: '未配置RAG系统' },
        sequenceNumber: question.sequence_number || 0
      };
    }
    const [type, name] = test.rag_config.split('/');
    const configManager = ConfigManager.getInstance();
    const ragConfig = await configManager.findRAGConfigByTypeAndName(type, name);
    if (!ragConfig) {
      message.error('未找到RAG配置，请检查系统设置');
      return {
        questionId: question.id,
        success: false,
        errorDetails: { message: '未找到RAG配置' },
        sequenceNumber: question.sequence_number || 0
      };
    }
    // 获取问题文本
    const questionText = question.question_text || question.text || question.content || question.question;
    if (!questionText) {
      throw new Error(`无法获取问题ID ${question.id} 的文本内容`);
    }
    // 性能统计
    const startTime = performance.now();
    let firstTokenTime: number | null = null;
    let totalChars = 0;
    let content = '';
    let lastChunkTime = startTime;

    for await (const chunk of streamRAGResponse(ragConfig, questionText)) {
      const currentTime = performance.now();
      if (firstTokenTime === null) {
        firstTokenTime = currentTime - startTime;
      }
      content += chunk;
      totalChars += chunk.length;
      lastChunkTime = currentTime;
    }
    const totalTime = lastChunkTime - startTime;
    
    return {
      questionId: question.id,
      success: true,
      firstResponseTime: firstTokenTime ? firstTokenTime / 1000 : 0, // 转换为秒
      totalResponseTime: totalTime / 1000, // 转换为秒
      characterCount: totalChars,
      charactersPerSecond: totalChars / (totalTime / 1000),
      response: content,
      version: question.version,
      performance_test_id: question.performance_test_id,
      sequenceNumber: question.sequence_number || 0
    };
  } catch (error) {
    message.error('RAG请求失败: ' + (error.message || '未知错误'));
    return {
      questionId: question.id,
      success: false,
      errorDetails: { message: error.message },
      sequenceNumber: question.sequence_number || 0
    };
  }
};

/**
 * 保存测试结果到后端
 */
const saveTestResult = async (test: any, result: TestResult): Promise<void> => {
  try {
    await api.post('/v1/rag-answers', {
      performance_test_id: test.id,
      question_id: result.questionId,
      first_response_time: result.firstResponseTime,
      total_response_time: result.totalResponseTime,
      character_count: result.characterCount,
      characters_per_second: result.charactersPerSecond,
      answer: result.response,
      version: test.version,
      // retrieved_documents: result.retrievedDocs,
      sequence_number: result.sequenceNumber,
      success: result.success,
      error_details: result.errorDetails
    });
  } catch (error) {
    console.error('保存测试结果失败:', error);
    // 测试本身的失败不应该因为保存失败而中断
  }
};

/**
 * 使用缓冲区管理器实现有限并发
 */
const executeWithBufferedQuestions = async (
  test: any,
  questionBuffer: QuestionBufferManager,
  progressCallback?: (progress: TestProgress) => void
): Promise<void> => {
  const results: TestResult[] = [];
  const startTime = performance.now();
  
  // 初始化进度对象
  const progress: TestProgress = {
    total: 0,
    completed: 0,
    success: 0,
    failed: 0,
    startTime: performance.now(),
    elapsedTime: 0,
    averageResponseTime: 0,
    remainingTimeEstimate: 0
  };
  
  // 更新进度的函数
  const updateProgress = (update: Partial<TestProgress>) => {
    Object.assign(progress, update);
    
    // 计算已用时间
    progress.elapsedTime = performance.now() - startTime;
    
    // 计算平均响应时间
    if (results.length > 0) {
      const successfulResults = results.filter(r => r.totalResponseTime);
      if (successfulResults.length > 0) {
        progress.averageResponseTime = successfulResults.reduce((sum, r) => sum + (r.totalResponseTime || 0), 0) / successfulResults.length;
      }
    }
    
    // 计算预计剩余时间
    if (progress.completed > 0 && progress.total > 0) {
      const avgTimePerItem = progress.elapsedTime / progress.completed;
      const remainingItems = progress.total - progress.completed;
      progress.remainingTimeEstimate = remainingItems * avgTimePerItem;
    }
    
    // 调用回调更新UI
    if (progressCallback) {
      progressCallback({...progress});
    }
  };

  // 设置问题缓冲区加载完成后的回调
  questionBuffer.onAllQuestionsLoaded = (totalCount: number) => {
    console.log(`已确认实际问题总数: ${totalCount}`);
    updateProgress({ total: totalCount });
  };

  let processedQuestionCount = 0;
  let activeRequests = 0;
  let allQuestionsProcessed = false;

  // 处理单个问题的函数
  const processQuestion = async (question: any): Promise<void> => {
    if (!question) return;
    
    try {
      const questionWithSeq = {
        ...question,
        sequence_number: ++processedQuestionCount
      };
      
      const result = await executeRagRequest(questionWithSeq, test);
      results.push(result);
      
      // 更新进度
      updateProgress({
        completed: processedQuestionCount,
        success: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      });
      
      // 保存结果到后端
      await saveTestResult(test, result);
      
    } catch (error) {
      console.error('处理问题失败:', error);
      updateProgress({
        completed: processedQuestionCount,
        failed: results.filter(r => !r.success).length + 1
      });
    }
  };
  
  // 使用Promise来控制测试完成
  return new Promise((resolve, reject) => {
    // 检查是否应该继续测试
    const shouldContinueTesting = () => {
      if (test.max_questions && processedQuestionCount >= test.max_questions) {
        return false;
      }
      
      return !allQuestionsProcessed;
    };
    
    // 创建工作线程，每个线程负责处理多个问题
    const worker = async () => {
      // 只要应该继续测试，就保持工作
      while (shouldContinueTesting()) {
        activeRequests++;
        
        try {
          // 获取下一个问题
          const question = questionBuffer.getNextQuestion();
          
          if (question) {
            // 如果有问题，处理它
            await processQuestion(question);
          } else if (!questionBuffer.hasMore()) {
            // 如果没有问题且没有更多数据可加载，标记完成
            allQuestionsProcessed = true;
            break;
          } else {
            // 如果暂时没有问题，但有更多可以加载，等待一段时间
            await new Promise(r => setTimeout(r, 500));
          }
        } finally {
          activeRequests--;
        }
      }
      
      // 检查是否所有工作都完成了
      if (activeRequests === 0 && (allQuestionsProcessed || 
          (test.max_questions && processedQuestionCount >= test.max_questions))) {
        // 所有任务完成，解析Promise
        resolve();
      }
    };
    
    // 启动指定数量的工作线程
    const workers = [];
    for (let i = 0; i < test.concurrency; i++) {
      workers.push(worker());
    }
    
    // 当所有工作线程停止工作且没有活动请求时，测试才真正完成
    Promise.all(workers).then(() => {
      if (activeRequests === 0) {
        resolve();
      }
    }).catch(reject);
  });
};

/**
 * 执行性能测试的主函数 - 使用缓冲区管理
 */
export const executePerformanceTest = async (
  test: any,
  questions: any[],
  progressCallback?: (progress: TestProgress) => void
): Promise<boolean> => {
  try {
    console.log('开始执行性能测试:', test);
    
    // 验证必要的测试数据
    if (!test.id) {
      throw new Error('测试ID缺失');
    }
    
    if (!test.dataset_id) {
      throw new Error('测试未关联数据集，无法获取问题');
    }
    
    // 用于保存和更新进度的对象
    const progressState = {
      total: 0,
      completed: 0,
      success: 0,
      failed: 0,
      startTime: performance.now(),
      real_total: 0
    };
    
    // 创建更新进度的内部函数
    const updateProgress = (update: Partial<TestProgress>) => {
      // 更新内部状态
      Object.assign(progressState, update);
      
      // 调用回调
      if (progressCallback) {
        progressCallback({...progressState});
      }
    };
    
    // 开始测试前通知后端
    await performanceService.start({ performance_test_id: test.id });
    
    // 获取RAG配置
    // const ragConfig = getRagConfig();
    // if (!ragConfig) {
    //   throw new Error('性能测试需要RAG系统配置，请先配置RAG系统');
    // }

    // 如果提供了问题列表，则使用老的并发方式
    if (questions && questions.length > 0) {
      console.log(`使用预加载的 ${questions.length} 个问题执行测试`);
      // 更新总数
      updateProgress({ total: questions.length });
      
      await executeWithConcurrencyLimit(
        test,
        questions,
        // ragConfig,
        (progress) => updateProgress(progress)
      );
    } else {
      console.log(`使用缓冲区管理器从数据集 ${test.dataset_id} 加载问题`);
      
      // 创建问题缓冲区管理器
      const questionBuffer = new QuestionBufferManager(
        test.dataset_id, 
        test.concurrency,
        (totalQuestions) => {
          console.log(`缓冲区加载的总问题数: ${totalQuestions}`);
          // 当所有问题加载完毕时更新总数
          updateProgress({ total: totalQuestions });
        }
      );
      
      // 先初始化，获取总问题数
      const totalQuestions = await questionBuffer.initialize();
      
      // 初始化进度对象，使用获取到的真实总数
      const progress: TestProgress = {
        total: totalQuestions,  // 使用真实总数初始化
        real_total: totalQuestions,
        completed: 0,
        success: 0,
        failed: 0,
        startTime: performance.now()
      };
      
      // 更新进度回调
      if (progressCallback) {
        progressCallback({...progress});
      }
      
      // 确保缓冲区至少加载了一个问题，否则抛出错误
      if (questionBuffer.getRemainingCount() === 0 && !questionBuffer.hasMore()) {
        throw new Error(`未能从数据集 ${test.dataset_id} 加载任何问题`);
      }
      
      console.log(`初始加载了 ${questionBuffer.getRemainingCount()} 个问题，开始执行测试`);
      
      // 设置初始总数为已加载的问题数
      updateProgress({ total: questionBuffer.getRemainingCount() });
      
      // 执行带缓冲区的测试
      await executeWithBufferedQuestions(
        test,
        questionBuffer,
        // ragConfig,
        (progress) => updateProgress(progress)
      );
    }
    
    console.log('测试执行完成，通知后端计算汇总指标');
    
    // 测试完成后通知后端计算汇总指标
    await performanceService.complete(test.id);
    
    return true;
  } catch (error) {
    console.error('执行性能测试失败:', error);
    
    // 向后端报告失败
    try {
      await performanceService.fail(test.id, {
        message: error.message,
        stack: error.stack
      });
    } catch (reportError) {
      console.error('报告测试失败状态失败:', reportError);
    }
    
    return false;
  }
};

// 添加批量加载和缓冲管理功能

// 定义问题缓冲区管理器
class QuestionBufferManager {
  private questions: any[] = [];
  private loading: boolean = false;
  private currentPage: number = 1;
  private pageSize: number = 100; // 可根据实际情况调整
  private datasetId: string;
  private concurrency: number;
  private bufferMultiplier: number = 5; // 缓冲区大小为并发数的倍数
  private onAllQuestionsLoaded?: (total: number) => void;
  private hasMoreData: boolean = true;
  
  constructor(datasetId: string, concurrency: number, onAllQuestionsLoaded?: (total: number) => void) {
    this.datasetId = datasetId;
    this.concurrency = concurrency;
    this.onAllQuestionsLoaded = onAllQuestionsLoaded;
    this.pageSize = Math.max(50, concurrency * 2); // 每页至少加载并发数的2倍
  }
  
  // 添加初始化方法，在开始加载问题前获取总数
  public async initialize(): Promise<number> {
    if (!this.datasetId) {
      console.error('缺少数据集ID，无法初始化');
      return 0;
    }
    
    try {
      // 只请求第一页但设置pageSize=1，目的是只获取总数而不加载太多数据
      const response = await api.get(`/api/v1/datasets-questions/${this.datasetId}/questions`, {
        params: {
          page: 1,
          size: 1  // 只获取一条记录，减少数据传输
        }
      });
      
      // 获取总问题数
      const totalCount = response.total || 0;
      console.log(`初始化：获取到数据集总问题数: ${totalCount}`);
      
      // 通知总数
      if (this.onAllQuestionsLoaded && totalCount > 0) {
        this.onAllQuestionsLoaded(totalCount);
      }
      
      return totalCount;
    } catch (error) {
      console.error('初始化获取问题总数失败:', error);
      return 0;
    }
  }
  
  // 获取下一个可用的问题
  getNextQuestion(): any | null {
    // 检查缓冲区是否需要补充
    this.checkAndLoadMore();
    
    // 返回缓冲区中的下一个问题
    if (this.questions.length > 0) {
      return this.questions.shift();
    }
    return null;
  }
  
  // 检查并预加载更多问题
  private async checkAndLoadMore(): void {
    // 当缓冲区中的问题数量低于阈值(并发数的2倍)且尚未开始加载更多且仍有更多数据时
    if (this.questions.length < this.concurrency * 2 && !this.loading && this.hasMoreData) {
      this.loadMoreQuestions();
    }
  }
  
  // 加载更多问题
  private async loadMoreQuestions(): Promise<void> {
    if (this.loading || !this.hasMoreData) return;
    
    this.loading = true;
    console.log(`正在加载更多问题，数据集ID: ${this.datasetId}, 当前页: ${this.currentPage}, 页大小: ${this.pageSize}`);
    
    try {
      // 检查datasetId是否存在
      if (!this.datasetId) {
        console.error('缺少数据集ID，无法加载问题');
        this.hasMoreData = false;
        return;
      }
      
      // 调整API路径，确保使用正确的端点格式
      const response = await api.get(`/api/v1/datasets-questions/${this.datasetId}/questions`, {
        params: {
          page: this.currentPage,
          size: this.pageSize
        }
      });
      
      // 添加详细日志，检查响应格式
      console.log('问题API响应:', response);
      
      // 提取问题数据
      let newQuestions = [];
      if (response && response.items) {
        // 根据响应结构提取问题列表
        newQuestions = response.items;
      }
      
      // 如果响应中包含total字段，更新real_total
      if (response && response.total !== undefined) {
        // 通知执行器更新实际问题总数
        if (this.onAllQuestionsLoaded) {
          this.onAllQuestionsLoaded(response.total);
        }
      }
      
      console.log(`获取到 ${newQuestions.length} 个新问题, 样例:`, newQuestions[0]);
      
      // 添加到缓冲区
      this.questions.push(...newQuestions);
      console.log(`缓冲区中的问题数: ${this.questions.length}`);
      
      // 检查是否还有更多数据
      this.hasMoreData = newQuestions.length >= this.pageSize;
      
      if (newQuestions.length === 0) {
        console.warn('API未返回任何问题，可能是API路径错误或数据集为空');
        this.tryAlternativeAPI();
      }
      
      // 更新页码
      this.currentPage++;
      
      // 如果已加载所有数据，通知调用者
      if (!this.hasMoreData && this.onAllQuestionsLoaded) {
        const totalQuestions = response.total || this.questions.length;
        console.log(`已加载所有问题，总数: ${totalQuestions}`);
        this.onAllQuestionsLoaded(totalQuestions);
      }
    } catch (error) {
      console.error('加载问题失败:', error);
    } finally {
      this.loading = false;
    }
  }
  
  // 尝试替代API路径
  private async tryAlternativeAPI(): Promise<void> {
    try {
      console.log('尝试替代API路径...');
      
      // 尝试其他可能的路径格式
      const path = `/v1/datasets-questions/${this.datasetId}/questions`
      
        try {
          console.log(`尝试API路径: ${path}`);
          const altResponse = await api.get(path, {
            params: { page: 1, page_size: this.pageSize }
          });
          
          if (altResponse?.data?.items?.length > 0 || 
              Array.isArray(altResponse?.data) && altResponse.data.length > 0 ||
              altResponse?.data?.questions?.length > 0) {
            
            console.log(`找到有效的API路径: ${path}`);
            return; // 成功找到有效路径
          }
        } catch (e) {
          console.log(`路径 ${path} 无效`);
        }
      
      console.error('无法找到有效的问题API路径');
    } catch (error) {
      console.error('替代API尝试失败:', error);
    }
  }
  
  // 获取缓冲区中剩余的问题数量
  getRemainingCount(): number {
    return this.questions.length;
  }
  
  // 是否还有更多数据可加载
  hasMore(): boolean {
    return this.hasMoreData;
  }
  
  // 重置缓冲区
  reset(): void {
    this.questions = [];
    this.currentPage = 1;
    this.hasMoreData = true;
    this.loading = false;
  }

  public async getNextQuestions(count: number): Promise<any[]> {
    // 确保缓冲区中有足够的问题
    if (this.questions.length < count && this.hasMoreData && !this.loading) {
      await this.loadMoreQuestions();
    }
    
    // 获取并从缓冲区中移除问题
    const result = this.questions.splice(0, count);
    
    // 打印日志查看问题对象结构
    if (result.length > 0) {
      console.log('从缓冲区获取的第一个问题对象:', JSON.stringify(result[0], null, 2));
    }
    
    // 如果缓冲区变得太小，异步加载更多
    if (this.questions.length < this.bufferThreshold && this.hasMoreData && !this.loading) {
      this.loadMoreQuestions().catch(error => {
        console.error('缓冲区问题加载失败:', error);
      });
    }
    
    return result;
  }
} 