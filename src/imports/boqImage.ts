import { pdfTableRows } from './boqPDF';

export interface OCRWord {
  text: string;
  bbox: { x0: number; x1: number; y0: number; y1: number };
}

export function imageWordsToTable(words: OCRWord[]): string[][] {
  return pdfTableRows([words.map(word => ({
    text: word.text,
    x: word.bbox.x0,
    // PDF rows sort bottom-to-top coordinates; image coordinates run top-to-bottom.
    y: -(word.bbox.y0 + word.bbox.y1) / 2,
    width: word.bbox.x1 - word.bbox.x0,
    height: word.bbox.y1 - word.bbox.y0,
  }))]);
}

export async function readBOQImage(file: File, onProgress: (message: string) => void, signal?: AbortSignal): Promise<string[][]> {
  const { createWorker } = await import('tesseract.js');
  onProgress('Loading OCR. First use downloads the reading engine and English language data…');
  const worker = await createWorker('eng', 1, {
    logger: message => {
      if (!signal?.aborted && message.status === 'recognizing text') onProgress(`Reading picture… ${Math.round(message.progress * 100)}%`);
    },
  });
  const cancel = () => { void worker.terminate(); };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    if (signal?.aborted) throw new Error('Image reading cancelled.');
    await worker.setParameters({ preserve_interword_spaces: '1' });
    const { data } = await worker.recognize(file, {}, { text: true, blocks: true });
    const words = data.blocks?.flatMap(block => block.paragraphs.flatMap(paragraph => paragraph.lines.flatMap(line => line.words))) || [];
    if (!data.text.trim()) throw new Error('No readable text found. Use a clear, upright photo with the full BOQ table in focus.');
    const table = imageWordsToTable(words);
    // Retain a manual correction path if the OCR engine returned text without coordinates.
    return table.length ? table : data.text.trim().split(/\r?\n/).map(line => line.trim().split(/\s{2,}|\t/));
  } finally {
    signal?.removeEventListener('abort', cancel);
    await worker.terminate();
  }
}
