/**
 * CSV writer. Cells that start with = + - @ (or tab/CR) are prefixed with an
 * apostrophe so spreadsheet apps never execute customer-supplied text as a
 * formula (CSV injection). Output starts with a UTF-8 BOM so Excel shows Bangla.
 */
export function csvCell(value: unknown): string {
  if (value == null) return "";
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  const lines = [header, ...rows].map((r) => r.map(csvCell).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}
