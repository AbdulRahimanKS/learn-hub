export type UserRole = 'admin' | 'teacher' | 'student';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  batchId?: string;
}

export interface Batch {
  id: string;
  name: string;
  description: string;
  teacherId: string;
  studentIds: string[];
  createdAt: Date;
}

export interface Video {
  id: string;
  title: string;
  description: string;
  url: string;
  thumbnail: string;
  duration: string;
  weekNumber: number;
  order: number;
  isScheduled: boolean;
  scheduledAt?: Date;
  createdAt: Date;
}

export interface Assessment {
  id: string;
  title: string;
  description: string;
  type: 'post-class' | 'weekly';
  weekNumber: number;
  questions: Question[];
  passingScore: number;
  dueDate?: Date;
  createdAt: Date;
}

export interface Question {
  id: string;
  type: 'mcq' | 'fill-blank' | 'file-upload';
  question: string;
  options?: string[];
  correctAnswer?: string;
  points: number;
  imageUrl?: string;
}

export interface Submission {
  id: string;
  assessmentId: string;
  studentId: string;
  answers: Answer[];
  score?: number;
  feedback?: string;
  submittedAt: Date;
  evaluatedAt?: Date;
  isAutoEvaluated: boolean;
}

export interface Answer {
  questionId: string;
  answer: string | File;
}

export interface WeekProgress {
  weekNumber: number;
  isUnlocked: boolean;
  videosCompleted: number;
  totalVideos: number;
  assessmentScore?: number;
  isPassed: boolean;
}

export interface LiveSession {
  id: string;
  title: string;
  description: string;
  scheduledAt: Date;
  batchId: string;
  hostId: string;
  isRecorded: boolean;
  status: 'scheduled' | 'live' | 'ended';
}

export interface ChatMessage {
  id: string;
  batchId: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: Date;
}
