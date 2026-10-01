/** Muestra la imagen de una recompensa: emoji, URL o imagen embebida (data:). */
export function RewardImage({ image, alt }: { image: string; alt: string }) {
  if (/^(https:\/\/|data:image\/)/.test(image)) {
    return <img src={image} alt={alt} loading="lazy" />;
  }
  return <span role="img" aria-label={alt}>{image || '🎁'}</span>;
}
