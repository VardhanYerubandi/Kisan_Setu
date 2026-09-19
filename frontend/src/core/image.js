/** Shrinks a photo on the phone before upload: max 1024 px JPEG (quality lowered until small enough) plus a 160 px thumbnail. */
export async function compress(file, max = 1024, q = 0.74) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const draw = m => {
      const sc = Math.min(1, m / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * sc); c.height = Math.round(img.naturalHeight * sc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c;
    };
    let image = draw(max).toDataURL('image/jpeg', q);
    while (image.length > 1_100_000 && q > 0.4) { q -= 0.1; image = draw(max).toDataURL('image/jpeg', q); }
    return { image, thumb: draw(160).toDataURL('image/jpeg', 0.7) };
  } finally { URL.revokeObjectURL(url); }
}
