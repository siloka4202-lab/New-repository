export interface ProjectData {
  topic: string;
  subject: string;
  grade: string;
  pageCount: number;
  difficulty: number;
  hasPractical: boolean;
  hasHypothesis: boolean;
  sourceCount: number;
  studentName: string;
  school: string;
  teacher: string;
  city: string;
  year: string;
}

export enum GenerationStatus {
  IDLE = 'IDLE',
  GENERATING_TEXT = 'GENERATING_TEXT',
  CONVERTING_PDF = 'CONVERTING_PDF',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}

export interface ApiResponse {
  success: boolean;
  message?: string;
  pdfUrl?: string; // This would be a blob URL in the frontend
}