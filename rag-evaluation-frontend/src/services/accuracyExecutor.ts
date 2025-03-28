// import { getLLMConfig } from '../utils/configStorage';
import { useConfigContext } from '../contexts/ConfigContext';

import OpenAI from 'openai';
import { accuracyService } from './accuracy.service';

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
}

/**
 * 构建评测提示词
 */
function buildPrompt(
  question: string,
  referenceAnswer: string,
  ragAnswer: string,
  promptTemplate: string,
  // scoringMethod: string,
  // dimensions: string[]
): string {
  // 替换提示词模板中的占位符
  let prompt = promptTemplate
    .replace('{{question}}', question)
    .replace('{{reference_answer}}', referenceAnswer)
    .replace('{{rag_answer}}', ragAnswer);

  // 添加评分方法说明
  // let scoringInstructions = '';
  // switch (scoringMethod) {
  //   case 'binary':
  //     scoringInstructions = '使用二元评分法：正确(1分)或错误(0分)';
  //     break;
  //   case 'three_scale':
  //     scoringInstructions = '使用三分量表评分法：错误(0分)、部分正确(1分)或完全正确(2分)';
  //     break;
  //   case 'five_scale':
  //     scoringInstructions = '使用五分量表评分法：从1分(完全不正确)到5分(完全正确)';
  //     break;
  // }
  
  // prompt = prompt.replace('{{scoring_method}}', scoringInstructions);
  
  // // 添加评测维度说明
  // let dimensionsText = dimensions.join('、');
  // prompt = prompt.replace('{{dimensions}}', dimensionsText);
  
  return prompt;
}

/**
 * 执行LLM评测
 */
async function evaluateWithLLM(
  prompt: string,
  modelConfig: any,
  getLLMConfig: () => any
): Promise<any> {
  const llmConfig = getLLMConfig();
  if (!llmConfig) {
    throw new Error('缺少LLM配置，请先配置大模型API');
  }

  // 创建OpenAI客户端
  const openai = new OpenAI({
    apiKey: llmConfig.apiKey,
    baseURL: llmConfig.baseUrl,
    dangerouslyAllowBrowser: true // 在浏览器中使用
  });

  // 调用LLM API
  const completion = await openai.chat.completions.create({
    model: llmConfig.modelName || modelConfig.model_name || 'gpt-4',
    messages: [
      { role: "system", content: "你是一个专业的RAG回答评估专家，你的任务是评估生成式AI的回答质量。请根据提供的标准答案评价RAG系统的回答质量，分析其准确性、相关性和完整性。" },
      { role: "user", content: prompt }
    ],
    temperature: modelConfig.temperature || 0.2,
    max_tokens: modelConfig.max_tokens || 1000,
    top_p: modelConfig.top_p || 1
  });

  return completion;
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
  item_metadata:string
} {
  try {
    // 查找分隔符 #### 并获取其之后的内容
    const parts = modelResponse.split('####');
    if (parts.length < 2) {
      console.error('大模型返回内容格式不正确: 未找到分隔符');
      return { overall_score: 0, dimension_scores: {}, evaluation_reason: '解析错误' };
    }
    
    // 获取YAML部分的文本
    const yamlText = parts[1].trim();
    
    // 提取YAML内容 (去掉\```yaml和\```包装)
    const yamlMatch = yamlText.match(/```yaml\s*([\s\S]*?)\s*```/);
    if (!yamlMatch) {
      console.error('大模型返回内容格式不正确: 未找到YAML代码块');
      return { overall_score: 0, dimension_scores: {}, evaluation_reason: '解析错误' };
    }
    
    const yamlContent = yamlMatch[1].trim();
    
    // 解析YAML内容
    const lines = yamlContent.split('\n');
    const result: any = {
      overall_score: 0,
      dimension_scores: {},
      evaluation_reason: '',
      item_metadata: ''
    };
    
    let inReasonBlock = false;
    let reasonLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 解析总分
      if (line.startsWith('overall_score:')) {
        result.overall_score = parseFloat(line.split(':')[1].trim());
      }
      // 开始解析各维度分数
      else if (line.startsWith('dimension_scores:')) {
        // 维度评分在下面的行中
        continue;
      }
      // 解析各维度分数行
      else if (line.startsWith('-')) {
        const dimensionMatch = line.match(/- (.*?):\s*([0-9.]+)/);
        if (dimensionMatch) {
          const [, dimension, score] = dimensionMatch;
          result.dimension_scores[dimension] = parseFloat(score);
        }
      }
      // 开始评估理由块
      else if (line.startsWith('evaluation_reason:')) {
        inReasonBlock = true;
        continue;
      }
      // 解析评估理由内容
      else if (inReasonBlock) {
        if (line.startsWith('  - ')) {
          reasonLines.push(line.substring(4));
        } else {
          reasonLines.push(line);
        }
      }
    }
    
    result.evaluation_reason = reasonLines.join('\n').trim();
    result.item_metadata = modelResponse;
    return result;
  } catch (error) {
    console.error('解析评估结果出错:', error);
    return { overall_score: 0, dimension_scores: {}, evaluation_reason: '解析错误: ' + error, item_metadata: '' };
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
 * 解析评测结果
 */
function parseEvaluationResult(
  response: any,
  // dimensions: string[],
  scoringMethod: string
): { overallScore: number, dimensionScores: Record<string, number>, evaluationReason: string } {
  const content = response.choices[0].message.content;

  console.log("大模型问答", content)
//   大模型问答 思考1: 学生未提供具体数据  
// 思考2: 回答与问题无关  
// 思考3: 事实准确性完全缺失  

// ####

// ```yaml
// overall_score: 0
// dimension_scores:
//   - 事实准确性: 0
// evaluation_reason: |
//   - 学生未回答具体数据，完全偏离问题。
//   - 回答内容与正确答案无任何匹配。

  // return { overallScore, dimensionScores, evaluationReason };
}

/**
 * 处理单个评测项
 */
async function processEvaluationItem(
  item: any,
  test: any,
  modelConfig: any,
  getLLMConfig: () => any
): Promise<any> {
  try {
    console.log(`处理评测项: ${item.id}`, item);
    
    const prompt = buildPrompt(
      item.question_text,
      item.standard_answer,
      item.rag_answers[0].answer,
      test.prompt_template,
      // test.scoring_method,
      // test.dimensions
    );
    console.log("prompt", prompt)
    
    const startTime = performance.now();
    
    // 调用LLM进行评测
    const llmResponse = await evaluateWithLLM(prompt, modelConfig, getLLMConfig);
    
    const processingTime = performance.now() - startTime;
    
    // 解析评测结果
    const { overall_score, dimension_scores, evaluation_reason, item_metadata } = extractEvaluationResult(llmResponse.choices[0].message.content);
    
    // 构建评测项结果
    return {
      id: item.id,
      ai_score: overall_score,
      ai_dimension_scores: dimension_scores,
      ai_evaluation_reason: evaluation_reason,
      ai_evaluation_time: new Date().toISOString(),
      ai_raw_response: llmResponse.choices[0].message.content,
      status: test.evaluation_type === 'ai' ? 'ai_completed' : 'ai_completed',
      processing_time: processingTime,
      item_metadata: item_metadata, // 原始回答
      // 对于纯AI评测，最终结果直接使用AI评测结果
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
  modelConfig: any,
  progressCallback: (progress: TestProgress) => void,
  getLLMConfig: () => any
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
      const result = await processEvaluationItem(question, test, modelConfig, getLLMConfig);
      
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
        progress.averageResponseTime = times.reduce((a, b) => a + b, 0) / times.length;
        
        // 计算剩余时间估计
        if (progress.total > 0) {
          const remainingItems = progress.total - progress.completed;
          const elapsedTime = performance.now() - startTime;
          const timePerItem = elapsedTime / progress.completed;
          progress.remainingTimeEstimate = remainingItems * timePerItem;
        }
      }
      
      // 更新进度回调
      progressCallback(progress);
      
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

/**
 * 执行精度测试
 */
export async function executeAccuracyTest(
  test: any,
  questions: any[],
  onProgressUpdate: (progress: TestProgress) => void,
  getLLMConfig: () => any
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
      total: questions.total,
      completed: 0,
      success: 0,
      failed: 0,
      startTime: performance.now()
    };
    
    // 开始测试前通知后端
    await accuracyService.start({ accuracy_test_id: test.id });
    
    // 获取LLM配置
    const llmConfig = getLLMConfig();
    if (!llmConfig) {
      throw new Error('精度测试需要LLM配置，请先配置大模型API');
    }
    
    // 将评测项准备好
    const preparedQuestions = questions.map((question, index) => ({
      ...question,
      sequence_number: index + 1
    }));
    
    // 启动并发执行
    await executeWithConcurrencyLimit(
      test,
      preparedQuestions,
      test.model_config_test || {},
      onProgressUpdate,
      getLLMConfig
    );
    
    // 完成测试
    await accuracyService.complete(test.id);
    
    return true;
  } catch (error) {
    console.error('执行精度测试失败:', error);
    
    // 标记测试为失败
    try {
      await accuracyService.fail(test.id, { 
        message: error.message,
        stack: error.stack
      });
    } catch (failError) {
      console.error('标记测试为失败状态时出错:', failError);
    }
    
    throw error;
  }
} 