'use client';

/**
 * Saving a file without frightening anyone.
 *
 * The blob-and-anchor trick lands files in the browser's download shelf,
 * where Chrome and Edge greet an .xml from a young domain with "this file may
 * harm your device" — which, on an invoicing product, reads as "this invoice
 * is malware". The File System Access API skips the shelf entirely: the user
 * picks where the file goes and the browser writes it, no verdict attached.
 * Firefox and Safari do not have the API, and also do not editorialise about
 * XML, so the anchor fallback is fine there.
 */

type SavePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName?: string;
    types?: { description?: string; accept: Record<string, string[]> }[];
  }) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
};

export interface SaveKind {
  mime: string;
  extension: `.${string}`;
  description: string;
}

export const XML_FILE: SaveKind = { mime: 'application/xml', extension: '.xml', description: 'Invoice XML' };
export const JSON_FILE: SaveKind = { mime: 'application/json', extension: '.json', description: 'Invoice JSON' };
export const PDF_FILE: SaveKind = { mime: 'application/pdf', extension: '.pdf', description: 'PDF invoice' };

export async function saveFile(filename: string, content: Blob | string, kind: SaveKind): Promise<void> {
  const blob = content instanceof Blob ? content : new Blob([content], { type: kind.mime });

  const picker = (window as SavePickerWindow).showSaveFilePicker;
  if (picker) {
    try {
      const handle = await picker({
        suggestedName: filename,
        types: [{ description: kind.description, accept: { [kind.mime]: [kind.extension] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (e) {
      // Cancelling the dialog is a decision, not an error — and not a cue to
      // shove the same file through the download shelf after all.
      if (e instanceof DOMException && e.name === 'AbortError') return;
      // Anything else (embedded context, permission policy): fall through.
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** A filesystem-safe name derived from the invoice number. */
export function fileSlug(value: string): string {
  return (value || 'invoice').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'invoice';
}
