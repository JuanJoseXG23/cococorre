import type { ComponentType } from 'react';
import type { Screen } from './navigation';
import { cococorreGame } from '../games/cococorre/entry';
import { zombieRushGame } from '../games/zombie-rush/entry';

/**
 * Registro central de juegos de la plataforma. El menú principal se
 * construye sólo a partir de esta lista: para agregar un juego nuevo,
 * crea su módulo en src/games/<juego>/, exporta un GameEntry y añádelo aquí
 * (y su pantalla en platform/navigation.ts + App.tsx).
 */
export interface GameEntry {
  id: string;
  name: string;
  /** Frase corta bajo el nombre. */
  tagline: string;
  description: string;
  /** Pantalla que abre el botón "Jugar". */
  screen: Screen;
  /** Colores de la tarjeta (degradado de la portada y acento del botón). */
  theme: { from: string; to: string; accent: string; accentDark: string; dark?: boolean };
  /** Ilustración de la portada. */
  Cover: ComponentType;
  /** Indicadores de progreso del usuario en este juego. */
  Progress: ComponentType;
  badge?: string;
}

export const GAMES: GameEntry[] = [cococorreGame, zombieRushGame];
