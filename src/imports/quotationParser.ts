import { parseCSV, findBOQColumns } from './boq';
import { readBOQPDF, tableToCSV } from './boqPDF';
import { readBOQImage } from './boqImage';

export interface ExtractedBuildingItem {
  id: string;
  buildingOrPhase: string;
  scopeDescription: string;
  quantity: number;
  unit: string;
  unitRate?: number;
  totalCost?: number;
}

export interface CommercialLotItem {
  id: string;
  description: string;
  amount: number;
  category?: 'labor' | 'devices' | 'materials' | 'general' | 'other';
}

export interface QuotationParseResult {
  fileName: string;
  totalContractPrice: number;
  currency: string;
  commercialItems: CommercialLotItem[];
  buildingItems: ExtractedBuildingItem[];
  detectedBuildings: string[];
}

// Helper to sanitize monetary strings (e.g. "₱ 1,250,000.00" -> 1250000)
export function parseCurrencyNumber(val: unknown): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const str = String(val).replace(/[^0-9.-]+/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

// Detect currency symbol
export function detectCurrency(text: string): string {
  if (text.includes('₱') || /php|pesos?/i.test(text)) return '₱';
  if (text.includes('$') || /usd|dollars?/i.test(text)) return '$';
  if (text.includes('€') || /eur|euros?/i.test(text)) return '€';
  if (text.includes('£')) return '£';
  return '₱';
}

// Extract table matrix from File (.xlsx, .csv, .pdf, or image)
export async function extractTableFromFile(
  file: File,
  onProgress?: (msg: string) => void,
  signal?: AbortSignal
): Promise<{ rows: string[][]; rawText: string }> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (ext === 'xlsx' || ext === 'xls') {
    const { default: readExcel } = await import('read-excel-file/browser');
    const sheets = await readExcel(file);
    const data = (sheets && sheets[0] ? sheets : [[]]) as unknown[][];
    // Convert to string matrix
    const rows = (data || []).map(r => (r || []).map(c => String(c ?? '').trim()));
    const rawText = rows.map(r => r.join(' ')).join('\n');
    return { rows, rawText };
  }

  if (ext === 'csv') {
    const text = await file.text();
    const rows = parseCSV(text);
    return { rows, rawText: text };
  }

  if (ext === 'pdf') {
    onProgress?.('Extracting tables from PDF document...');
    const rows = await readBOQPDF(file);
    const rawText = tableToCSV(rows);
    return { rows, rawText };
  }

  if (['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext)) {
    onProgress?.('Reading text and table coordinates from image (OCR)...');
    const rows = await readBOQImage(file, msg => onProgress?.(msg), signal);
    const rawText = tableToCSV(rows);
    return { rows, rawText };
  }

  throw new Error(`Unsupported file type: .${ext}. Please use Excel, PDF, CSV, or a PNG/JPG picture.`);
}

// Parse high-level commercial quotation (e.g. Labor 1 lot, Devices 1 lot)
export function parseCommercialQuotation(table: string[][], rawText: string): QuotationParseResult {
  const currency = detectCurrency(rawText);
  const commercialItems: CommercialLotItem[] = [];
  const buildingItems: ExtractedBuildingItem[] = [];
  const detectedBuildings = new Set<string>();

  // Look for total contract price or sum of lot lines
  let explicitTotal = 0;
  const totalMatch = rawText.match(/(?:TOTAL|GRAND TOTAL|CONTRACT PRICE|CONTRACT AMOUNT|PROJECT TOTAL)[:\s]*[₱$€£]?\s*([0-9,]+(?:\.[0-9]{2})?)/i);
  if (totalMatch) {
    explicitTotal = parseCurrencyNumber(totalMatch[1]);
  }

  // Check table rows for lot items or building deliverables
  for (let r = 0; r < table.length; r++) {
    const row = table[r].filter(Boolean);
    if (!row.length) continue;
    const rowStr = row.join(' ');

    // Match lot keywords: "Labor", "Devices", "Supply & Installation", "1 lot"
    const isLot = /\b(lot|lump\s*sum|ls)\b/i.test(rowStr);
    const hasMoney = /[₱$€£]?\s*[0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{2})?/.test(rowStr) ||
                     row.some(c => /^[0-9,]+(?:\.[0-9]{2})?$/.test(c.trim()) && parseCurrencyNumber(c) > 100);

    // Extract numbers in row
    const numbersInRow: number[] = [];
    row.forEach(c => {
      const n = parseCurrencyNumber(c);
      if (n > 0) numbersInRow.push(n);
    });

    const highestNumber = numbersInRow.length ? Math.max(...numbersInRow) : 0;

    if (isLot && highestNumber > 0) {
      let desc = row[0];
      if (/^[0-9]+$/.test(desc) && row[1]) desc = row[1];
      let category: CommercialLotItem['category'] = 'other';
      if (/labor|installation|wiring|rough/i.test(desc)) category = 'labor';
      else if (/device|equipment|detector|panel|sensor|cctv/i.test(desc)) category = 'devices';
      else if (/material|conduit|pipe|box|fitting/i.test(desc)) category = 'materials';
      else if (/general|mobiliz|permit|safety/i.test(desc)) category = 'general';

      commercialItems.push({
        id: `comm_${r}`,
        description: desc.trim(),
        amount: highestNumber,
        category,
      });
      continue;
    }

    // Check if it's a building takeoff / deliverable row
    const buildingMatch = rowStr.match(/\b([A-Za-z0-9\s-]+(?:\s+Building|\s+Bldg|\s+Floor|\s+Flr|\s+Phase|\s+Wing))\b/i);
    if (buildingMatch) {
      detectedBuildings.add(buildingMatch[1].trim());
    }
  }

  const calculatedTotal = explicitTotal > 0
    ? explicitTotal
    : commercialItems.reduce((sum, item) => sum + item.amount, 0);

  return {
    fileName: '',
    totalContractPrice: calculatedTotal,
    currency,
    commercialItems,
    buildingItems,
    detectedBuildings: Array.from(detectedBuildings),
  };
}

// Parse technical breakdown / quantity takeoff (e.g. from Building Takeoff PNG or Excel schedule)
export function parseBuildingTakeoff(table: string[][], rawText: string): ExtractedBuildingItem[] {
  const items: ExtractedBuildingItem[] = [];
  let currentBuilding = 'General Scope';

  // Common building/floor patterns: "Mutien Building", "5th Floor", "Phase 1"
  const sectionHeaderRegex = /^(?:Item\s+[A-Z0-9]+|Phase\s+[0-9]+|[A-Za-z0-9\s-]+(?:Building|Bldg|Floor|Flr|Wing|Tower))/i;

  for (let r = 0; r < table.length; r++) {
    const row = table[r].filter(Boolean);
    if (!row.length) continue;
    const rowStr = row.join(' ').trim();

    // Skip table header lines
    if (/^(item|no|description|scope|qty|quantity|unit|rate|amount|price)/i.test(row[0] || '')) {
      continue;
    }

    // Check if this row is a section header (e.g., Mutien Building, 5th Floor)
    if (row.length === 1 || (row.length <= 2 && !row.some(c => /^[0-9]+$/.test(c.trim())))) {
      if (sectionHeaderRegex.test(rowStr) || rowStr.length < 40) {
        currentBuilding = rowStr.replace(/^[-•*#\d.]+\s*/, '').trim();
        continue;
      }
    }

    // Try to find description, quantity, and unit
    let desc = '';
    let qty = 0;
    let unit = 'pcs';
    let unitRate = 0;
    let totalCost = 0;

    for (let c = 0; c < row.length; c++) {
      const cell = row[c].trim();
      const num = parseCurrencyNumber(cell);

      // Check unit
      if (/^(pcs|pieces?|meters?|m|rolls?|sets?|lots?|units?|lengths?|boxes|box)$/i.test(cell)) {
        unit = cell.toLowerCase();
      } else if (!desc && cell.length > 3 && !/^[0-9.,₱$€£]+$/.test(cell)) {
        desc = cell;
      } else if (num > 0) {
        if (qty === 0 && num < 10000 && !cell.includes('.')) {
          qty = num;
        } else if (unitRate === 0 && qty > 0) {
          unitRate = num;
        } else if (totalCost === 0 && num > 0) {
          totalCost = num;
        }
      }
    }

    // If unit or qty wasn't found in distinct cells, inspect text
    if (!qty) {
      const qtyMatch = rowStr.match(/(\d+)\s*(pcs|pieces?|meters?|m|sets?|rolls?|lengths?|units?)/i);
      if (qtyMatch) {
        qty = parseInt(qtyMatch[1], 10);
        unit = qtyMatch[2].toLowerCase();
      }
    }

    if (desc && desc.length > 2) {
      if (qty === 0) qty = 1;
      items.push({
        id: `item_${r}`,
        buildingOrPhase: currentBuilding,
        scopeDescription: desc,
        quantity: qty,
        unit,
        unitRate: unitRate || undefined,
        totalCost: totalCost || (unitRate ? qty * unitRate : undefined),
      });
    }
  }

  return items;
}

// Apportion 1-lot contract values across physical building takeoff items
export function apportionQuotationValues(
  commercialItems: CommercialLotItem[],
  buildingItems: ExtractedBuildingItem[],
  manualTotalBudget?: number
): {
  itemsWithValues: ExtractedBuildingItem[];
  phaseBudgets: Record<string, number>;
  totalContractPrice: number;
} {
  const totalCommercialSum = manualTotalBudget && manualTotalBudget > 0
    ? manualTotalBudget
    : commercialItems.reduce((sum, item) => sum + item.amount, 0);

  // Group items by building / phase
  const buildingsMap = new Map<string, ExtractedBuildingItem[]>();
  buildingItems.forEach(item => {
    const list = buildingsMap.get(item.buildingOrPhase) || [];
    list.push(item);
    buildingsMap.set(item.buildingOrPhase, list);
  });

  // Total quantity units across all deliverables as a baseline distribution weight
  const totalQuantityUnits = buildingItems.reduce((sum, item) => sum + Math.max(1, item.quantity), 0);

  const phaseBudgets: Record<string, number> = {};
  const itemsWithValues: ExtractedBuildingItem[] = [];

  if (totalCommercialSum > 0 && totalQuantityUnits > 0) {
    let accumulatedAssigned = 0;

    buildingItems.forEach((item, index) => {
      // Proportion of this item's scope relative to project scope
      const weightRatio = Math.max(1, item.quantity) / totalQuantityUnits;
      const calculatedValue = Math.round(totalCommercialSum * weightRatio * 100) / 100;
      accumulatedAssigned += calculatedValue;

      const finalizedItem: ExtractedBuildingItem = {
        ...item,
        totalCost: item.totalCost && item.totalCost > 0 ? item.totalCost : calculatedValue,
        unitRate: item.unitRate || Math.round((calculatedValue / Math.max(1, item.quantity)) * 100) / 100,
      };

      itemsWithValues.push(finalizedItem);

      const bName = item.buildingOrPhase;
      phaseBudgets[bName] = (phaseBudgets[bName] || 0) + finalizedItem.totalCost!;
    });

    // Reconcile rounding diff on the last item to guarantee exact 100% contract balance
    if (itemsWithValues.length > 0 && Math.abs(totalCommercialSum - accumulatedAssigned) > 0.01) {
      const diff = totalCommercialSum - accumulatedAssigned;
      const last = itemsWithValues[itemsWithValues.length - 1];
      last.totalCost = Math.round((last.totalCost! + diff) * 100) / 100;
      phaseBudgets[last.buildingOrPhase] = Math.round((phaseBudgets[last.buildingOrPhase] + diff) * 100) / 100;
    }
  } else {
    // If no commercial total is provided, use direct costs or equal weights
    buildingItems.forEach(item => {
      itemsWithValues.push({ ...item, totalCost: item.totalCost || 0 });
      phaseBudgets[item.buildingOrPhase] = (phaseBudgets[item.buildingOrPhase] || 0) + (item.totalCost || 0);
    });
  }

  return {
    itemsWithValues,
    phaseBudgets,
    totalContractPrice: totalCommercialSum,
  };
}
