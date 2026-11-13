import test from 'node:test';
import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';

test('compatibility PDF worker reads a quotation without native Uint8Array.toHex', async () => {
  // Node 20 lacks these browser/runtime APIs. No rendering is performed here.
  globalThis.DOMMatrix ??= class {};
  Promise.withResolvers ??= function () {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  };
  delete Uint8Array.prototype.toHex;
  assert.equal(typeof Uint8Array.prototype.toHex, 'undefined');
  // Import the worker first: browser workers have their own global environment,
  // so the worker must supply its own compatibility code.
  const worker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
  assert.equal(new Uint8Array([0, 15, 255]).toHex(), '000fff');
  globalThis.pdfjsWorker = worker;
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdf = new jsPDF();
  pdf.text('Contract Price 3,125,000.00', 20, 20);
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(pdf.output('arraybuffer')), useSystemFonts: true });
  try {
    const document = await loadingTask.promise;
    assert.equal(document.numPages, 1);
    const page = await document.getPage(1);
    const content = await page.getTextContent();
    assert.match(content.items.map(item => item.str || '').join(' '), /Contract Price 3,125,000.00/);
  } finally {
    await loadingTask.destroy();
  }
});
