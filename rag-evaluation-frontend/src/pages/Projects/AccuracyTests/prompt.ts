/**
 * 精度评估提示模板生成器
 */
export class AccuracyPromptGenerator {
  /**
   * 生成评估提示
   * @param type 评分方法类型：'binary'(二元), 'three_point'(三分), 'five_point'(五分)
   * @param params 提示参数
   * @returns 格式化后的提示字符串
   */
  static generate(
    type: 'binary' | 'three_point' | 'five_point',
    params: {
      question: string;
      reference_answer: string;
      rag_answer: string;
      dimensions: string[];
    }
  ): string {
    switch (type) {
      case 'binary':
        return this.formatPrompt(this.prompt_binary, params);
      case 'three_point':
        return this.formatPrompt(this.prompt_three_point, params);
      case 'five_point':
        return this.formatPrompt(this.prompt_five_point, params);
      default:
        throw new Error(`不支持的评分类型: ${type}`);
    }
  }

  /**
   * 格式化提示模板
   * @param template 提示模板
   * @param params 替换参数
   * @returns 格式化后的提示
   */
  private static formatPrompt(
    template: string,
    params: {
      question: string;
      reference_answer: string;
      rag_answer: string;
      dimensions: string[];
    }
  ): string {
    let formattedPrompt = template
      .replace('{{question}}', params.question)
      .replace('{{reference_answer}}', params.reference_answer)
      .replace(/{{rag_answer}}|{{student_answer}}/g, params.rag_answer)
      .replace('{{dimensions}}', params.dimensions.join(', '));

    // 处理维度占位符
    params.dimensions.forEach((dimension, index) => {
      formattedPrompt = formattedPrompt.replace(
        `{{dimension_${index + 1}}}`,
        dimension
      );
    });

    return formattedPrompt;
  }

  // 二元评分提示模板
  private static readonly prompt_binary = `
你是一位专业的答案准确性审核专家，精通文本比对、事实验证和内容匹配。
你的任务是评估学生回答是否与正确答案保持完全一致，并根据指定维度进行判断。
你擅长使用二元评分（0/1）快速判断回答的正确性。

问题: {{question}}
正确答案: {{reference_answer}}
学生回答: {{rag_answer}}

评分方法: binary  # 0 = 不一致, 1 = 一致 

评估维度: {{dimensions}}

任务要求
-逐个维度判断回答是否与正确答案一致。
-生成总体评分，并提供评估理（不超过10个字）。
-在分析过程中，请逐步思考，但每个步骤的描述尽量简洁（不超过10个字）。
使用分隔符"####"来区分思考过程与最终答案。评分格式为 YAML，格式如下：

思考1:（不超过10个字）
思考2:（不超过10个字）
...
####

\`\`\`yaml

overall_score: [0或1]

dimension_scores:

  - {{dimension_1}}: [0或1]

  - {{dimension_2}}: [0或1]

evaluation_reason: |

  - 针对各维度的详细评分理由。

  - 指出回答与正确答案是否存在差异，并说明原因。

\`\`\`
`;

  // 三分量表评分提示模板
  private static readonly prompt_three_point = `
你是一位专业的答案准确性审核专家，精通文本比对、事实验证和内容匹配。
你的任务是评估学生回答是否与正确答案保持一致，并根据指定维度进行判断。
你擅长使用三分量表（0-2）进行部分匹配度的细致评估。

问题: {{question}}
正确答案: {{reference_answer}}
学生回答: {{rag_answer}}

评分方法: three_point  # 0 = 不匹配, 1 = 部分匹配, 2 = 完全匹配
评估维度: {{dimensions}}  

任务要求
- 逐个维度判断回答与正确答案的匹配程度。
- 生成总体评分，并提供评估理由（不超过10个字）。
- 在分析过程中，请逐步思考，但每个步骤的描述尽量简洁（不超过10个字）。
- 使用分隔符"####"来区分思考过程与最终答案。

思考1:（不超过10个字）
思考2:（不超过10个字）
...
####

\`\`\`yaml
overall_score: [0-2的平均分]
dimension_scores:
  - {{dimension_1}}: [0-2]
  - {{dimension_2}}: [0-2]
evaluation_reason: |
  - 针对各维度的详细评分理由。
  - 说明回答与正确答案的匹配情况，并解释原因。
\`\`\`
`;

  // 五分量表评分提示模板
  private static readonly prompt_five_point = `
你是一位专业的答案准确性审核专家，精通文本比对、事实验证和内容匹配。
你的任务是评估学生回答是否与正确答案保持一致，并根据指定维度进行判断。
你擅长使用五分量表（0-4）进行精细化评估。

问题: {{question}}
正确答案: {{reference_answer}}
学生回答: {{rag_answer}}

评分方法: five_point  # 0 = 完全不匹配, 1 = 大部分错误, 2 = 一般, 3 = 基本正确, 4 = 完全正确
评估维度: {{dimensions}}

## 任务要求
- 逐个维度判断回答的匹配程度，并细致打分。
- 生成总体评分，并提供评估理由（不超过10个字）。
- 在分析过程中，请逐步思考，但每个步骤的描述尽量简洁（不超过10个字）。
- 使用分隔符"####"来区分思考过程与最终答案。

思考1:（不超过10个字）
思考2:（不超过10个字）
...
####

\`\`\`yaml
overall_score: [0-4的平均分]
dimension_scores:
  - {{dimension_1}}: [0-4]
  - {{dimension_2}}: [0-4]
evaluation_reason: |
  - 针对各维度的详细评分理由。
  - 说明回答与正确答案的匹配情况，并解释原因。
\`\`\`
`;
}