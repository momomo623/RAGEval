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
}

/**
 * 构建评测提示词
 */
function buildPrompt(
  question: string,
  referenceAnswer: string,
  ragAnswer: string,
  promptTemplate: string,
  scoringMethod: string,
  dimensions: string[]
): string {
  // 替换提示词模板中的占位符
  let prompt = promptTemplate
    .replace('{{question}}', question)
    .replace('{{reference_answer}}', referenceAnswer)
    .replace('{{rag_answer}}', ragAnswer);

  // 添加评分方法说明
  let scoringInstructions = '';
  switch (scoringMethod) {
    case 'binary':
      scoringInstructions = '使用二元评分法：正确(1分)或错误(0分)';
      break;
    case 'three_scale':
      scoringInstructions = '使用三分量表评分法：错误(0分)、部分正确(1分)或完全正确(2分)';
      break;
    case 'five_scale':
      scoringInstructions = '使用五分量表评分法：从1分(完全不正确)到5分(完全正确)';
      break;
  }
  
  prompt = prompt.replace('{{scoring_method}}', scoringInstructions);
  
  // 添加评测维度说明
  let dimensionsText = dimensions.join('、');
  prompt = prompt.replace('{{dimensions}}', dimensionsText);
  
  return prompt;
}

/**
 * 执行LLM评测
 */
async function evaluateWithLLM(
  prompt: string,
  modelConfig: any
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
 * 解析评测结果
 */
function parseEvaluationResult(
  result: any,
  dimensions: string[],
  scoringMethod: string
): {
  overallScore: number;
  dimensionScores: Record<string, number>;
  evaluationReason: string;
} {
  const content = result.choices[0]?.message?.content || '';
  
  // 从文本中提取分数和理由
  const scorePattern = /(?:总[体分]|整[体体])?评分[：:]\s*(\d+(?:\.\d+)?)/i;
  const scoreMatch = content.match(scorePattern);
  let overallScore = 0;

  if (scoreMatch && scoreMatch[1]) {
    overallScore = parseFloat(scoreMatch[1]);
  }
  
  // 如果是二元评分，转换为0或1
  if (scoringMethod === 'binary') {
    overallScore = overallScore > 0.5 ? 1 : 0;
  }
  
  // 提取各维度分数
  const dimensionScores: Record<string, number> = {};
  dimensions.forEach(dimension => {
    const dimensionName = dimension.toLowerCase();
    const dimensionPattern = new RegExp(`${dimensionName}[评分]+[：:]*\\s*(\\d+(?:\\.\\d+)?)`);
    const match = content.match(dimensionPattern);
    
    if (match && match[1]) {
      dimensionScores[dimension] = parseFloat(match[1]);
      // 二元评分法转换
      if (scoringMethod === 'binary') {
        dimensionScores[dimension] = dimensionScores[dimension] > 0.5 ? 1 : 0;
      }
    } else {
      // 默认值
      dimensionScores[dimension] = overallScore;
    }
  });
  
  // 提取评测理由
  let evaluationReason = content;
  const reasonPattern = /(?:理由|分析|解释)[：:]\s*([\s\S]+)(?:\n|$)/i;
  const reasonMatch = content.match(reasonPattern);
  
  if (reasonMatch && reasonMatch[1]) {
    evaluationReason = reasonMatch[1].trim();
  }
  
  return {
    overallScore,
    dimensionScores,
    evaluationReason
  };
}

/**
 * 处理单个评测项
 */
async function processEvaluationItem(
  item: any,
  test: any,
  modelConfig: any
): Promise<any> {
  try {
    const prompt = buildPrompt(
      item.question_content,
      item.reference_answer,
      item.rag_answer_content,
      test.prompt_template,
      test.scoring_method,
      test.dimensions
    );
    
    // 调用LLM进行评测
    const llmResponse = await evaluateWithLLM(prompt, modelConfig);
    
    // 解析评测结果
    const { overallScore, dimensionScores, evaluationReason } = parseEvaluationResult(
      llmResponse,
      test.dimensions,
      test.scoring_method
    );
    
    // 构建评测项结果
    return {
      id: item.id,
      ai_score: overallScore,
      ai_dimension_scores: dimensionScores,
      ai_evaluation_reason: evaluationReason,
      ai_evaluation_time: new Date().toISOString(),
      ai_raw_response: llmResponse,
      status: test.evaluation_type === 'ai' ? 'ai_completed' : 'ai_completed',
      // 对于纯AI评测，最终结果直接使用AI评测结果
      ...(test.evaluation_type === 'ai' ? {
        final_score: overallScore,
        final_dimension_scores: dimensionScores,
        final_evaluation_reason: evaluationReason,
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
 * 批量处理评测项
 */
async function processBatch(
  items: any[],
  test: any,
  progressCallback?: (progress: TestProgress) => void,
  progressState: TestProgress
): Promise<any[]> {
  const modelConfig = test.model_config || {};
  const results = [];
  
  // 顺序处理批次中的每个项目
  for (const item of items) {
    try {
      const result = await processEvaluationItem(item, test, modelConfig);
      results.push(result);
      
      // 更新进度
      progressState.completed += 1;
      if (result.status === 'failed') {
        progressState.failed += 1;
      } else {
        progressState.success += 1;
      }
      
      if (progressCallback) {
        progressCallback({...progressState});
      }
    } catch (error) {
      console.error('评测项处理失败:', error);
      results.push({
        id: item.id,
        status: 'failed',
        error_message: error.message
      });
      
      progressState.completed += 1;
      progressState.failed += 1;
      
      if (progressCallback) {
        progressCallback({...progressState});
      }
    }
  }
  
  return results;
}

/**
 * 执行精度测试
 */
export const executeAccuracyTest = async (
  test: any,
  items: any[],
  progressCallback?: (progress: TestProgress) => void
): Promise<boolean> => {
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
      total: items.length,
      completed: 0,
      success: 0,
      failed: 0,
      startTime: performance.now(),
      currentBatch: 0,
      totalBatches: 0
    };
    
    // 开始测试前通知后端
    await accuracyService.start({ accuracy_test_id: test.id });
    
    // 获取LLM配置
    const llmConfig = getLLMConfig();
    if (!llmConfig) {
      throw new Error('精度测试需要LLM配置，请先配置大模型API');
    }
    
    // 批量处理设置
    const batchSize = test.batch_settings?.batch_size || 5;
    const batches = [];
    
    // 将项目分成批次
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    
    progressState.totalBatches = batches.length;
    
    if (progressCallback) {
      progressCallback({...progressState});
    }
    
    // 逐批处理评测项
    for (let i = 0; i < batches.length; i++) {
      progressState.currentBatch = i + 1;
      
      const batchResults = await processBatch(
        batches[i],
        test,
        progressCallback,
        progressState
      );
      
      // 将批次结果提交到后端
      await accuracyService.submitItemResults(test.id, batchResults);
    }
    
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
}; 