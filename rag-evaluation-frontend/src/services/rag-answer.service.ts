import { api } from '../utils/api';
import { RagAnswer, CreateRagAnswerRequest } from '../types/dataset';

// 定义RAG回答服务
export const ragAnswerService = {
  // 获取指定版本的RAG回答
  async getRagAnswerByVersion(questionId: string, version: string): Promise<RagAnswer> {
    try {
      const response = await api.get(`/v1/rag-answers/question/${questionId}/version/${version}`);
      return response;
    } catch (error) {
      console.error('获取RAG回答失败:', error);
      throw error;
    }
  },

  // 获取问题的所有版本RAG回答
  async getAllRagAnswerVersions(questionId: string): Promise<RagAnswer[]> {
    try {
      const response = await api.get(`/v1/rag-answers/question/${questionId}/versions`);
      return response;
    } catch (error) {
      console.error('获取RAG回答版本失败:', error);
      return [];
    }
  },

  // 创建RAG回答
  async createRagAnswer(ragAnswer: CreateRagAnswerRequest): Promise<RagAnswer> {
    try {
      const response = await api.post('/v1/rag-answers', ragAnswer);
      return response;
    } catch (error) {
      console.error('创建RAG回答失败:', error);
      throw error;
    }
  },

  // 更新RAG回答
  async updateRagAnswer(id: string, ragAnswer: Partial<CreateRagAnswerRequest>): Promise<RagAnswer> {
    try {
      const response = await api.put(`/v1/rag-answers/${id}`, ragAnswer);
      return response;
    } catch (error) {
      console.error('更新RAG回答失败:', error);
      throw error;
    }
  },

  // 删除RAG回答
  async deleteRagAnswer(id: string): Promise<void> {
    try {
      await api.delete(`/v1/rag-answers/${id}`);
    } catch (error) {
      console.error('删除RAG回答失败:', error);
      throw error;
    }
  },

  // 获取问题的所有RAG回答
  async getQuestionRagAnswers(questionId: string): Promise<RagAnswer[]> {
    try {
      const response = await api.get(`/v1/rag-answers/question/${questionId}`);
      return response;
    } catch (error) {
      console.error('获取问题RAG回答失败:', error);
      return [];
    }
  },

  // 批量收集RAG回答
  async collectRagAnswers(projectId: string, questionIds: string[], apiConfig: any): Promise<any> {
    try {
      const response = await api.post('/v1/rag-answers/collect', {
        project_id: projectId,
        question_ids: questionIds,
        api_config: apiConfig,
        concurrent_requests: 5,
        source_system: 'RAG系统'
      });
      return response;
    } catch (error) {
      console.error('批量收集RAG回答失败:', error);
      throw error;
    }
  },

  // 批量导入RAG回答
  async importRagAnswers(projectId: string, answers: any[]): Promise<any> {
    try {
      const response = await api.post('/v1/rag-answers/import', {
        project_id: projectId,
        answers,
        source_system: '手动导入'
      });
      return response;
    } catch (error) {
      console.error('批量导入RAG回答失败:', error);
      throw error;
    }
  }
}; 