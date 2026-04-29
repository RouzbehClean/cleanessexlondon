import * as XLSX from "xlsx";

export function downloadXlsx(filename: string, sheets: { name: string; rows: Record<string, unknown>[] }[]) {
  const wb = XLSX.utils.book_new();
  for (const { name, rows } of sheets) {
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename);
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function isCurrent(effective_to: string | null) {
  if (!effective_to) return true;
  return effective_to >= todayIso();
}
