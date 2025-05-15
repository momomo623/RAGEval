/**
 * 精度测试执行器模块
 *
 * 该模块提供了执行精度测试的功能，支持并发测试、进度跟踪和结果统计。
 * 使用问题缓冲区管理器实现高效的问题加载和处理，并提供详细的性能指标。
 *
 * @module accuracyExecutorNew
 * @author 模型评测团队
 * @version 1.0.0
 */

import { accuracyService } from './accuracy.service';
import { accuracyRequestService } from './accuracyRequestService';
import { AccuracyQuestionBuffer } from './accuracyQuestionBuffer';

/**
 * 测试进度数据结构
 *
 * 用于跟踪和报告精度测试的进度和统计信息。
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

  /** 测试开始时间戳 */
  startTime?: number;

  /** 当前批次 */
  currentBatch?: number;

  /** 总批次数 */
  totalBatches?: number;

  /** 平均响应时间（秒） */
  averageResponseTime?: number;

  /** 预计剩余时间（毫秒） */
  remainingTimeEstimate?: number;

  /** 实际总问题数（可能与初始total不同） */
  real_total?: number;

  /** 已花费的时间（毫秒） */
  elapsedTime?: number;
}

/**
 * 使用缓冲区管理器执行精度测试
 *
 * 该函数是精度测试的核心执行逻辑，使用问题缓冲区管理器和并发工作线程
 * 高效地执行多个评测请求，并跟踪进度和性能指标。
 *
 * @param {any} test - 测试配置对象
 * @param {QuestionBufferManager} questionBuffer - 问题缓冲区管理器实例
 * @param {Function} progressCallback - 进度更新回调函数
 * @param {string} modelConfigId - 模型配置ID
 * @returns {Promise<void>} 完成测试的Promise
 */
async function executeWithBufferedQuestions(
  test: any,
  questionBuffer: AccuracyQuestionBuffer,
  progressCallback: (progress: TestProgress) => void,
  modelConfigId: string
): Promise<void> {
  const results: any[] = [];
  const startTime = performance.now();

  // 初始化进度对象
  const progress: TestProgress = {
    total: questionBuffer.getRemainingCount() || test.questionCount || 0,
    completed: 0,
    success: 0,
    failed: 0,
    startTime
  };

  // 设置问题缓冲区加载完成后的回调
  questionBuffer.onAllQuestionsLoaded = (totalCount: number) => {
    console.log(`已确认精度评测实际问题总数: ${totalCount}`);

    // 只设置real_total，不再修改total
    if (!progress.real_total || totalCount > progress.real_total) {
      console.log(`更新精度评测真实总数: ${progress.real_total || 0} -> ${totalCount}`);
      progress.real_total = totalCount;

      // 注意：这里不再自动更新total，保持其稳定性
      if (progressCallback) {
        progressCallback({...progress});
      }
    }
  };

  let processedQuestionCount = 0;
  let activeRequests = 0;
  let allQuestionsProcessed = false;

  // 处理单个问题的函数
  const processQuestion = async (question: any): Promise<void> => {
    if (!question) {
      console.error('收到空问题对象，跳过处理');
      return;
    }

    try {
      // 添加序列号
      const questionWithSeq = {
        ...question,
        sequence_number: ++processedQuestionCount
      };

      // 确保问题对象含有必要的字段
      if (!questionWithSeq.id) {
        console.warn('问题对象缺少ID字段');
      }

      // 处理问题并进行评测
      const result = await accuracyRequestService.evaluateItem(questionWithSeq, test, modelConfigId);

      // 提交评测结果到后端
      await accuracyService.submitItemResults(test.id, [result]);

      // 更新进度
      progress.completed++;
      if (result.status === 'failed') {
        progress.failed++;
      } else {
        progress.success++;
      }

      // 计算性能指标
      if (result.processing_time) {
        const successfulResults = results.filter(r => r.processing_time);
        const times = successfulResults.map(r => r.processing_time || 0);
        times.push(result.processing_time);

        // 转换为秒，确保单位一致
        const timesInSeconds = times.map(time => typeof time === 'number' ? time / 1000 : 0);

        // 计算平均值
        progress.averageResponseTime = timesInSeconds.reduce((a, b) => a + b, 0) / timesInSeconds.length;

        // 计算剩余时间估计
        if (progress.real_total && progress.completed > 0) {
          const elapsedTimeMs = performance.now() - startTime;
          progress.elapsedTime = elapsedTimeMs;

          // 计算实际处理速率(每秒完成的问题数)
          const questionsPerSecond = progress.completed / (elapsedTimeMs / 1000);

          // 剩余问题数
          const remainingItems = progress.real_total - progress.completed;

          // 计算剩余时间
          let estimatedTimeRemaining = (remainingItems / questionsPerSecond) * 1000;

          // 平滑处理，减少波动
          if (progress.remainingTimeEstimate) {
            const completionRatio = progress.completed / progress.real_total;
            const currentEstimateWeight = Math.min(0.7, 0.3 + completionRatio * 0.5);
            const prevEstimateWeight = 1 - currentEstimateWeight;

            estimatedTimeRemaining = (prevEstimateWeight * progress.remainingTimeEstimate) +
                                    (currentEstimateWeight * estimatedTimeRemaining);
          }

          progress.remainingTimeEstimate = estimatedTimeRemaining;
        }
      }

      // 计算已花费时间
      progress.elapsedTime = performance.now() - startTime;

      // 更新进度回调
      if (progressCallback) {
        console.log('精度评测执行器报告进度:', progress);
        progressCallback({...progress});
      }

      results.push(result);
    } catch (error) {
      console.error('处理精度评测问题失败:', error);

      // 更新失败计数
      progress.completed++;
      progress.failed++;

      // 回调进度更新
      if (progressCallback) {
        progressCallback(progress);
      }
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
    const concurrencyLimit = test.batch_settings?.concurrency || 6;
    for (let i = 0; i < concurrencyLimit; i++) {
      workers.push(worker());
    }

    // 当所有工作线程停止工作且没有活动请求时，测试才真正完成
    Promise.all(workers).then(() => {
      if (activeRequests === 0) {
        resolve();
      }
    }).catch(reject);
  });
}

/**
 * 执行精度测试
 *
 * 这是精度测试的入口函数，负责初始化测试环境、加载问题、执行测试和报告结果。
 * 支持两种模式：使用预加载的问题列表或从数据集动态加载问题。
 *
 * @param {any} test - 测试配置对象，包含ID、数据集ID、并发数等
 * @param {any[]} questions - 可选的预加载问题列表
 * @param {Function} onProgressUpdate - 进度更新回调函数
 * @param {string} modelConfigId - 模型配置ID
 * @returns {Promise<boolean>} 测试是否成功完成
 */
export async function executeAccuracyTest(
  test: any,
  questions: any[],
  onProgressUpdate: (progress: TestProgress) => void,
  modelConfigId: string
): Promise<boolean> {
  try {
    console.log('开始执行精度测试:', test);

    // 验证必要的测试数据
    if (!test.id) {
      throw new Error('测试ID缺失');
    }

    if (!test.dataset_id) {
      throw new Error('测试未关联数据集');
    }

    // 用于保存和更新进度的对象
    const progressState: TestProgress = {
      total: 0,
      completed: 0,
      success: 0,
      failed: 0,
      startTime: performance.now()
    };

    // 创建更新进度的内部函数
    const updateProgress = (update: Partial<TestProgress>) => {
      // 更新内部状态
      Object.assign(progressState, update);

      // 调用回调
      if (onProgressUpdate) {
        onProgressUpdate({...progressState});
      }
    };

    // 开始测试前通知后端
    await accuracyService.start({ accuracy_test_id: test.id });

    // 如果提供了问题列表，则使用预加载的问题
    if (questions && questions.length > 0) {
      console.log(`使用预加载的 ${questions.length} 个问题执行精度测试`);

      // 更新总数
      updateProgress({ total: questions.length });

      // 创建问题缓冲区并预加载问题
      const questionBuffer = new AccuracyQuestionBuffer(
        test.dataset_id,
        test.batch_settings?.concurrency || 6,
        (totalQuestions: number) => {
          updateProgress({ total: totalQuestions });
        },
        test.version,  // 版本过滤
        true           // 只加载有RAG结果的问题
      );

      // 手动添加预加载的问题到缓冲区
      questions.forEach(q => questionBuffer.addQuestion(q));

      // 执行测试
      await executeWithBufferedQuestions(
        test,
        questionBuffer,
        (progress) => updateProgress(progress),
        modelConfigId
      );
    } else {
      console.log(`使用缓冲区管理器从数据集 ${test.dataset_id} 加载精度评测问题`);

      // 创建问题缓冲区管理器
      const questionBuffer = new AccuracyQuestionBuffer(
        test.dataset_id,
        test.batch_settings?.concurrency || 6,
        (totalQuestions: number) => {
          console.log(`精度评测缓冲区加载的总问题数: ${totalQuestions}`);
          // 当所有问题加载完毕时更新总数
          updateProgress({ total: totalQuestions });
        },
        test.version,  // 版本过滤
        true           // 只加载有RAG结果的问题
      );

      // 初始化缓冲区，获取总问题数
      const totalQuestions = await questionBuffer.initialize();

      // 立即更新进度对象，设置固定的real_total和初始total
      updateProgress({
        total: totalQuestions,
        real_total: totalQuestions
      });

      // 确保缓冲区至少加载了一个问题，否则抛出错误
      if (questionBuffer.getRemainingCount() === 0 && !questionBuffer.hasMore()) {
        // 尝试手动加载一次，看是否能获取到问题
        try {
          await questionBuffer.manualLoadMoreQuestions();

          // 再次检查
          if (questionBuffer.getRemainingCount() === 0 && !questionBuffer.hasMore()) {
            throw new Error(`未能从数据集 ${test.dataset_id} 加载任何精度评测问题，请检查数据集是否为空或是否有RAG结果`);
          }
        } catch (loadError) {
          console.error('尝试手动加载精度评测问题失败:', loadError);
          throw new Error(`未能从数据集 ${test.dataset_id} 加载任何精度评测问题: ${loadError.message}`);
        }
      }

      // 执行带缓冲区的测试
      await executeWithBufferedQuestions(
        test,
        questionBuffer,
        updateProgress,
        modelConfigId
      );
    }

    console.log('精度测试执行完成，通知后端计算汇总指标');


    return true;
  } catch (error: any) {
    console.error('执行精度测试失败:', error);


    return false;
  }
}
