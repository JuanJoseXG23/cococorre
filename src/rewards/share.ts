import { GAME_NAME } from '../config';

/** Dirección pública del juego (la misma página, sin #pantalla). */
function gameUrl(): string {
  return `${location.origin}${location.pathname}`;
}

export function rewardShareText(rewardName: string, image?: string): string {
  // Sólo se incluye la imagen si es un emoji (no una URL ni una foto subida).
  const emoji = image && !/^(https?:|data:)/.test(image) ? ` ${image}` : '';
  return (
    `¡Gané una recompensa en ${GAME_NAME}! 🎁\n\n` +
    `Desbloqueé: *${rewardName}*${emoji}\n\n` +
    `Juega tú también: ${gameUrl()}`
  );
}

/**
 * Abre WhatsApp con el mensaje listo para enviar. wa.me funciona en celular
 * (abre la app) y en computador (WhatsApp Web / Escritorio).
 */
export function shareOnWhatsApp(rewardName: string, image?: string): void {
  const url = `https://wa.me/?text=${encodeURIComponent(rewardShareText(rewardName, image))}`;
  window.open(url, '_blank', 'noopener');
}
