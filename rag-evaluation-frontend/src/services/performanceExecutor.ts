import { RagAnswer } from '../types/ragAnswer';
import { api } from '../utils/api';
import { performanceService } from './performance.service';
import { executeRAGRequest, RAGRequestConfig } from '../utils/ragUtils';

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
 * 获取RAG配置项
 * 从localStorage直接获取，因为服务文件不能使用React hooks
 */
const getRagConfig = (): RAGRequestConfig | null => {
  const RAG_CONFIG_KEY = 'rag_eval_rag_config';
  const configStr = localStorage.getItem(RAG_CONFIG_KEY);
  console.log('RAG配置字符串:', configStr);
  
  if (!configStr) return null;
  
  try {
    const config = JSON.parse(configStr);
    console.log('解析后的RAG配置:', config);
    
    return {
      url: config.url,
      headers: JSON.parse(config.requestHeaders || '{}'),
      requestTemplate: JSON.parse(config.requestTemplate || '{}'),
      responsePath: config.responsePath || '',
      isStream: config.isStream || false,
      streamEventField: config.streamEventField,
      streamEventValue: config.streamEventValue,
      retrieverPath: config.retrieverPath || ''
    };
  } catch (error) {
    console.error('RAG配置解析错误:', error);
    return null;
  }
};

/**
 * 执行单个RAG请求并计时
 */
const executeRagRequest = async (question: any, ragConfig: RAGRequestConfig): Promise<TestResult> => {
  console.log('准备向RAG系统发送问题:', question);
  
  try {
    const startTime = performance.now();
    let firstResponseTime: number | null = null;
    
    // 检查问题对象是否有效
    if (!question) {
      throw new Error('问题对象为空');
    }
    
    // 获取问题文本 - 修复这里，确保正确获取问题文本
    // 根据后端数据结构，问题文本可能在 question_text, text, content 或 question 字段
    const questionText = question.question_text || question.text || question.content || question.question;
    
    // 输出调试信息，帮助诊断
    console.log('问题对象结构:', JSON.stringify(question, null, 2));
    console.log('提取的问题文本:', questionText);
    
    if (!questionText) {
      console.warn('无法从问题对象中提取文本，使用问题ID作为备用:', question.id);
      // 如果仍然无法获取文本，使用问题ID或抛出错误
      throw new Error(`无法获取问题ID ${question.id} 的文本内容`);
    }
    
    // 构建请求参数，确保query字段使用正确的问题文本
    const requestParams = {
      inputs: { query: questionText },  // 修复：使用问题文本而不是可能undefined的字段
      response_mode: ragConfig.streamingEnabled ? "streaming" : "blocking",
      user: `user-${Math.random().toString(36).substring(2, 8)}`
    };
    
    console.log('发送给RAG系统的请求参数:', requestParams);
    
    // 使用通用函数执行请求
    const result = await executeRAGRequest(questionText, ragConfig);
    console.log('执行RAG请求结果:', result);
    console.log('执行RAG请求问题:', question);
    
    // 根据执行结果构建测试结果
    if (result.success) {
      return {
        questionId: question.id,
        success: true,
        firstResponseTime: result.firstResponseTime,
        totalResponseTime: result.totalResponseTime,
        characterCount: result.characterCount,
        charactersPerSecond: result.charactersPerSecond,
        response: result.content,
        version: question.version,
        performance_test_id: question.performance_test_id,
        // retrievedDocs: result.retrievedDocs || [],
        sequenceNumber: question.sequence_number || 0
      };
    } else {
      throw result.error || new Error('请求失败');
    }
  } catch (error) {
    console.error('执行RAG请求失败:', error);
    
    // 返回失败结果
    return {
      questionId: question.id,
      success: false,
      errorDetails: {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      },
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
  ragConfig: RAGRequestConfig,
  progressCallback?: (progress: TestProgress) => void
): Promise<void> => {
  const results: TestResult[] = [];
  const startTime = performance.now();
  
  // 初始化进度对象 - 此时使用从初始化函数获取的总数
  const progress: TestProgress = {
    total: test.questionCount || 0,  // 使用测试设置的问题数或默认为0
    completed: 0,
    success: 0,
    failed: 0,
    startTime: performance.now()
  };
  
  // 设置问题缓冲区加载完成后的回调，更新real_total
  questionBuffer.onAllQuestionsLoaded = (totalCount: number) => {
    console.log(`已确认实际问题总数: ${totalCount}`);
    
    // 只有当获取到的总数大于当前设置的总数时才更新
    if (totalCount > progress.total) {
      console.log(`更新总问题数: ${progress.total} -> ${totalCount}`);
      progress.real_total = totalCount;
      progress.total = totalCount;
      
      if (progressCallback) {
        progressCallback({...progress});
      }
    }
  };
  
  let processedQuestionCount = 0;
  let activeRequests = 0;  // 跟踪活动请求数量
  let allQuestionsProcessed = false;  // 标记是否所有问题都已处理
  
  // 处理单个问题的函数
  const processQuestion = async (question: any): Promise<void> => {
    if (!question) {
      console.error('收到空问题对象，跳过处理');
      return;
    }
    
    try {
      // 添加日志，查看问题结构
      console.log('处理问题:', JSON.stringify(question, null, 2));
      
      // 添加序列号
      const questionWithSeq = {
        ...question,
        sequence_number: ++processedQuestionCount
      };
      
      // 确保问题对象含有必要的字段
      if (!questionWithSeq.id) {
        console.warn('问题对象缺少ID字段');
      }
      
      if (!questionWithSeq.question_text && !questionWithSeq.text && !questionWithSeq.content) {
        console.warn('问题对象缺少文本内容字段');
      }
      
      // 执行RAG请求
      const result = await executeRagRequest(questionWithSeq, ragConfig);
      
      // 保存结果到后端
      await saveTestResult(test, result);
      
      // 更新进度，保留现有total值
      progress.completed++;
      if (result.success) {
        progress.success++;
      } else {
        progress.failed++;
      }
      
      // 计算性能指标
      if (result.totalResponseTime) {
        const successfulResults = results.filter(r => r.totalResponseTime);
        const totalTimes = successfulResults.map(r => r.totalResponseTime || 0);
        totalTimes.push(result.totalResponseTime);
        progress.averageResponseTime = totalTimes.reduce((a, b) => a + b, 0) / totalTimes.length;
        
        // 修改时间预估计算方式
        if (progress.total > 0 && progress.completed > 0) {
          const elapsedTimeMs = performance.now() - startTime;
          
          // 确保已用时间计算正确
          progress.elapsedTime = elapsedTimeMs;
          
          // 更准确地计算平均每项所需时间和剩余时间
          const avgTimePerItem = elapsedTimeMs / progress.completed;
          const remainingItems = progress.total - progress.completed;
          
          // 更科学的预估，考虑已处理项目的实际耗时
          progress.remainingTimeEstimate = remainingItems * avgTimePerItem;
          
          // 调试输出，帮助诊断
          console.log(`时间诊断:`, {
            startTime,
            now: performance.now(),
            elapsedMs: elapsedTimeMs,
            avgTimePerItem,
            remainingItems,
            estimatedRemainingMs: progress.remainingTimeEstimate
          });
        }
      }
      
      // 计算已花费时间
      progress.elapsedTime = performance.now() - startTime;
      
      // 更新测试进度，保持total不变
      if (progressCallback) {
        const progressToReport = {
          ...progress,
          // 只有在total为0时才更新total为当前缓冲区大小
          total: progress.total || questionBuffer.getRemainingCount() + processedQuestionCount
        };
        
        console.log('执行器报告进度:', progressToReport);
        progressCallback(progressToReport);
      }
      
      results.push(result);
    } catch (error) {
      console.error('处理问题失败:', error);
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
    const ragConfig = getRagConfig();
    if (!ragConfig) {
      throw new Error('性能测试需要RAG系统配置，请先配置RAG系统');
    }

    // 如果提供了问题列表，则使用老的并发方式
    if (questions && questions.length > 0) {
      console.log(`使用预加载的 ${questions.length} 个问题执行测试`);
      // 更新总数
      updateProgress({ total: questions.length });
      
      await executeWithConcurrencyLimit(
        test,
        questions,
        ragConfig,
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
        ragConfig,
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