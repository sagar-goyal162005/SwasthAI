'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { isSameLocalDay } from '@/lib/proof-verification';

export type ProofPayload = {
  file: File;
  hash: string;
  capturedAt: Date;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onProofSubmitted: (payload: ProofPayload) => void | Promise<void>;
  title?: string;
  confirmText?: string;
  isHashUsed?: (hash: string) => boolean;
};

function digestToHex(digest: ArrayBuffer) {
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(file: File) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return digestToHex(digest);
}

async function extractCaptureDate(file: File): Promise<Date | null> {
  try {
    const exifr = await import('exifr');
    const tags = (await exifr.parse(file, {
      tiff: true,
      exif: true,
      gps: false,
      xmp: false,
      icc: false,
      iptc: false,
    })) as Record<string, unknown> | null;

    if (!tags) return null;

    const candidates = [
      tags.DateTimeOriginal,
      tags.CreateDate,
      tags.DateTimeDigitized,
      tags.ModifyDate,
    ];

    const first = candidates.find((c) => c instanceof Date) as Date | undefined;
    return first ?? null;
  } catch {
    return null;
  }
}

function parseDateTimeFromText(text: string): Date | null {
  const cleaned = text
    .replace(/\s+/g, ' ')
    .replace(/[^0-9:/\-\.\s]/g, ' ')
    .trim();

  // Common OCR artifact: spaces around ':'
  const flexible = cleaned.replace(/\s*:\s*/g, ':').replace(/\s*\.\s*/g, '.');

  // Match: YYYY MM DD HH:MM (separators flexible)
  const ymd = flexible.match(
    /(\d{4})[\s\-\/\.](\d{1,2})[\s\-\/\.](\d{1,2})[^0-9]{0,10}(\d{1,2})[:\.](\d{2})/
  );
  if (ymd) {
    const [, y, m, d, hh, mm] = ymd;
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);
    const hour = Number(hh);
    const minute = Number(mm);
    if (
      Number.isFinite(year) &&
      Number.isFinite(month) &&
      Number.isFinite(day) &&
      Number.isFinite(hour) &&
      Number.isFinite(minute)
    ) {
      const date = new Date(year, month - 1, day, hour, minute, 0, 0);
      if (!Number.isNaN(date.getTime())) return date;
    }
  }

  // Match: DD MM YYYY HH:MM
  const dmy = flexible.match(
    /(\d{1,2})[\s\-\/\.](\d{1,2})[\s\-\/\.](\d{4})[^0-9]{0,10}(\d{1,2})[:\.](\d{2})/
  );
  if (dmy) {
    const [, d, m, y, hh, mm] = dmy;
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);
    const hour = Number(hh);
    const minute = Number(mm);
    if (
      Number.isFinite(year) &&
      Number.isFinite(month) &&
      Number.isFinite(day) &&
      Number.isFinite(hour) &&
      Number.isFinite(minute)
    ) {
      const date = new Date(year, month - 1, day, hour, minute, 0, 0);
      if (!Number.isNaN(date.getTime())) return date;
    }
  }

  return null;
}

async function extractCaptureDateFromOcr(file: File): Promise<Date | null> {
  if (typeof document === 'undefined') return null;

  try {
    const bitmap = await createImageBitmap(file);

    const makeCanvas = (sx: number, sy: number, sw: number, sh: number) => {
      const scale = 3;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(sw * scale));
      canvas.height = Math.max(1, Math.floor(sh * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

      // Preprocess: grayscale + hard threshold to make white watermark pop.
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = img.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        const v = gray > 190 ? 255 : 0;
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
        data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);

      return canvas;
    };

    // Try the most likely regions first (bottom-right watermark).
    const regions: Array<[number, number, number, number]> = [];
    const w = bitmap.width;
    const h = bitmap.height;
    regions.push([Math.floor(w * 0.55), Math.floor(h * 0.75), Math.floor(w * 0.45), Math.floor(h * 0.25)]);
    regions.push([0, Math.floor(h * 0.75), Math.floor(w * 0.45), Math.floor(h * 0.25)]);
    regions.push([0, Math.floor(h * 0.65), w, Math.floor(h * 0.35)]);

    const mod = await import('tesseract.js');
    const createWorker = (mod as any).createWorker as undefined | ((lang?: string) => Promise<any>);
    if (!createWorker) return null;

    const worker = await createWorker('eng');
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789:-./ ',
    });

    try {
      for (const [sx, sy, sw, sh] of regions) {
        const canvas = makeCanvas(sx, sy, sw, sh);
        if (!canvas) continue;
        const result = await worker.recognize(canvas);
        const text: string = result?.data?.text ?? '';
        const parsed = parseDateTimeFromText(text);
        if (parsed) return parsed;
      }
      return null;
    } finally {
      await worker.terminate();
    }
  } catch (e) {
    console.warn('OCR timestamp extraction failed:', e);
    return null;
  }
}

export function ProofUploadDialog({
  isOpen,
  onClose,
  onProofSubmitted,
  title = 'Upload Proof',
  confirmText = 'Continue',
  isHashUsed,
}: Props) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [capturedAt, setCapturedAt] = useState<Date | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFile(null);
    setCapturedAt(null);
    setHash(null);
    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const valid = !!file && !!capturedAt && !!hash && !error;

  const onPickFile = async (picked: File | null) => {
    setError(null);
    setCapturedAt(null);
    setHash(null);
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);

    if (!picked) return;

    setBusy(true);
    try {
      const fileHash = await sha256Hex(picked);

      // Prefer EXIF (best source). If missing (e.g., WhatsApp), fall back to OCR of visible timestamp.
      let date = await extractCaptureDate(picked);
      if (!date) {
        date = await extractCaptureDateFromOcr(picked);
      }

      if (!date) {
        setError(
          'Could not find a valid capture date/time. Upload an original camera photo (EXIF) or a photo with a clearly visible date/time watermark.'
        );
        return;
      }

      const now = new Date();
      const isToday = isSameLocalDay(date, now);
      const isInFuture = date.getTime() > now.getTime() + 2 * 60 * 1000;
      if (!isToday || isInFuture) {
        setError('Photo must be taken today (with correct date/time).');
        return;
      }

      if (isHashUsed?.(fileHash)) {
        setError('This photo was already used to verify another task. Please upload a new one.');
        return;
      }

      setFile(picked);
      setCapturedAt(date);
      setHash(fileHash);
      setPreviewUrl(URL.createObjectURL(picked));
    } catch (e) {
      console.error(e);
      toast({
        title: 'Upload failed',
        description: 'Could not read this image. Please try another file.',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (!file || !capturedAt || !hash || error) return;
    await onProofSubmitted({ file, capturedAt, hash });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            disabled={busy}
          />

          {busy && (
            <div className="text-sm text-muted-foreground">
              Reading timestamp…
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Proof rejected</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {capturedAt && (
            <div className="text-sm text-muted-foreground">
              Captured: <span className="font-medium text-foreground">{capturedAt.toLocaleString()}</span>
            </div>
          )}

          {previewUrl && (
            <div className="relative w-full overflow-hidden rounded-md border border-border bg-black/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Proof preview" className="w-full max-h-[360px] object-contain" />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!valid || busy}>
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
