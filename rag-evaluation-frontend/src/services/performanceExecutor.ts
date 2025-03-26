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
  try {
    // 使用通用函数执行请求
    const result = await executeRAGRequest(question.content, ragConfig);
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
 * 使用Promise.all实现有限并发
 */
const executeWithConcurrencyLimit = async (
  test: any,
  questions: any[],
  // concurrency: number,
  ragConfig: RAGRequestConfig,
  progressCallback?: (progress: TestProgress) => void
): Promise<TestResult[]> => {
  const results: TestResult[] = [];
  const startTime = performance.now();
  const progress: TestProgress = {
    total: questions.length,
    completed: 0,
    success: 0,
    failed: 0,
    startTime
  };
  
  // 复制问题数组并添加序列号
  const preparedQuestions = questions.map((q, index) => ({
    ...q,
    sequence_number: index + 1
  }));
  
  // 分批执行，每批最多concurrency个并发
  for (let i = 0; i < preparedQuestions.length; i += test.concurrency) {
    const batch = preparedQuestions.slice(i, i + test.concurrency);
    
    // 并发执行当前批次
    const batchPromises = batch.map(async (question) => {
      // 执行RAG请求
      const result = await executeRagRequest(question, ragConfig);
      
      // 保存结果到后端
      await saveTestResult(test, result);
      
      // 更新进度
      progress.completed++;
      if (result.success) {
        progress.success++;
      } else {
        progress.failed++;
      }
      
      // 计算平均响应时间
      const successResults = results.filter(r => r.success && r.totalResponseTime);
      if (successResults.length > 0) {
        const avgTime = successResults.reduce((sum, r) => sum + (r.totalResponseTime || 0), 0) / successResults.length;
        progress.averageResponseTime = avgTime;
        
        // 估算剩余时间
        const remainingItems = progress.total - progress.completed;
        const elapsedTime = performance.now() - startTime;
        const timePerItem = elapsedTime / progress.completed;
        progress.remainingTimeEstimate = remainingItems * timePerItem;
      }
      
      // 回调进度
      if (progressCallback) {
        progressCallback({...progress});
      }
      
      return result;
    });
    
    // 等待当前批次完成
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }
  
  return results;
};

/**
 * 执行性能测试的主函数
 */
export const executePerformanceTest = async (
  test: any,
  // testId: string,
  questions: any[],
  // concurrency: number,
  progressCallback?: (progress: TestProgress) => void
): Promise<boolean> => {
  try {

    
    // 开始测试前通知后端
    await performanceService.start({ performance_test_id: test.id });
    
    // 获取RAG配置
    const ragConfig = getRagConfig();
    if (!ragConfig) {
      throw new Error('性能测试需要RAG系统配置，请先配置RAG系统');
    }
    
    // 执行并发测试
    await executeWithConcurrencyLimit(
      test,
      questions,
      // test.concurrency,
      ragConfig,
      progressCallback
    );
    
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