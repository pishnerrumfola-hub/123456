export interface Question {
  id: string;
  content: string;
  options?: string[];
  answer?: string;
  analysis?: string;
  commonPitfalls?: string;
}

export interface WrongQuestionRecord {
  id: string;
  originalQuestion: Question;
  knowledgePoint: string;
  similarQuestions: Question[];
  createdAt: number;
}

export type TabType = 'recognition' | 'notebook';
