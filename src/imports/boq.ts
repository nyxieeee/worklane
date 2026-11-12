export interface BOQRow {
  reference: string;
  description: string;
  location: string;
  quantity: number;
  unit: string;
  unitRate: number;
}

/** RFC-style quoted fields, including embedded commas, quotes and newlines. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else if (quoted || !field.trim()) quoted = !quoted;
      else throw new Error('Unexpected quote in CSV. Export the BOQ as a standard CSV file.');
    } else if (ch === ',' && !quoted) { row.push(field.trim()); field = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field.trim()); if (row.some(Boolean)) rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (quoted) throw new Error('The CSV contains an unclosed quoted field.');
  row.push(field.trim()); if (row.some(Boolean)) rows.push(row);
  return rows;
}

export const boqHeaders = ['Reference', 'Description', 'Location', 'Quantity', 'Unit', 'Unit Rate'];
const normalized = (value: unknown) => String(value ?? '').replace(/^\uFEFF/, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const aliases = [
  ['reference', 'item', 'itemno', 'itemnumber', 'code', 'ref'],
  ['description', 'itemdescription', 'workdescription', 'scopeofwork', 'particulars'],
  ['location', 'building', 'phase', 'floor', 'area'],
  ['quantity', 'qty', 'totalquantity', 'boqquantity'],
  ['unit', 'uom', 'unitofmeasure'],
  ['unitrate', 'unitprice', 'rate', 'price'],
];
export function findBOQColumns(headers: unknown[]): number[] {
  return aliases.map(names => headers.findIndex(h => names.includes(normalized(h))));
}
export function parseBOQRows(data: unknown[][], headerIndex: number, columns: number[]): BOQRow[] {
  if ([columns[1], columns[3], columns[4], columns[5]].some(index => index < 0)) throw new Error('Map Description, Quantity, Unit and Unit Rate before continuing.');
  const rows: BOQRow[] = [];
  const number = (value: string, label: string, row: number) => {
    if (!value.trim()) throw new Error(`Row ${row}: ${label} is missing.`);
    const cleaned = value.replace(/[,\s₱$€£]/g, '');
    if (!/^\d+(?:\.\d+)?$/.test(cleaned)) throw new Error(`Row ${row}: ${label} must be a valid nonnegative number.`);
    const result = Number(cleaned);
    if (!Number.isFinite(result)) throw new Error(`Row ${row}: invalid ${label}.`);
    return result;
  };
  for (let i = headerIndex + 1; i < data.length; i++) {
    const values = columns.map(col => col < 0 ? '' : String(data[i][col] ?? '').trim());
    if (!values.some(Boolean)) continue;
    // Section headings and total rows have no quantity or unit rate.
    if (!values[3] && !values[5]) continue;
    if (!values[1] || !values[4]) throw new Error(`Row ${i + 1}: description and unit are required.`);
    const quantity = number(values[3], 'quantity', i + 1), unitRate = number(values[5], 'unit rate', i + 1);
    if (quantity <= 0) throw new Error(`Row ${i + 1}: quantity must be greater than zero.`);
    if (!Number.isFinite(quantity * unitRate)) throw new Error(`Row ${i + 1}: item amount is too large.`);
    rows.push({ reference: values[0], description: values[1], location: values[2], quantity, unit: values[4], unitRate });
  }
  if (!rows.length) throw new Error('No BOQ items found below the selected header row.');
  return rows;
}
