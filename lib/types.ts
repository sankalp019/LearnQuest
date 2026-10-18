export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'beginner' | 'intermediate' | 'advanced';

export type AppRole =
  | 'student'
  | 'teacher'
  | 'campus_admin'
  | 'super_admin';

export interface Profile {
  id: string;
  username: string | null;
  xp: number;
  level: number;
  streak: number;
  role: AppRole;
  campus_id: string | null;
  avatar_url?: string | null;
  last_activity_date?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  subject: string;
  difficulty: Difficulty;
  xp_reward: number;
  is_published: boolean;
  created_at: string;
}

export interface Question {
  id: string;
  challenge_id: string;
  question_text: string;
  options: string[] | unknown;
  position: number;
  points: number;
  created_at?: string;
}

export interface QuizAnswerKey {
  question_id: string;
  correct_answer: string;
}

export interface ChallengeAttempt {
  id: string;
  user_id: string;
  challenge_id: string;
  score: number;
  total_questions?: number;
  xp_earned: number;
  submitted_answers?: Record<string, string>;
  options_snapshot?: Record<string, string[]>;
  completed_at: string;
}

export type ChallengeCompletion = ChallengeAttempt;

export interface QuestionResult {
  questionId: string;
  questionText: string;
  selectedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  points: number;
  explanation?: string;
}

export interface QuizSubmissionResponse {
  ok: boolean;
  message?: string;
  challengeId?: string;
  alreadyCompleted?: boolean;
  totalQuestions?: number;
  correctCount?: number;
  score?: number;
  totalPoints?: number;
  xpEarned?: number;
  results?: QuestionResult[];
  optionsSnapshot?: Record<string, string[]>;
  newTotalXp?: number;
  newLevel?: number;
  error?: string;
}
