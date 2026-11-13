import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compile = text => ts.transpile(text, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const boq = {};
new Function('exports', compile(source('src/imports/boq.ts')))(boq);
const parser = {};
const sheets = [{ sheet: 'Cover', data: [] }, { sheet: 'Takeoff', data: [['Description', 'Quantity', 'Unit'], ['Conduit', 12.5, 'm']] }];
new Function('require', 'exports', compile(source('src/imports/quotationParser.ts')))(id => id === './boq' ? boq : id === 'read-excel-file/browser' ? { default: async () => sheets } : id === 'mammoth' ? { extractRawText: async () => ({ value: 'Contract Price  3,125,000.00' }) } : {}, parser);

test('Excel extraction reads worksheet data rather than worksheet objects', async () => {
  const result = await parser.extractTableFromFile({ name: 'takeoff.xlsx' });
  assert.equal(result.rows[1][1], '12.5');
  assert.equal(parser.parseBuildingTakeoff(result.rows, result.rawText)[0].quantity, 12.5);
});
test('Word quotations and plain text files are supported; legacy formats explain conversion', async () => {
  const result = await parser.extractTableFromFile({ name: 'quotation.docx', arrayBuffer: async () => new ArrayBuffer(0) });
  assert.equal(parser.parseCommercialQuotation(result.rows, result.rawText).totalContractPrice, 3125000);
  assert.equal((await parser.extractTableFromFile({ name: 'quotation.txt', text: async () => 'Total  1250' })).rows[0][1], '1250');
  await assert.rejects(parser.extractTableFromFile({ name: 'old.xls' }), /Save this legacy file/);
});
test('table totals survive extracted columns and takeoffs preserve references, locations and decimals', () => {
  const table = [['Description', 'Amount'], ['Labor 1 lot', '1,000'], ['Devices 1 lot', '2,000'], ['Grand Total', '3,000']];
  assert.equal(parser.parseCommercialQuotation(table, table.map(row => row.join(' ')).join('\n')).totalContractPrice, 3000);
  const takeoff = [['Reference', 'Description', 'Location', 'Quantity', 'Unit', 'Unit Rate'], ['1', 'Conduit', 'Building A', '12.5', 'm', '50'], ['2', 'Boxes', 'Building B', '10', 'pcs', '25']];
  const items = parser.parseBuildingTakeoff(takeoff, '');
  assert.equal(items.length, 2);
  assert.equal(items[0].quantity, 12.5);
  assert.equal(items[0].buildingOrPhase, 'Building A');
  assert.equal(items[1].quantity, 10);
  assert.equal(parser.parseBuildingTakeoff([['Unreadable text']], '').length, 0);
});
test('batch upload retains successful pictures and reports individual failures', async () => {
  const sourceText = source('src/components/CreateRoadmapPage.tsx');
  const handler = sourceText.slice(sourceText.indexOf('  const handleUploadBreakdown ='), sourceText.indexOf('  // Sync apportioned'));
  const values = {};
  const names = ['isReading', 'reader', 'setIsReadingBreakdown', 'setUploadErrors', 'setReadingStatus', 'extractTableFromFile', 'parseBuildingTakeoff', 'setBuildingTakeoff', 'setBreakdownFileName', 'syncGeneratedPhases', 'commercialLots', 'contractTotal', 'showToast'];
  const args = [false, { current: null }, () => {}, x => values.errors = x, () => {}, async file => { if (file.name === 'bad.jpg') throw new Error('Unreadable'); return { rows: [], rawText: file.name }; }, (_, name) => [{ id: 'item_0', scopeDescription: name, quantity: 2 }], x => values.items = x, x => values.names = x, (_, x) => values.phases = x, [], 100, () => {}];
  const run = new Function(...names, compile(`${handler}; return handleUploadBreakdown;`))(...args);
  const event = { target: { files: [{ name: 'a.jpg' }, { name: 'bad.jpg' }, { name: 'b.jpg' }], value: 'selected' } };
  await run(event);
  assert.equal(values.items.length, 2);
  assert.equal(new Set(values.items.map(item => item.id)).size, 2);
  assert.equal(values.phases.length, 2);
  assert.deepEqual(values.errors, ['bad.jpg: Unreadable']);
  assert.equal(values.names, 'a.jpg, b.jpg');
  assert.equal(event.target.value, '');
});
