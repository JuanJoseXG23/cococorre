import type { RewardInput } from '../firebase/rewards';

/** Recompensas iniciales. El administrador las carga con un botón y luego puede editarlas. */
export const DEFAULT_REWARDS: { id: string; data: RewardInput }[] = [
  {
    id: 'abrazo',
    data: {
      name: 'Un abrazo',
      description: 'Un abrazo gigante, de esos que duran mucho y arreglan todo.',
      cost: 80, difficulty: 'facil', image: '🤗', active: true, order: 1,
    },
  },
  {
    id: 'beso',
    data: {
      name: 'Un beso',
      description: 'Un beso cuando tú quieras. Sin fecha de vencimiento.',
      cost: 150, difficulty: 'facil', image: '💋', active: true, order: 2,
    },
  },
  {
    id: 'nucita',
    data: {
      name: 'Una Nucita',
      description: 'Una Nucita para endulzar el día.',
      cost: 300, difficulty: 'media', image: '🍫', active: true, order: 3,
    },
  },
  {
    id: 'gol',
    data: {
      name: 'Una Gol',
      description: 'Una chocolatina Gol... ¡golazo!',
      cost: 400, difficulty: 'dificil', image: '⚽', active: true, order: 4,
    },
  },
  {
    id: 'helado',
    data: {
      name: 'Un helado',
      description: 'Un helado del sabor que quieras, para comerlo juntos.',
      cost: 600, difficulty: 'epica', image: '🍦', active: true, order: 5,
    },
  },
];
