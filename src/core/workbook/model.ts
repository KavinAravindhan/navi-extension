import type { ContextScope } from '@/core/settings/settings';
import { columnNumberToLetter } from './a1';

export type CellValue = string | number | null | undefined;

export interface WorkbookChart {
  chartId: number;
  title: string;
  chartType: string;
}

export interface WorkbookTab {
  sheetId: number;
  title: string;
  index: number;
  rowCount: number;
  columnCount: number;
  charts: WorkbookChart[];
}

export type { ContextScope };

/**
 * Formats raw Sheets rows into the plain-text layout NAVI feeds to the LLM
 * ("Row 1: a | b | c"). Ported from v1, including its quirks: empty rows are
 * skipped but keep their numbers; rows pad to the widest row; falsy cells
 * (including numeric 0) render as empty strings.
 */
export function formatRows(sheetName: string, rows: CellValue[][]): string {
  const maxCols = Math.max(...rows.map((r) => r.length));
  let result = `Sheet: ${sheetName}\n\n`;

  rows.forEach((row, i) => {
    if (row.every((cell) => !cell || cell.toString().trim() === '')) return;
    const paddedRow = Array.from({ length: maxCols }, (_, j) => row[j] || '');
    result += `Row ${i + 1}: ${paddedRow.join(' | ')}\n`;
  });

  return result;
}

/**
 * Detects a table heading (NAVI-014): a first non-empty row whose only
 * content is a single cell reads as a title banner. Returns null when there
 * is no confident heading — callers must say so explicitly rather than guess.
 */
export function detectHeading(rows: CellValue[][]): string | null {
  for (const row of rows) {
    const filled = row.filter(
      (cell) => cell !== null && cell !== undefined && String(cell).trim() !== '',
    );
    if (filled.length === 0) continue;
    if (filled.length === 1) return String(filled[0]).trim();
    return null; // first content row is a normal data/header row
  }
  return null;
}

/**
 * Spoken workbook layout (NAVI-007): "This workbook has N tabs. Tab 1: …".
 */
export function describeLayout(title: string, tabs: WorkbookTab[]): string {
  const sorted = [...tabs].sort((a, b) => a.index - b.index);
  const count = sorted.length;
  let text = `Workbook "${title}" has ${count} tab${count === 1 ? '' : 's'}. `;

  sorted.forEach((tab, i) => {
    const cols = columnNumberToLetter(Math.max(tab.columnCount, 1));
    text += `Tab ${i + 1}: "${tab.title}" (${tab.rowCount} rows, columns A to ${cols})`;
    if (tab.charts.length > 0) {
      const chartList = tab.charts
        .map((c) => `"${c.title}" (${c.chartType.toLowerCase()} chart)`)
        .join(', ');
      text += ` containing ${tab.charts.length} chart${tab.charts.length === 1 ? '' : 's'}: ${chartList}`;
    }
    text += '. ';
  });

  return text.trim();
}

/**
 * Quotes a sheet title for use in an A1 range ("My Sheet" → "'My Sheet'"),
 * doubling embedded single quotes per the Sheets grammar.
 */
export function quoteSheetTitle(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

export interface TabSection {
  title: string;
  values: CellValue[][];
}

export interface WorkbookContextOptions {
  workbookTitle: string;
  tabs: WorkbookTab[];
  activeTabTitle: string;
  scope: ContextScope;
  /** Values for every tab included in the scope, keyed by tab title. */
  sections: TabSection[];
  /** Rows per tab fed to the model; the rest is noted, not silently cut. */
  maxRowsPerTab?: number;
}

/**
 * Builds the spreadsheet context string for the LLM: the layout overview
 * (always covers ALL tabs so NAVI can answer "what tabs are there?"), then
 * the data of the in-scope tab(s), each with its detected heading.
 */
export function buildWorkbookContext(options: WorkbookContextOptions): string {
  const {
    workbookTitle,
    tabs,
    activeTabTitle,
    scope,
    sections,
    maxRowsPerTab = 100,
  } = options;

  let context = `${describeLayout(workbookTitle, tabs)}\n`;
  context += `The user is currently on tab "${activeTabTitle}".\n`;
  context +=
    scope === 'file'
      ? 'Data scope: the ENTIRE workbook (all tabs below).\n\n'
      : `Data scope: only the current tab "${activeTabTitle}" (expandable from the NAVI menu).\n\n`;

  for (const section of sections) {
    const heading = detectHeading(section.values);
    context += `=== Tab: ${section.title} ===\n`;
    context += heading
      ? `Table heading: ${heading}\n`
      : 'No table heading detected.\n';

    const limited = section.values.slice(0, maxRowsPerTab);
    context += formatRows(section.title, limited);
    if (section.values.length > maxRowsPerTab) {
      context += `(${section.values.length - maxRowsPerTab} more rows not shown — ask NAVI to read specific rows.)\n`;
    }
    context += '\n';
  }

  return context.trim();
}
