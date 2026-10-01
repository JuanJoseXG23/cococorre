import type { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  username: string;
  usernameLower: string;
  /** Saldo disponible para recompensas. */
  points: number;
  highScore: number;
  gamesPlayed: number;
  lastScore: number;
  claimedCount: number;
  lastClaim: string | null;
  /** `order` de la recompensa más alta reclamada (escalera). */
  maxOrder?: number;
  /** Corazones recogidos en total (desbloquean personajes; no se gastan). */
  heartsTotal?: number;
  /** Última partida cuyos corazones ya se sumaron. */
  heartsGame?: number;
  createdAt: Timestamp | null;
  lastGameAt: Timestamp | null;
}

export type RewardDifficulty = 'facil' | 'media' | 'dificil' | 'epica';

export interface Reward {
  id: string;
  name: string;
  description: string;
  cost: number;
  difficulty: RewardDifficulty;
  /** Un emoji, una URL https://... o una imagen data:image/... */
  image: string;
  active: boolean;
  order: number;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface Claim {
  id: string;
  userId: string;
  username: string;
  rewardId: string;
  rewardName: string;
  cost: number;
  claimedAt: Timestamp | null;
}

export interface GameRecord {
  id: string;
  userId: string;
  username: string;
  score: number;
  playedAt: Timestamp | null;
}

export interface GameConfig {
  /** Multiplicador de velocidad de obstáculos (0.7 = más fácil, 1.3 = más difícil). */
  speedMultiplier: number;
  /** Cada cuántos puntos aparece un mensaje de ánimo. */
  milestoneEvery: number;
  milestoneMessages: string[];
  recordMessage: string;
  claimMessage: string;
  welcomeMessage: string;
}

export const DEFAULT_CONFIG: GameConfig = {
  speedMultiplier: 1,
  milestoneEvery: 25,
  milestoneMessages: [
    '¡Muy bien! Cada vez estás más cerca de desbloquear algo especial...',
    'Coco está orgulloso de ti.',
    '¡Imparable! Sigue así, mi amor.',
    'Cada paso cuenta... y tú vas volando.',
    'Mmm... huele a recompensa cerca.',
  ],
  recordMessage: 'Sabía que podías hacerlo.',
  claimMessage: '¡Guárdala para cuando nos veamos!',
  welcomeMessage: '¡Hola, mi amor! Coco te estaba esperando.',
};

export const DIFFICULTY_LABELS: Record<RewardDifficulty, string> = {
  facil: 'Fácil',
  media: 'Media',
  dificil: 'Difícil',
  epica: 'Épica',
};
