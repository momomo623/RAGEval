/**
 * 性能测试执行器模块
 *
 * 该模块提供了执行RAG系统性能测试的功能，支持并发测试、进度跟踪和结果统计。
 * 使用问题缓冲区管理器实现高效的问题加载和处理，并提供详细的性能指标。
 *
 * @module performanceExecutorNew
 * @author 模型评测团队
 * @version 1.0.0
 */

import { api } from '@utils/api';
import { performanceService } from './performance.service';
import { ragRequestService } from '@pages/Settings/RAGTemplates/ragRequestService';
import { message } from 'antd';
import { PerformanceQuestionBuffer } from './performanceQuestionBuffer';

/**
 * 测试进度数据结构
 *
 * 用于跟踪和报告性能测试的进度和统计信息。
 */
export interface TestProgress {
  /** 测试的总问题数 */
  total: number;

  /** 已完成的问题数 */
  completed: number;

  /** 成功处理的问题数 */
  success: number;

  /** 处理失败的问题数 */
  failed: number;

  /** 平均响应时间（秒） */
  averageResponseTime?: number;

  /** 预计剩余时间（毫秒） */
  remainingTimeEstimate?: number;

  /** 测试开始时间戳 */
  startTime?: number;

  /** 实际总问题数（可能与初始total不同） */
  real_total?: number;

  /** 已花费的时间（毫秒） */
  elapsedTime?: number;
}

/**
 * 单个测试结果数据结构
 *
 * 记录单个问题测试的详细结果和性能指标。
 */
interface TestResult {
  /** 问题ID */
  questionId: string;

  /** 测试是否成功 */
  success: boolean;

  /** 首次响应时间（秒） */
  firstResponseTime?: number;

  /** 总响应时间（秒） */
  totalResponseTime?: number;

  /** 响应字符数 */
  characterCount?: number;

  /** 每秒处理字符数 */
  charactersPerSecond?: number;

  /** 错误详情（如果失败） */
  errorDetails?: any;

  /** 响应内容 */
  response?: string;

  /** 版本信息 */
  version?: string;

  /** 性能测试ID */
  performance_test_id?: string;

  /** 问题序号 */
  sequenceNumber: number;
}

/**
 * 执行单个RAG请求并计时
 *
 * 向RAG系统发送单个问题请求，并记录性能指标，包括首次响应时间、
 * 总响应时间、字符数和每秒字符数等。使用流式请求方式，逐块接收响应。
 *
 * @param {any} question - 问题对象，包含问题ID和文本内容
 * @param {any} test - 测试配置对象，包含RAG系统配置
 * @returns {Promise<TestResult>} 测试结果对象
 */
const executeRagRequest = async (question: any, test: any): Promise<TestResult> => {
  try {
    // 验证RAG配置是否存在
    if (!test.rag_config) {
      message.error('未配置RAG系统');
      return {
        questionId: question.id,
        success: false,
        errorDetails: { message: '未配置RAG系统' },
        sequenceNumber: question.sequence_number || 0
      };
    }

    // 从问题对象中获取问题文本，支持多种字段名
    const questionText = question.question_text || question.text || question.content || question.question;
    if (!questionText) {
      throw new Error(`无法获取问题ID ${question.id} 的文本内容`);
    }

    // 初始化性能统计变量
    const startTime = performance.now();
    let firstTokenTime: number | null = null;
    let totalChars = 0;
    let content = '';
    let lastChunkTime = startTime;

    // 使用RAG请求服务进行流式请求，并收集性能数据
    for await (const chunk of ragRequestService.streamRequest(test.rag_config, questionText)) {
      const currentTime = performance.now();

      // 记录首个token的响应时间
      if (firstTokenTime === null) {
        firstTokenTime = currentTime - startTime;
      }

      // 累计响应内容和字符数
      content += chunk;
      totalChars += chunk.length;
      lastChunkTime = currentTime;
    }

    // 计算总响应时间
    const totalTime = lastChunkTime - startTime;

    // 构建并返回测试结果对象
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
  } catch (error: any) {
    // 处理请求过程中的错误
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
 *
 * 将单个问题的测试结果保存到后端数据库，包括性能指标和响应内容。
 * 即使保存失败，也不会中断测试流程，只会记录错误日志。
 *
 * @param {any} test - 测试配置对象
 * @param {TestResult} result - 测试结果对象
 * @returns {Promise<void>}
 */
const saveTestResult = async (test: any, result: TestResult): Promise<void> => {
  try {
    // 向后端API发送测试结果数据
    await api.post('/v1/rag-answers', {
      performance_test_id: test.id,
      question_id: result.questionId,
      first_response_time: result.firstResponseTime,
      total_response_time: result.totalResponseTime,
      character_count: result.characterCount,
      characters_per_second: result.charactersPerSecond,
      answer: result.response,
      version: test.version,
      sequence_number: result.sequenceNumber,
      success: result.success,
      error_details: result.errorDetails
    });
  } catch (error) {
    // 记录错误但不中断测试流程
    console.error('保存测试结果失败:', error);
    // 测试本身的失败不应该因为保存失败而中断
  }
};

/**
 * 使用缓冲区管理器实现有限并发的测试执行
 *
 * 该函数是性能测试的核心执行逻辑，使用问题缓冲区管理器和并发工作线程
 * 高效地执行多个RAG请求，并跟踪进度和性能指标。
 *
 * @param {any} test - 测试配置对象
 * @param {QuestionBufferManager} questionBuffer - 问题缓冲区管理器实例
 * @param {Function} progressCallback - 进度更新回调函数
 * @returns {Promise<void>} 完成测试的Promise
 */
const executeWithBufferedQuestions = async (
  test: any,
  questionBuffer: PerformanceQuestionBuffer,
  progressCallback?: (progress: TestProgress) => void
): Promise<void> => {
  // 存储所有测试结果
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
    remainingTimeEstimate: 0,
    real_total: 0
  };

  /**
   * 更新进度信息并计算相关指标
   *
   * @param {Partial<TestProgress>} update - 要更新的进度字段
   */
  const updateProgress = (update: Partial<TestProgress>) => {
    // 更新进度对象
    Object.assign(progress, update);

    // 计算已用时间
    progress.elapsedTime = performance.now() - startTime;

    // 计算平均响应时间（仅考虑成功的请求）
    if (results.length > 0) {
      const successfulResults = results.filter(r => r.totalResponseTime);
      if (successfulResults.length > 0) {
        progress.averageResponseTime = successfulResults.reduce((sum, r) => sum + (r.totalResponseTime || 0), 0) / successfulResults.length;
      }
    }

    // 计算预计剩余时间（基于已完成的平均时间）
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

  // 设置问题缓冲区加载完成后的回调，更新总问题数
  questionBuffer.onAllQuestionsLoaded = (totalCount: number) => {
    console.log(`已确认实际问题总数: ${totalCount}`);
    updateProgress({
      total: totalCount,
      real_total: totalCount
    });
  };

  // 跟踪处理状态的变量
  let processedQuestionCount = 0;
  let activeRequests = 0;
  let allQuestionsProcessed = false;

  /**
   * 处理单个问题的函数
   *
   * @param {any} question - 要处理的问题对象
   * @returns {Promise<void>}
   */
  const processQuestion = async (question: any): Promise<void> => {
    if (!question) return;

    try {
      // 添加序列号
      const questionWithSeq = {
        ...question,
        sequence_number: ++processedQuestionCount
      };

      // 执行RAG请求并获取结果
      const result = await executeRagRequest(questionWithSeq, test);
      results.push(result);

      // 更新进度信息
      const successCount = results.filter(r => r.success).length;
      const failedCount = results.filter(r => !r.success).length;

      updateProgress({
        completed: successCount + failedCount, // 确保completed等于success+failed
        success: successCount,
        failed: failedCount
      });

      // 保存结果到后端
      await saveTestResult(test, result);

    } catch (error) {
      console.error('处理问题失败:', error);
      // 更新失败计数
      const successCount = results.filter(r => r.success).length;
      const failedCount = results.filter(r => !r.success).length + 1; // 加1是因为当前错误

      updateProgress({
        completed: successCount + failedCount, // 确保completed等于success+failed
        success: successCount,
        failed: failedCount
      });
    }
  };

  // 使用Promise来控制测试完成
  return new Promise((resolve, reject) => {
    /**
     * 检查是否应该继续测试
     *
     * @returns {boolean} 是否应继续测试
     */
    const shouldContinueTesting = () => {
      // 如果达到最大问题数限制，停止测试
      if (test.max_questions && processedQuestionCount >= test.max_questions) {
        return false;
      }

      // 如果所有问题都已处理，停止测试
      return !allQuestionsProcessed;
    };

    /**
     * 工作线程函数，负责处理多个问题
     *
     * @returns {Promise<void>}
     */
    const worker = async () => {
      // 只要应该继续测试，就保持工作
      while (shouldContinueTesting()) {
        activeRequests++;

        try {
          // 从缓冲区获取下一个问题
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
          // 无论成功失败，都减少活动请求计数
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

// QuestionBufferManager已在文件顶部导入

/**
 * 执行性能测试的主函数
 *
 * 这是性能测试的入口函数，负责初始化测试环境、加载问题、执行测试和报告结果。
 * 支持两种模式：使用预加载的问题列表或从数据集动态加载问题。
 *
 * @param {any} test - 测试配置对象，包含ID、数据集ID、并发数等
 * @param {any[]} questions - 可选的预加载问题列表
 * @param {Function} progressCallback - 进度更新回调函数
 * @returns {Promise<boolean>} 测试是否成功完成
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
    const progressState: TestProgress = {
      total: 0,
      completed: 0,
      success: 0,
      failed: 0,
      startTime: performance.now(),
      real_total: 0
    };

    /**
     * 更新进度状态并触发回调
     *
     * @param {Partial<TestProgress>} update - 要更新的进度字段
     */
    const updateProgress = (update: Partial<TestProgress>) => {
      // 更新内部状态
      Object.assign(progressState, update);

      // 调用回调通知UI更新
      if (progressCallback) {
        progressCallback({...progressState});
      }
    };

    // 开始测试前通知后端
    await performanceService.start({ performance_test_id: test.id });

    // 根据是否提供了预加载问题列表，选择不同的执行路径
    if (questions && questions.length > 0) {
      // 路径1: 使用预加载的问题列表
      console.log(`使用预加载的 ${questions.length} 个问题执行测试`);

      // 更新总问题数
      updateProgress({ total: questions.length });

      // 创建问题缓冲区并预加载问题
      const questionBuffer = new PerformanceQuestionBuffer(
        test.dataset_id,
        test.concurrency,
        (totalQuestions: number) => {
          updateProgress({ total: totalQuestions });
        },
        test.version  // 版本过滤
      );

      // 手动添加预加载的问题到缓冲区
      questions.forEach(q => questionBuffer.addQuestion(q));

      // 执行测试
      await executeWithBufferedQuestions(
        test,
        questionBuffer,
        (progress) => updateProgress(progress)
      );
    } else {
      // 路径2: 从数据集动态加载问题
      console.log(`使用缓冲区管理器从数据集 ${test.dataset_id} 加载问题`);

      // 创建问题缓冲区管理器
      const questionBuffer = new PerformanceQuestionBuffer(
        test.dataset_id,
        test.concurrency,
        (totalQuestions: number) => {
          console.log(`缓冲区加载的总问题数: ${totalQuestions}`);
          // 当所有问题加载完毕时更新总数
          updateProgress({
            total: totalQuestions,
            real_total: totalQuestions
          });
        },
        test.version  // 版本过滤
      );

      // 先初始化，获取总问题数
      console.log(`开始初始化问题缓冲区，数据集ID: ${test.dataset_id}`);
      const totalQuestions = await questionBuffer.initialize();
      console.log(`初始化完成，总问题数: ${totalQuestions}`);

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

      // 检查缓冲区是否加载了问题
      const remainingCount = questionBuffer.getRemainingCount();
      const hasMore = questionBuffer.hasMore();

      console.log(`缓冲区状态: 已加载问题数=${remainingCount}, 是否有更多=${hasMore}`);

      // 确保缓冲区至少加载了一个问题，否则抛出错误
      if (remainingCount === 0 && !hasMore) {
        console.log('缓冲区为空，尝试使用不同的方法加载问题...');

        // 尝试直接使用API加载问题
        try {
          console.log(`尝试直接从API加载数据集 ${test.dataset_id} 的问题...`);

          // 构建请求参数
          const params: any = {
            page: 1,
            size: 50  // 尝试加载更多问题
          };

          if (test.version) {
            params.version = test.version;
          }

          console.log('直接API请求参数:', params);

          // 直接调用API
          const response = await api.get(`/api/v1/datasets-questions/${test.dataset_id}/questions`, {
            params
          });

          console.log('直接API响应:', response);

          // 检查是否有问题
          if (response && (response as any).items && (response as any).items.length > 0) {
            const items = (response as any).items;
            console.log(`直接API调用成功，获取到 ${items.length} 个问题`);

            // 添加问题到缓冲区
            items.forEach((item: any) => questionBuffer.addQuestion(item));

            // 更新进度
            updateProgress({
              total: items.length,
              real_total: items.length
            });
          } else {
            console.error('直接API调用成功，但没有返回任何问题');
            throw new Error(`数据集 ${test.dataset_id} 中没有问题，请检查数据集是否为空`);
          }
        } catch (directApiError) {
          console.error('直接API调用失败:', directApiError);

          // 尝试手动加载一次，作为最后的尝试
          try {
            console.log('尝试通过缓冲区管理器手动加载问题...');
            await questionBuffer.manualLoadMoreQuestions();

            // 再次检查
            if (questionBuffer.getRemainingCount() === 0 && !questionBuffer.hasMore()) {
              console.error('所有加载尝试都失败，无法获取任何问题');
              throw new Error(`未能从数据集 ${test.dataset_id} 加载任何问题，请检查数据集是否为空或API是否正常。详细错误: ${directApiError.message}`);
            }
          } catch (loadError) {
            console.error('手动加载问题失败:', loadError);
            throw new Error(`未能从数据集 ${test.dataset_id} 加载任何问题: ${loadError.message}`);
          }
        }
      }

      console.log(`初始加载了 ${questionBuffer.getRemainingCount()} 个问题，开始执行测试`);

      // 设置初始总数为已加载的问题数
      // 重新获取最新的问题数量
      const currentQuestionCount = questionBuffer.getRemainingCount();
      updateProgress({
        total: currentQuestionCount,
        real_total: currentQuestionCount
      });

      // 执行带缓冲区的测试
      await executeWithBufferedQuestions(
        test,
        questionBuffer,
        (progress) => updateProgress(progress)
      );
    }

    console.log('测试执行完成，通知后端计算汇总指标');

    // 测试完成后通知后端计算汇总指标
    await performanceService.complete(test.id);

    return true;
  } catch (error: any) {
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
