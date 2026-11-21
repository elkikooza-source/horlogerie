/**
 * Compresses and resizes an uploaded image client-side before sending it to the server.
 * Converts large camera photos into lightweight WebP assets (~80–150 KB) while preserving
 * transparency (for logos) and falling back safely to the original file if unsupported.
 */
export async function compressImageFile(
  file: File,
  options: { maxDimension?: number; quality?: number } = {}
): Promise<File> {
  const { maxDimension = 1400, quality = 0.84 } = options;

  if (!file.type.startsWith('image/') || typeof document === 'undefined') {
    return file;
  }

  // Already tiny (< 120 KB) and WebP/JPEG -> keep as-is
  if (file.size > 0 && file.size <= 120 * 1024 && (file.type === 'image/webp' || file.type === 'image/jpeg')) {
    return file;
  }

  try {
    const img = await loadImage(file);
    const { width, height } = img;
    if (!width || !height) return file;

    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', quality)
    );

    if (!blob || blob.size >= file.size) {
      return file;
    }

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${baseName}.webp`, {
      type: 'image/webp',
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image decode error'));
    };
    img.src = url;
  });
}
