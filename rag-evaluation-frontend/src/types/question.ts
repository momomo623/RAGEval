export interface BatchDeleteRequest {
  question_ids: string[];
}

export interface QuestionCreate {
  question_text: string;
  standard_answer: string;
  category?: string;
  difficulty?: string;
  type?: string;
  tags?: string[];
  question_metadata?: Record<string, any>;
}

export interface QuestionUpdate {
  question_text?: string;
  standard_answer?: string;
  category?: string;
  difficulty?: string;
  type?: string;
  tags?: string[];
  question_metadata?: Record<string, any>;
} 