import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { zipSync, strToU8 } from 'fflate';
import readExcel from 'read-excel-file/node';

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const compile = text => ts.transpile(text, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
const exports = {};
new Function('exports', compile(source('src/imports/boq.ts')))(exports);
const { parseCSV, parseBOQRows, findBOQColumns } = exports;
const header = ['Reference', 'Description', 'Location', 'Quantity', 'Unit', 'Unit Rate'];
const row = ['D1', 'Wall drilling', 'Building A', 100, 'holes', 12.5];

test('reads quoted CSV and rejects incomplete or invalid quantities', () => {
  const data = parseCSV('\uFEFFReference,Description,Location,Quantity,Unit,Unit Rate\r\nD1,"Drilling, wall",A,"1,000",holes,12.5');
  const items = parseBOQRows(data, 0, findBOQColumns(data[0]));
  assert.equal(items[0].description, 'Drilling, wall');
  assert.equal(items[0].quantity, 1000);
  assert.throws(() => parseBOQRows([header, ['D1', 'Drilling', 'A', 0, 'holes', 12]], 0, findBOQColumns(header)), /greater than zero/);
  assert.throws(() => parseBOQRows([header, ['D1', 'Drilling', 'A', 10, 'holes', '']], 0, findBOQColumns(header)), /missing/);
  assert.throws(() => parseCSV('"unfinished'), /unclosed/);
});

test('reads an actual XLSX workbook with worksheet selection', async () => {
  const sheet = rows => `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((cells, i) => `<row r="${i + 1}">${cells.map((value, j) => `<c r="${String.fromCharCode(65 + j)}${i + 1}" t="${typeof value === 'number' ? 'n' : 'inlineStr'}">${typeof value === 'number' ? `<v>${value}</v>` : `<is><t>${value}</t></is>`}</c>`).join('')}</row>`).join('')}</sheetData></worksheet>`;
  const files = {
    '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/></Types>',
    '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Cover" sheetId="1" r:id="rId1"/><sheet name="Final BOQ" sheetId="2" r:id="rId2"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': sheet([['Project BOQ']]),
    'xl/worksheets/sheet2.xml': sheet([header, row]),
  };
  const buffer = Buffer.from(zipSync(Object.fromEntries(Object.entries(files).map(([key, value]) => [key, strToU8(value)]))));
  const sheets = await readExcel(buffer);
  assert.equal(sheets[1].sheet, 'Final BOQ');
  const items = parseBOQRows(sheets[1].data, 0, findBOQColumns(sheets[1].data[0]));
  assert.equal(items[0].quantity * items[0].unitRate, 1250);
});

test('imports atomically, preserves the 82-day schedule and progress, rejects duplicate links', () => {
  const file = source('src/store/useWorkStore.ts');
  const action = file.slice(file.indexOf('      importBOQ: (boardId'), file.indexOf('      reallocateSchedule: (boardId'));
  let state = { boards: [{ id: 'board', startDate: '2026-10-24', endDate: '2027-01-13', columns: [{ id: 'a', name: 'Building A', cards: [{ id: 'card', title: 'Wall drilling', progress: 20, completed: false, startDate: '2026-10-24', dueDate: '2026-10-30' }] }] }] };
  let syncCount = 0;
  const set = fn => { state = { ...state, ...fn(state) }; };
  const store = new Function('set', 'uid', 'scheduleBoardSync', compile(`const actions = { ${action} }; return actions;`))(set, () => 'new-id', () => syncCount++);
  const item = { reference: 'D1', description: 'Wall drilling', location: 'Building A', quantity: 100, unit: 'holes', unitRate: 12.5, targetCardId: 'card' };
  assert.equal(store.importBOQ('board', [item], 'final.xlsx'), true);
  const board = state.boards[0], card = board.columns[0].cards[0];
  assert.equal(card.cost, 1250);
  assert.equal(card.boq.quantity, 100);
  assert.equal(card.progress, 20);
  assert.equal(card.dueDate, '2026-10-30');
  assert.equal(board.endDate, '2027-01-13');
  assert.equal(board.totalBudget, 1250);
  assert.equal(syncCount, 1);
  assert.equal(store.importBOQ('board', [item, item], 'final.xlsx'), false);
  assert.equal(syncCount, 1);
  assert.equal(store.importBOQ('board', [{ ...item, targetCardId: '__new__', reference: 'D2' }], 'final.xlsx'), true);
  assert.equal(state.boards[0].columns[0].cards[1].progress, 0);
});

test('BOQ denominator applies only to cumulative counts of the same scope and unit', () => {
  const file = source('src/components/DailyReportAnalyzerModal.tsx');
  const analyze = new Function('exports', compile(file.slice(file.indexOf('const STOP_WORDS'), file.indexOf('export default function'))) + '; return analyzeReportNarrative;')({});
  const task = { card: { id: 'd1', title: 'Wall drilling', progress: 0, boq: { quantity: 100, unit: 'holes' } }, columnName: 'Building A' };
  assert.equal(analyze('Wall drilling cumulative 20 holes', [task]).matches[0].suggestedProgress, 20);
  assert.equal(analyze('Wall drilling today 20 holes', [task]).matches[0].selected, false);
  assert.equal(analyze('Wall drilling cumulative 20 meters', [task]).matches[0].selected, false);
  assert.equal(analyze('Wall drilling 8 of 10 holes', [task]).matches[0].selected, false);
  const second = { ...task, card: { ...task.card, id: 'd2' }, columnName: 'Building B' };
  assert.ok(analyze('Wall drilling cumulative 20 holes', [task, second]).matches.every(match => !match.selected));
});

test('BOQ quantities and rates survive the cloud metadata round trip', () => {
  const file = source('src/services/supabaseService.ts');
  const encodeBlock = file.slice(file.indexOf('          if (hasRoadmapMeta) {'), file.indexOf('          // If this is the first card, embed board metadata'));
  const encode = new Function('item', compile(`const hasRoadmapMeta = true; let encodedDescription = ''; ${encodeBlock}; return encodedDescription;`));
  const card = { title: 'Wall drilling', progress: 20, cost: 1250, boq: { reference: 'D1', quantity: 100, unit: 'holes', unitRate: 12.5, sourceFile: 'Final BOQ.xlsx', importedAt: '2026-11-12T00:00:00Z' } };
  const description = encode({ card });
  const start = file.indexOf("          let desc = card.description || '';");
  const decodeBlock = file.slice(start, file.indexOf('          // Strip any embedded board sprints tag', start));
  const decode = new Function('card', compile(`${decodeBlock}; return { boq, cost, progress };`));
  const restored = decode({ ...card, description });
  assert.deepEqual(restored.boq, card.boq);
  assert.equal(restored.cost, 1250);
  assert.equal(restored.progress, 20);
});

test('PDF coordinate extraction keeps table columns and removes repeated page headers', () => {
  const file = source('src/imports/boqPDF.ts');
  const pdfExports = {};
  new Function('require', 'exports', compile(file.slice(0, file.indexOf('export async function readBOQPDF'))))(() => exports, pdfExports);
  const cell = (text, x, y, width = 30) => ({ text, x, y, width, height: 10 });
  const heading = y => [cell('Reference', 20, y, 40), cell('Description', 100, y, 60), cell('Quantity', 330, y, 40), cell('Unit', 410, y, 20), cell('Unit', 470, y, 20), cell('Rate', 493, y, 20)];
  const item = (ref, y) => [cell(ref, 20, y), cell('Wall drilling', 100, y, 100), cell('100', 340, y), cell('holes', 410, y), cell('12.5', 470, y)];
  const rows = pdfExports.pdfTableRows([[...heading(700), ...item('D1', 680)], [...heading(700), ...item('D2', 680)]]);
  assert.equal(rows.length, 3);
  const parsed = parseBOQRows(rows, 0, findBOQColumns(rows[0]));
  assert.equal(parsed.length, 2);
  assert.equal(parsed[1].reference, 'D2');
  assert.equal(parsed[0].quantity, 100);
  assert.equal(parsed[0].unitRate, 12.5);
  assert.deepEqual(pdfExports.pdfTableRows([[]]), []);
});

test('picture OCR preserves table coordinates, releases its worker and rejects unreadable images', async () => {
  const pdf = source('src/imports/boqPDF.ts'), pdfExports = {};
  new Function('require', 'exports', compile(pdf.slice(0, pdf.indexOf('export async function readBOQPDF'))))(() => exports, pdfExports);
  const cell = (text, x, y, width = 30) => ({ text, bbox: { x0: x, x1: x + width, y0: y, y1: y + 10 } });
  const words = [cell('Reference', 20, 20, 40), cell('Description', 100, 20, 60), cell('Quantity', 330, 20, 40), cell('Unit', 410, 20, 20), cell('Unit', 470, 20, 20), cell('Rate', 493, 20, 20),
    cell('D1', 20, 50), cell('Wall', 100, 50), cell('drilling', 134, 50), cell('100', 340, 50), cell('holes', 410, 50), cell('12.5', 470, 50)];
  let terminated = 0, recognizeCount = 0;
  let data = { text: 'Reference Description Quantity Unit Unit Rate\nD1 Wall drilling 100 holes 12.5', blocks: [{ paragraphs: [{ lines: [{ words }] }] }] };
  const ocr = { createWorker: async () => ({ setParameters: async () => {}, recognize: async () => { recognizeCount++; return { data }; }, terminate: async () => { terminated++; } }) };
  const imageExports = {};
  new Function('require', 'exports', compile(source('src/imports/boqImage.ts')))(id => id === 'tesseract.js' ? ocr : pdfExports, imageExports);
  const table = await imageExports.readBOQImage({}, () => {});
  const parsed = parseBOQRows(table, 0, findBOQColumns(table[0]));
  assert.equal(parsed[0].description, 'Wall drilling');
  assert.equal(parsed[0].quantity, 100);
  assert.equal(parsed[0].unitRate, 12.5);
  assert.equal(terminated, 1);
  data = { text: '', blocks: [] };
  await assert.rejects(imageExports.readBOQImage({}, () => {}), /No readable text/);
  assert.equal(terminated, 2);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(imageExports.readBOQImage({}, () => {}, controller.signal), /cancelled/);
  assert.equal(recognizeCount, 2);
  assert.equal(terminated, 3);
});
