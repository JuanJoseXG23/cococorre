/**
 * Reduce una imagen a máximo `size` px y la convierte en data URL (JPEG/WebP).
 * Así se guarda directamente en Firestore (sin Firebase Storage, que exige plan de pago).
 */
export async function imageFileToDataUrl(file: File, size = 256): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('El archivo no es una imagen.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      i.src = url;
    });
    const scale = Math.min(1, size / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    let data = canvas.toDataURL('image/webp', 0.85);
    if (!data.startsWith('data:image/webp')) data = canvas.toDataURL('image/jpeg', 0.85);
    if (data.length > 350_000) throw new Error('La imagen es demasiado grande incluso reducida.');
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}
