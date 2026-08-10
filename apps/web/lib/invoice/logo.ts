/**
 * Preparing a logo for the invoice.
 *
 * The naive version of this feature reads the file, notices it is 8 MB and
 * tells the user off. But 8 MB is what a phone camera or an untouched export
 * from a design tool weighs, and "your logo is too big" is a demand that the
 * user go and find image-editing software — to put a picture on an invoice.
 *
 * So the file is scaled down here instead. A logo is printed about two inches
 * wide, which is ~600px even at 300 DPI, and almost anything reduced to that
 * lands comfortably inside the storage budget. Rejection is the last resort,
 * not the first response, and when it does happen the message is in units a
 * person uses.
 *
 * The budget exists because the draft lives in localStorage, which is a few
 * megabytes shared with the rest of the origin — a logo that ate it would
 * silently stop the invoice itself from being saved.
 */

/** Longest edge, in pixels, a stored logo is scaled down to. */
export const LOGO_MAX_EDGE = 640;

/** Largest data URL we will keep, after scaling. */
export const MAX_LOGO_BYTES = 500_000;

/** Refused before decoding: no point spending memory to reject it after. */
export const MAX_LOGO_INPUT_BYTES = 25_000_000;

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif', 'image/avif'];

/** Sizes as a person would say them: "8 MB", "480 kB", "900 bytes". */
export function describeSize(bytes: number): string {
  if (bytes >= 1_000_000) {
    const mb = bytes / 1_000_000;
    return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
  }
  if (bytes >= 1000) return `${Math.round(bytes / 1000)} kB`;
  return `${bytes} bytes`;
}

/**
 * Reasons to refuse a file without opening it. Returns null when the file is
 * worth trying — which, after scaling, is nearly everything.
 */
export function logoRejection(file: { type: string; size: number; name: string }): string | null {
  const looksLikeImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|svg|gif|avif)$/i.test(file.name);
  if (!looksLikeImage) return 'That file is not an image — a PNG, JPEG, SVG or WebP works.';
  if (file.type && !ACCEPTED.includes(file.type)) {
    return `${file.type} images are not supported here — try a PNG, JPEG, SVG or WebP.`;
  }
  if (file.size > MAX_LOGO_INPUT_BYTES) {
    return `That image is ${describeSize(file.size)}, which is too large to open in the browser. ${describeSize(MAX_LOGO_INPUT_BYTES)} is the ceiling.`;
  }
  return null;
}

/** Roughly how many bytes a data URL occupies — base64 is 4 bytes per 3. */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const payload = comma === -1 ? dataUrl : dataUrl.slice(comma + 1);
  return Math.ceil((payload.length * 3) / 4);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('The file could not be read.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('That image could not be decoded.'));
    image.src = src;
  });
}

export type LogoResult = { dataUrl: string; note?: string } | { error: string };

/**
 * Scale and re-encode, returning the smallest acceptable result.
 *
 * Encodings are tried best-first: WebP keeps transparency at a fraction of
 * PNG's size, PNG is exact for the flat colour most logos are made of, and
 * JPEG is the fallback for photographs — with a white background, since a
 * photograph has no transparency to keep and JPEG cannot store it anyway.
 * A browser that cannot encode a format hands back a PNG, which the size
 * check below sorts out on its own.
 */
export async function prepareLogo(file: File): Promise<LogoResult> {
  const rejection = logoRejection(file);
  if (rejection) return { error: rejection };

  try {
    const original = await readAsDataUrl(file);

    // SVG is already resolution-independent; rasterising it would only make it
    // worse. Keep it when it fits, and say plainly when it does not.
    if (file.type === 'image/svg+xml') {
      if (dataUrlBytes(original) <= MAX_LOGO_BYTES) return { dataUrl: original };
      return {
        error: `That SVG is ${describeSize(file.size)} — SVGs are kept as-is, so it needs to be under ${describeSize(MAX_LOGO_BYTES)}. Exporting it as a PNG usually fixes it.`,
      };
    }

    const image = await loadImage(original);
    const longest = Math.max(image.naturalWidth, image.naturalHeight) || 1;
    const scale = Math.min(1, LOGO_MAX_EDGE / longest);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return { error: 'This browser could not process the image.' };
    context.drawImage(image, 0, 0, width, height);

    const candidates: string[] = [
      canvas.toDataURL('image/webp', 0.92),
      canvas.toDataURL('image/png'),
    ];
    const best = candidates
      .filter((candidate) => candidate.startsWith('data:image/'))
      .sort((a, b) => dataUrlBytes(a) - dataUrlBytes(b))[0];

    if (best && dataUrlBytes(best) <= MAX_LOGO_BYTES) {
      const resized = scale < 1;
      return {
        dataUrl: best,
        ...(resized
          ? { note: `Scaled to ${width}×${height} and reduced to ${describeSize(dataUrlBytes(best))} for storage — the printed logo is unaffected.` }
          : {}),
      };
    }

    // A photograph. Flatten onto white and let JPEG do what it is for.
    const flattened = document.createElement('canvas');
    flattened.width = width;
    flattened.height = height;
    const flatContext = flattened.getContext('2d');
    if (flatContext) {
      flatContext.fillStyle = '#ffffff';
      flatContext.fillRect(0, 0, width, height);
      flatContext.drawImage(image, 0, 0, width, height);
      const jpeg = flattened.toDataURL('image/jpeg', 0.85);
      if (dataUrlBytes(jpeg) <= MAX_LOGO_BYTES) {
        return {
          dataUrl: jpeg,
          note: `Scaled to ${width}×${height} and saved as JPEG (${describeSize(dataUrlBytes(jpeg))}) — transparency, if there was any, is now white.`,
        };
      }
    }

    return {
      error: `Even scaled down, that image is over ${describeSize(MAX_LOGO_BYTES)}. A simpler logo — flat colours, fewer details — will compress far smaller.`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'That image could not be used.' };
  }
}
