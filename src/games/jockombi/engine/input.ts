/**
 * Controles de salto con un solo botón.
 *  - Teclado: Espacio, Flecha arriba o W (mantener = salto largo).
 *  - Ratón: clic izquierdo sobre el juego.  - Táctil: tocar la pantalla.
 *  - P o Escape: pausa.
 *
 * Teclado y puntero se combinan en un único estado "pulsado": el salto se
 * dispara sólo al pasar de suelto a pulsado, así nunca se ejecuta dos veces
 * aunque el navegador envíe eventos de teclado y de puntero a la vez.
 * Sólo se escuchan eventos `pointer*` (no mouse* ni touch*), que ya unifican
 * ratón y pantalla táctil.
 */
const JUMP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW']);
const PAUSE_KEYS = new Set(['KeyP', 'Escape']);

export interface InputHandlers {
  onPress: () => void;
  onRelease: () => void;
  onPause: () => void;
}

export function attachJumpInput(target: HTMLElement, h: InputHandlers): () => void {
  let keyDown = false;
  const pointers = new Set<number>();
  let held = false;

  const sync = () => {
    const now = keyDown || pointers.size > 0;
    if (now === held) return;
    held = now;
    if (now) h.onPress();
    else h.onRelease();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (JUMP_KEYS.has(e.code)) {
      e.preventDefault();
      if (e.repeat) return;
      keyDown = true;
      sync();
    } else if (PAUSE_KEYS.has(e.code) && !e.repeat) {
      e.preventDefault();
      h.onPause();
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (!JUMP_KEYS.has(e.code)) return;
    e.preventDefault();
    keyDown = false;
    sync();
  };
  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      /* algunos navegadores no lo permiten */
    }
    pointers.add(e.pointerId);
    sync();
  };
  const onPointerUp = (e: PointerEvent) => {
    if (!pointers.delete(e.pointerId)) return;
    sync();
  };
  /** Al perder el foco se sueltan todos los botones (evita un salto "pegado"). */
  const reset = () => {
    keyDown = false;
    pointers.clear();
    sync();
  };
  const prevent = (e: Event) => e.preventDefault();

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', reset);
  target.addEventListener('pointerdown', onPointerDown);
  target.addEventListener('pointerup', onPointerUp);
  target.addEventListener('pointercancel', onPointerUp);
  target.addEventListener('lostpointercapture', onPointerUp);
  target.addEventListener('contextmenu', prevent);
  target.addEventListener('touchmove', prevent, { passive: false });

  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', reset);
    target.removeEventListener('pointerdown', onPointerDown);
    target.removeEventListener('pointerup', onPointerUp);
    target.removeEventListener('pointercancel', onPointerUp);
    target.removeEventListener('lostpointercapture', onPointerUp);
    target.removeEventListener('contextmenu', prevent);
    target.removeEventListener('touchmove', prevent);
  };
}
