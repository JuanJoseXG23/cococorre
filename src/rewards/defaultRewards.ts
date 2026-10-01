import type { RewardInput } from '../firebase/rewards';

/**
 * Catálogo de recompensas. Funciona como una ESCALERA (campo `order`):
 * al reclamar una, todas las anteriores que no se hayan reclamado se
 * bloquean para siempre (lo validan las reglas de Firestore).
 *
 * Referencia de costos: una partida normal da ~40–80 puntos y una muy buena
 * 150 o más. Las primeras se consiguen en pocos días de juego; de la 10 en
 * adelante son metas largas (semanas).
 */
type Item = [id: string, name: string, description: string, cost: number, difficulty: RewardInput['difficulty'], image: string];

const ITEMS: Item[] = [
  ['abrazo', 'Un abrazo', 'Un abrazo largo, de esos que arreglan cualquier día.', 150, 'facil', '🤗'],
  ['beso', 'Un beso', 'Un beso cuando tú quieras, sin fecha de vencimiento.', 300, 'facil', '💋'],
  ['dulce', 'Un dulce', 'Un dulce sorpresa, escogido con cariño.', 500, 'facil', '🍬'],
  ['nucita', 'Una Nucita', 'Una Nucita para endulzar la tarde.', 750, 'media', '🥜'],
  ['gol', 'Una Gol', 'Una chocolatina Gol... ¡golazo!', 1000, 'media', '⚽'],
  ['chocolatina', 'Una chocolatina', 'La chocolatina que más te guste.', 1300, 'media', '🍫'],
  ['helado', 'Un helado', 'Un helado del sabor que quieras, para comerlo juntos.', 1700, 'media', '🍦'],
  ['mandingas', 'Unas mandingas', 'Unas mandingas para compartir (o no).', 2200, 'dificil', '🍿'],
  ['kitchen', 'Unas Kitchen', 'Unas Kitchen para antojarnos juntos.', 2800, 'dificil', '🍪'],
  ['crepes', 'Crepes & Waffles', 'Una visita a Crepes & Waffles, tú escoges el postre.', 5000, 'dificil', '🧇'],
  ['cine', 'Ida a cine', 'Una ida a cine con crispetas incluidas.', 8000, 'epica', '🎬'],
  ['camisa', 'Una camisa', 'Una camisa nueva, a tu gusto.', 12000, 'epica', '👕'],
  ['molinos', 'Ir a saltar a los Molinos', 'Una tarde saltando en los Molinos.', 17000, 'epica', '🤸'],
  ['salida', 'Una salida con almuerzo', 'Un día completo para los dos, con almuerzo incluido.', 24000, 'epica', '🍽️'],
];

export const DEFAULT_REWARDS: { id: string; data: RewardInput }[] = ITEMS.map(
  ([id, name, description, cost, difficulty, image], i) => ({
    id,
    data: { name, description, cost, difficulty, image, active: true, order: i + 1 },
  }),
);
