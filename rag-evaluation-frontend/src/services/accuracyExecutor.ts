// import { getLLMConfig } from '../utils/configStorage';
import { useConfigContext } from '../contexts/ConfigContext';
import { datasetService } from './dataset.service';
import OpenAI from 'openai';
import { accuracyService } from './accuracy.service';
import * as yaml from 'js-yaml';
import { LLMClient } from '../pages/Settings/LLMTemplates/llm-request';

export interface TestProgress {
  total: number;
  completed: number;
  success: number;
  failed: number;
  startTime?: number;
  currentBatch?: number;
  totalBatches?: number;
  averageResponseTime?: number;    // 平均响应时间
  remainingTimeEstimate?: number;  // 剩余时间估计
  real_total?: number;
  elapsedTime?: number; // 新增：已花费的时间（毫秒）
}

/**
 * 构建评测提示词
 */
function buildPrompt(
  question: string,
  referenceAnswer: string,
  ragAnswer: string,
  promptTemplate: string,
): string {
  // 替换提示词模板中的占位符
  let prompt = promptTemplate
    .replace('{{question}}', question)
    .replace('{{reference_answer}}', referenceAnswer)
    .replace('{{rag_answer}}', ragAnswer);
  
  return prompt;
}

/**
 * 执行LLM评测（改为llm-request方式）
 */
async function evaluateWithLLM(
  prompt: string,
  modelConfigId: string
): Promise<any> {
  const llmClient = await LLMClient.createFromConfigId(modelConfigId);
  const response = await llmClient.chatCompletion({
    userMessage: prompt,
    systemMessage: '你是一个专业的RAG回答评估专家，你的任务是评估生成式AI的回答质量。请根据提供的标准答案评价RAG系统的回答质量，分析其准确性、相关性和完整性。',
    additionalParams: {
      temperature: 0.2,
      max_tokens: 1000
    }
  });
  return response;
}

/**
 * 从大模型返回的文本中提取YAML评估结果
 * @param modelResponse 大模型返回的文本内容，包含思考过程和评估结果
 * @returns 解析后的评估结果对象
 */
function extractEvaluationResult(modelResponse: string): {
  overall_score: number;
  dimension_scores: Record<string, number>;
  evaluation_reason: string;
  item_metadata: string
} {
  try {
    // 查找分隔符 #### 并获取其之后的内容
    const parts = modelResponse.split('####');
    if (parts.length < 2) {
      console.error('大模型返回内容格式不正确: 未找到分隔符');
      return { overall_score: 0, dimension_scores: {}, evaluation_reason: '解析错误', item_metadata: modelResponse };
    }
    
    // 获取YAML部分的文本
    const yamlText = parts[1].trim();
    
    // 提取YAML内容 (去掉\```yaml和\```包装)
    const yamlMatch = yamlText.match(/```yaml\s*([\s\S]*?)\s*```/);
    if (!yamlMatch) {
      console.error('大模型返回内容格式不正确: 未找到YAML代码块');
      return { overall_score: 0, dimension_scores: {}, evaluation_reason: '解析错误', item_metadata: modelResponse };
    }
    
    const yamlContent = yamlMatch[1].trim();
    
    // 使用js-yaml库解析YAML内容
    const parsedYaml = yaml.load(yamlContent) as any;
    
    const result = {
      overall_score: 0,
      dimension_scores: {},
      evaluation_reason: '',
      item_metadata: modelResponse
    };
    
    // 提取总分
    if (parsedYaml.overall_score !== undefined) {
      result.overall_score = Number(parsedYaml.overall_score);
    }
    
    // 提取维度评分 - 处理可能的数组格式
    if (parsedYaml.dimension_scores) {
      // 如果维度评分是数组形式
      if (Array.isArray(parsedYaml.dimension_scores)) {
        for (const item of parsedYaml.dimension_scores) {
          if (typeof item === 'object') {
            // 遍历对象中的每个属性
            for (const [dimension, score] of Object.entries(item)) {
              result.dimension_scores[dimension] = Number(score);
            }
          }
        }
      } 
      // 如果维度评分是对象形式
      else if (typeof parsedYaml.dimension_scores === 'object') {
        for (const [dimension, score] of Object.entries(parsedYaml.dimension_scores)) {
          result.dimension_scores[dimension] = Number(score);
        }
      }
    }
    
    // 提取评估理由
    if (parsedYaml.evaluation_reason) {
      // 处理字符串或数组格式的评估理由
      if (typeof parsedYaml.evaluation_reason === 'string') {
        result.evaluation_reason = parsedYaml.evaluation_reason;
      } else if (Array.isArray(parsedYaml.evaluation_reason)) {
        result.evaluation_reason = parsedYaml.evaluation_reason.join('\n');
      }
    }
    
    return result;
  } catch (error) {
    console.error('解析评估结果出错:', error);
    return { 
      overall_score: 0, 
      dimension_scores: {}, 
      evaluation_reason: '解析错误: ' + (error instanceof Error ? error.message : String(error)), 
      item_metadata: modelResponse
    };
  }
}

/**
 * 应用评估结果到测试项
 * @param evaluationResult 解析后的评估结果
 * @param testItem 要更新的测试项
 */
function applyEvaluationResults(
  evaluationResult: {
    overall_score: number;
    dimension_scores: Record<string, number>;
    evaluation_reason: string;
  },
  testItem: any
): any {
  // 将评估结果应用到测试项
  return {
    ...testItem,
    ai_score: evaluationResult.overall_score,
    ai_dimension_scores: evaluationResult.dimension_scores,
    ai_evaluation_reason: evaluationResult.evaluation_reason,
    ai_evaluation_time: new Date().toISOString(),
    status: 'ai_completed'
  };
}

/**
 * 处理单个评测项
 */
async function processEvaluationItem(
  item: any,
  test: any,
  modelConfigId: string
): Promise<any> {
  try {
    console.log(`处理评测项: ${item.id}`, item);
    
    const prompt = buildPrompt(
      item.question_text || item.text || item.content || item.question,
      item.standard_answer || item.answer || item.reference_answer,
      item.rag_answers?.[0]?.answer || item.rag_answer || '',
      test.prompt_template,
    );
    console.log("prompt", prompt)
    
    const startTime = performance.now();
    
    // 调用LLM进行评测
    const llmResponse = await evaluateWithLLM(prompt, modelConfigId);
    
    const processingTime = performance.now() - startTime;
    
    // 解析评测结果
    const { overall_score, dimension_scores, evaluation_reason, item_metadata } = extractEvaluationResult(llmResponse);
    
    // 构建评测项结果
    return {
      id: item.id,
      ai_score: overall_score,
      ai_dimension_scores: dimension_scores,
      ai_evaluation_reason: evaluation_reason,
      ai_evaluation_time: new Date().toISOString(),
      ai_raw_response: llmResponse,
      status: test.evaluation_type === 'ai' ? 'ai_completed' : 'ai_completed',
      processing_time: processingTime,
      item_metadata: item_metadata, // 原始回答
      ...(test.evaluation_type === 'ai' ? {
        final_score: overall_score,
        final_dimension_scores: dimension_scores,
        final_evaluation_reason: evaluation_reason,
        final_evaluation_type: 'ai'
      } : {})
    };
  } catch (error) {
    console.error('处理评测项失败:', error);
    return {
      id: item.id,
      status: 'failed',
      error_message: error.message
    };
  }
}

/**
 * 使用并发限制执行评测
 */
async function executeWithConcurrencyLimit(
  test: any,
  questions: any[],
  modelConfigId: string,
  progressCallback: (progress: TestProgress) => void
): Promise<void> {
  const concurrencyLimit = test.batch_settings?.concurrency || 6;
  const results: any[] = [];
  const startTime = performance.now();
  
  // 初始化进度对象
  const progress: TestProgress = {
    total: questions.length,
    completed: 0,
    success: 0,
    failed: 0,
    startTime
  };
  
  let activeRequests = 0;
  let nextQuestionIndex = 0;
  
  // 处理单个问题
  const processQuestion = async (question: any): Promise<void> => {
    try {
      // 处理问题
      const result = await processEvaluationItem(question, test, modelConfigId);
      
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
        
        // 计算剩余时间估计 - 改进计算逻辑
        if (progress.total > 0 && progress.completed > 0) {
          const elapsedTimeMs = performance.now() - startTime;
          
          // 确保已用时间计算正确
          progress.elapsedTime = elapsedTimeMs;
          
          // 获取已完成项目的平均处理时间(每项耗时)
          const avgTimePerItem = elapsedTimeMs / progress.completed;
          
          // 记录上一次的剩余项目数量，用于检测突变
          const prevRemainingItems = progress.remainingTimeEstimate ? 
            Math.ceil(progress.remainingTimeEstimate / Math.max(avgTimePerItem, 1000)) : 
            (progress.total - progress.completed);
          
          // 计算当前剩余项目数量
          const currentRemainingItems = progress.total - progress.completed;
          
          // 检测剩余项目数是否有突变(>20%的变化)
          const isAnomalousChange = prevRemainingItems > 0 && 
            Math.abs(currentRemainingItems - prevRemainingItems) / prevRemainingItems > 0.2;
            
          // 使用平滑后的剩余项目数，防止因为total突变导致预计时间跳变
          let smoothedRemainingItems = currentRemainingItems;
          if (isAnomalousChange && progress.remainingTimeEstimate) {
            // 如果检测到异常变化，使用加权平均更新剩余项目数
            smoothedRemainingItems = Math.round(0.8 * prevRemainingItems + 0.2 * currentRemainingItems);
            console.log('检测到剩余项目数异常变化', {
              prev: prevRemainingItems,
              current: currentRemainingItems,
              smoothed: smoothedRemainingItems
            });
          }
          
          // 使用平滑后的剩余项目数计算预估时间
          let rawEstimatedTimeRemaining = smoothedRemainingItems * avgTimePerItem;
          
          // 安全边界：确保剩余时间不会突然变得太小
          if (smoothedRemainingItems > 0 && rawEstimatedTimeRemaining < 30000) {
            rawEstimatedTimeRemaining = Math.max(30000, smoothedRemainingItems * Math.max(avgTimePerItem, 5000));
          }
          
          // 更强的平滑处理，减少波动
          let estimatedTimeRemaining = rawEstimatedTimeRemaining;
          if (progress.remainingTimeEstimate) {
            // 根据剩余比例动态调整平滑系数
            // 当完成度接近100%时，减少当前估计的权重，保持更稳定
            const completionRatio = progress.completed / progress.total;
            const currentEstimateWeight = Math.max(0.1, 0.4 - completionRatio * 0.3); // 权重范围从0.4降到0.1
            const prevEstimateWeight = 1 - currentEstimateWeight;
            
            estimatedTimeRemaining = (prevEstimateWeight * progress.remainingTimeEstimate) + 
                                     (currentEstimateWeight * rawEstimatedTimeRemaining);
            
            // 额外的波动控制：限制单次估计变化不超过30%
            const maxChange = 0.3 * progress.remainingTimeEstimate;
            if (Math.abs(estimatedTimeRemaining - progress.remainingTimeEstimate) > maxChange) {
              // 限制变化幅度
              const direction = estimatedTimeRemaining > progress.remainingTimeEstimate ? 1 : -1;
              estimatedTimeRemaining = progress.remainingTimeEstimate + (direction * maxChange);
            }
          }
          
          // 更新估计的剩余时间
          progress.remainingTimeEstimate = estimatedTimeRemaining;
          
          // 添加详细调试日志
          console.log(`改进版精度测试时间计算:`, {
            progress: Math.round(progress.completed / progress.total * 100) + '%',
            elapsedMs: elapsedTimeMs,
            avgTimePerItem,
            rawRemaining: currentRemainingItems,
            smoothedRemaining: smoothedRemainingItems, 
            rawEstimateMs: rawEstimatedTimeRemaining,
            finalEstimateMs: estimatedTimeRemaining,
            changeLimit: progress.remainingTimeEstimate ? 'applied' : 'n/a'
          });
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
      console.error('处理问题失败:', error);
      
      // 即使失败也需要更新进度
      progress.completed++;
      progress.failed++;
      progressCallback(progress);
    }
  };
  
  return new Promise((resolve, reject) => {
    // 检查是否还有问题需要处理
    const checkAndProcessNextQuestion = () => {
      // 如果所有问题都处理完成，则解析Promise
      if (nextQuestionIndex >= questions.length && activeRequests === 0) {
        return resolve();
      }
      
      // 如果还有问题要处理且并发数未达上限，则处理下一个问题
      while (nextQuestionIndex < questions.length && activeRequests < concurrencyLimit) {
        const question = questions[nextQuestionIndex++];
        activeRequests++;
        
        processQuestion(question).finally(() => {
          activeRequests--;
          // 处理完一个问题后，检查是否有新问题需要处理
          checkAndProcessNextQuestion();
        });
      }
    };
    
    // 开始处理问题
    checkAndProcessNextQuestion();
  });
}

/**
 * 批量提交评测结果
 */
async function submitTestResults(
  testId: string,
  results: any[]
): Promise<void> {
  if (results.length === 0) return;
  
  // 每次最多提交50个结果
  const BATCH_SIZE = 50;
  for (let i = 0; i < results.length; i += BATCH_SIZE) {
    const batch = results.slice(i, i + BATCH_SIZE);
    await accuracyService.submitItemResults(testId, batch);
  }
}

// AccuracyQuestionBufferManager 类 - 精度评测缓冲区管理器
class AccuracyQuestionBufferManager {
  private questions: any[] = [];
  private loading: boolean = false;
  private currentPage: number = 1;
  private pageSize: number = 50; // 每页加载的问题数量
  private datasetId: string;
  private concurrency: number;
  private bufferThreshold: number; // 缓冲区阈值
  private onAllQuestionsLoaded?: (total: number) => void;
  private hasMoreData: boolean = true;
  private version?: string; // 支持版本过滤
  private totalLoaded: number = 0;
  
  constructor(datasetId: string, concurrency: number, version?: string, onAllQuestionsLoaded?: (total: number) => void) {
    this.datasetId = datasetId;
    this.concurrency = concurrency;
    this.version = version;
    this.onAllQuestionsLoaded = onAllQuestionsLoaded;
    this.bufferThreshold = Math.max(20, concurrency * 2); // 缓冲区阈值为并发数的2倍，最小20
    this.pageSize = Math.max(50, concurrency * 3); // 每页至少加载并发数的3倍
  }
  
  // 修改初始化方法，预先获取总问题数
  async initialize(): Promise<number> {
    if (!this.datasetId) {
      console.error('缺少数据集ID，无法初始化精度评测');
      return 0;
    }
    
    try {
      // 只请求一个问题，主要目的是获取总数
      const params: any = {
        page: 1,
        size: 1 // 只获取一条记录，减少数据传输
      };
      
      if (this.version) {
        params.version = this.version;
      }
      
      // 获取问题数据以获取总数
      const response = await datasetService.getQuestions(this.datasetId, params);
      
      // 获取总问题数
      const totalCount = response.total || 0;
      console.log(`精度评测初始化：获取到数据集总问题数: ${totalCount}`);
      
      // 通知总数
      if (this.onAllQuestionsLoaded && totalCount > 0) {
        this.onAllQuestionsLoaded(totalCount);
      }
      
      // 加载第一批真实数据
      await this.loadMoreQuestions();
      
      return totalCount;
    } catch (error) {
      console.error('初始化获取精度评测问题总数失败:', error);
      return 0;
    }
  }
  
  // 获取下一个可用的问题
  getNextQuestion(): any | null {
    // 检查缓冲区是否需要补充
    this.checkAndLoadMore();
    
    // 返回缓冲区中的下一个问题
    if (this.questions.length > 0) {
      const question = this.questions.shift();
      return question;
    }
    return null;
  }
  
  // 检查并预加载更多问题
  private async checkAndLoadMore(): Promise<void> {
    // 当缓冲区中的问题数量低于阈值且尚未开始加载更多且仍有更多数据时
    if (this.questions.length < this.bufferThreshold && !this.loading && this.hasMoreData) {
      this.loadMoreQuestions();
    }
  }
  
  // 加载更多问题
  private async loadMoreQuestions(): Promise<void> {
    if (this.loading || !this.hasMoreData) return;
    
    this.loading = true;
    console.log(`正在加载更多精度评测问题，数据集ID: ${this.datasetId}, 当前页: ${this.currentPage}, 页大小: ${this.pageSize}`);
    
    try {
      // 确保datasetId存在
      if (!this.datasetId) {
        console.error('缺少数据集ID，无法加载问题');
        this.hasMoreData = false;
        return;
      }
      
      // 构建请求参数
      const params: any = {
        page: this.currentPage,
        size: this.pageSize // 修改参数名称与API匹配
      };
      
      // 如果指定了版本，添加版本参数
      if (this.version) {
        params.version = this.version;
      }
      
      // 获取问题数据
      const response = await datasetService.getQuestions(this.datasetId, params);
      
      console.log('问题API响应:', response);
      
      // 提取问题数据 - 修复数据提取逻辑
      let newQuestions = [];
      if (response && response.items) { // 修改为items
        newQuestions = response.items;
      } else if (response && response.questions) {
        newQuestions = response.questions;
      } else if (Array.isArray(response)) {
        newQuestions = response;
      }
      
      console.log(`获取到 ${newQuestions.length} 个新问题, 样例:`, newQuestions[0]);
      
      // 添加到缓冲区
      this.questions.push(...newQuestions);
      this.totalLoaded += newQuestions.length;
      
      // 更新页码
      this.currentPage++;
      
      // 修复判断是否还有更多数据的逻辑
      if (response.total && response.pages) {
        // 使用API返回的总数和页数信息进行精确判断
        this.hasMoreData = this.totalLoaded < response.total && this.currentPage <= response.pages;
        
        // 如果已是最后一页，设置总数
        if (this.currentPage > response.pages && this.onAllQuestionsLoaded) {
          console.log(`已加载所有精度评测问题，总数: ${response.total}`);
          this.onAllQuestionsLoaded(response.total);
        }
      } else {
        // 退回到原来的判断逻辑，作为备选
        this.hasMoreData = newQuestions.length >= this.pageSize;
        
        if (newQuestions.length < this.pageSize && this.onAllQuestionsLoaded) {
          console.log(`已加载所有精度评测问题，总数: ${this.totalLoaded}`);
          this.onAllQuestionsLoaded(this.totalLoaded);
        }
      }
      
      console.log(`缓冲区中的问题数: ${this.questions.length}, 总加载数: ${this.totalLoaded}, 还有更多数据: ${this.hasMoreData}`);
      
      if (newQuestions.length === 0) {
        console.warn('API未返回任何问题，可能是API路径错误或数据集为空');
        this.tryAlternativeAPI();
      }
    } catch (error) {
      console.error('加载精度评测问题失败:', error);
    } finally {
      this.loading = false;
    }
  }
  
  // 尝试替代API路径
  private async tryAlternativeAPI(): Promise<void> {
    try {
      console.log('尝试替代API路径加载精度评测问题...');
      
      // 尝试其他可能的路径格式
      const alternatives = [
        `/v1/datasets/${this.datasetId}/questions`,
        `/api/v1/datasets/${this.datasetId}/questions`
      ];
      
      for (const path of alternatives) {
        try {
          console.log(`尝试API路径: ${path}`);
          const params: any = { page: 1, page_size: this.pageSize };
          if (this.version) {
            params.version = this.version;
          }
          
          const response = await fetch(`${path}?${new URLSearchParams(params)}`);
          
          if (response.ok) {
            const data = await response.json();
            if (data.questions?.length > 0 || (Array.isArray(data) && data.length > 0)) {
              console.log(`找到有效的API路径: ${path}`);
              return;
            }
          }
        } catch (e) {
          console.log(`路径 ${path} 无效`);
        }
      }
      
      console.error('无法找到有效的精度评测问题API路径');
    } catch (error) {
      console.error('替代API尝试失败:', error);
    }
  }
  
  // 获取缓冲区中剩余的问题数量
  getRemainingCount(): number {
    return this.questions.length;
  }
  
  // 获取已加载的总问题数
  getTotalLoaded(): number {
    return this.totalLoaded;
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
    this.totalLoaded = 0;
  }

  public getConcurrency(): number {
    return this.concurrency;
  }
}

/**
 * 使用缓冲区管理器执行精度评测
 */
async function executeWithBufferedAccuracyTest(
  test: any,
  questionBuffer: AccuracyQuestionBufferManager,
  progressCallback: (progress: TestProgress) => void,
  modelConfigId: string
): Promise<void> {
  const results: any[] = [];
  const startTime = performance.now();
  
  // 初始化进度对象，使用已经获取的实际问题总数
  const progress: TestProgress = {
    total: questionBuffer.getTotalLoaded() || test.questionCount || 0,  // 使用已知总数
    completed: 0,
    success: 0,
    failed: 0,
    startTime
  };
  
  let processedQuestionCount = 0;
  let activeRequests = 0;  // 跟踪活动请求数量
  let allQuestionsProcessed = false;  // 标记是否所有问题都已处理
  
  // 设置问题缓冲区加载完成后的回调，维持real_total的稳定性
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
      const result = await processEvaluationItem(questionWithSeq, test, modelConfigId);
      
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
        
        // 计算剩余时间估计 - 改进计算逻辑
        if (progress.real_total && progress.completed > 0) {
          const elapsedTimeMs = performance.now() - startTime;
          progress.elapsedTime = elapsedTimeMs;
          
          // 计算实际处理速率(每秒完成的问题数)，考虑并发
          const questionsPerSecond = progress.completed / (elapsedTimeMs / 1000);
          
          // 获取实际并发数
          const actualConcurrency = test.batch_settings?.concurrency || questionBuffer.getConcurrency() || 1;
          
          // 剩余问题数
          const remainingItems = progress.real_total - progress.completed;
          
          // 计算剩余时间 - 考虑并发处理的影响
          // 理论上，处理速率应该和并发数成正比，但由于系统开销和资源竞争，实际增长会趋于平缓
          // 使用下面的公式估算处理剩余问题所需的时间
          let rawEstimatedTimeRemaining = (remainingItems / questionsPerSecond) * 1000;
          
          // 对于刚开始的情况，基于已有平均响应时间和并发数计算
          if (progress.averageResponseTime && progress.completed < 5) {
            // 如果刚开始评测，使用平均响应时间和并发数来估算
            const estimatedTimePerBatch = progress.averageResponseTime * 1000; // 毫秒
            const batchesRemaining = Math.ceil(remainingItems / actualConcurrency);
            const alternateEstimate = estimatedTimePerBatch * batchesRemaining;
            
            // 在处理初期，更信任基于响应时间的估计
            rawEstimatedTimeRemaining = alternateEstimate;
            
            console.log('初期基于响应时间的估计:', {
              averageResponseTime: progress.averageResponseTime,
              concurrency: actualConcurrency,
              batchesRemaining,
              alternateEstimate
            });
          }
          
          // 安全边界和平滑处理，避免估计值过大或过小的波动
          if (progress.remainingTimeEstimate) {
            // 动态调整平滑系数 - 随着进度增加，更信任当前测量值
            const completionRatio = progress.completed / progress.real_total;
            const currentEstimateWeight = Math.min(0.7, 0.3 + completionRatio * 0.5); // 权重从0.3增加到0.7
            
            // 应用加权平均
            const prevEstimateWeight = 1 - currentEstimateWeight;
            let smoothedEstimate = (prevEstimateWeight * progress.remainingTimeEstimate) + 
                                   (currentEstimateWeight * rawEstimatedTimeRemaining);
            
            // 限制单次变化幅度 - 允许的变化百分比随完成进度增加
            const maxChangePercent = 0.1 + (completionRatio * 0.3); // 从10%增加到40%
            const maxChange = maxChangePercent * progress.remainingTimeEstimate;
            
            if (Math.abs(smoothedEstimate - progress.remainingTimeEstimate) > maxChange) {
              // 限制变化幅度
              const direction = smoothedEstimate > progress.remainingTimeEstimate ? 1 : -1;
              smoothedEstimate = progress.remainingTimeEstimate + (direction * maxChange);
            }
            
            // 确保剩余少量问题时，预估时间不会太长
            if (remainingItems < actualConcurrency * 3 && smoothedEstimate > 60000) {
              smoothedEstimate = Math.min(smoothedEstimate, 60000); // 最多显示1分钟
            }
            
            // 更新估计值
            progress.remainingTimeEstimate = smoothedEstimate;
          } else {
            // 第一次估计，直接使用原始计算值
            progress.remainingTimeEstimate = rawEstimatedTimeRemaining;
          }
          
          // 详细日志
          console.log(`并发优化的精度测试时间计算:`, {
            progress: Math.round(progress.completed / progress.real_total * 100) + '%',
            elapsedMs: elapsedTimeMs,
            questionsPerSecond,
            concurrency: actualConcurrency,
            completed: progress.completed,
            remaining: remainingItems,
            rawEstimateMs: rawEstimatedTimeRemaining,
            finalEstimateMs: progress.remainingTimeEstimate
          });
        }
      }
      
      // 计算已花费时间
      progress.elapsedTime = performance.now() - startTime;
      
      // 更新测试进度 - 修改这部分
      if (progressCallback) {
        // 不要创建新的进度对象，使用现有对象，确保total不被覆盖
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
    
    // 如果提供了问题列表，则使用老的并发方式
    if (questions && questions.length > 0) {
      console.log(`使用预加载的 ${questions.length} 个问题执行精度测试`);
      
      // 更新总数
      updateProgress({ total: questions.length });
      
      // 将评测项准备好
      const preparedQuestions = questions.map((question, index) => ({
        ...question,
        sequence_number: index + 1
      }));
      
      // 启动并发执行
      await executeWithConcurrencyLimit(
        test,
        preparedQuestions,
        modelConfigId,
        updateProgress
      );
    } else {
      console.log(`使用缓冲区管理器从数据集 ${test.dataset_id} 加载精度评测问题`);
      
      // 创建问题缓冲区管理器
      const questionBuffer = new AccuracyQuestionBufferManager(
        test.dataset_id, 
        test.batch_settings?.concurrency || 6,
        test.version,
        (totalQuestions) => {
          console.log(`精度评测缓冲区加载的总问题数: ${totalQuestions}`);
          // 当所有问题加载完毕时更新总数
          updateProgress({ total: totalQuestions });
        }
      );
      
      // 初始化缓冲区，获取总问题数
      const totalQuestions = await questionBuffer.initialize();
      
      // 立即更新进度对象，设置固定的real_total和初始total
      updateProgress({ 
        total: totalQuestions,
        real_total: totalQuestions  // 这是唯一一次设置real_total的地方
      });
      
      // 确保缓冲区至少加载了一个问题，否则抛出错误
      if (questionBuffer.getRemainingCount() === 0 && !questionBuffer.hasMore()) {
        throw new Error(`未能从数据集 ${test.dataset_id} 加载任何精度评测问题`);
      }
      
      // 执行带缓冲区的测试
      await executeWithBufferedAccuracyTest(
        test,
        questionBuffer,
        updateProgress,
        modelConfigId
      );
    }
    
    console.log('精度测试执行完成，通知后端计算汇总指标');
    
    // 修改为包含错误处理的版本
    // try {
    //   await accuracyService.complete(test.id);
    // } catch (completeError) {
    //   // 如果错误是因为测试已完成，我们可以忽略这个错误
    //   if (completeError.response?.data?.detail?.includes('测试状态为completed')) {
    //     console.log('测试已经被标记为完成状态，无需再次完成');
    //   } else {
    //     // 其他类型的错误仍然需要抛出
    //     console.error('完成测试时发生错误:', completeError);
    //   }
    // }
    
    return true;
  } catch (error) {
    console.error('执行精度测试失败:', error);
    
    // 向后端报告失败
    try {
      await accuracyService.fail(test.id, {
        message: error.message,
        stack: error.stack
      });
    } catch (reportError) {
      console.error('报告精度测试失败状态失败:', reportError);
    }
    
    throw error;
  }
} 