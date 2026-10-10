// Your owned cards as a spreadsheet (CSV opens in Excel, Numbers and Google Sheets). Pure.

import type { ProfileExport } from "./profileData";

/** Quotes a cell, and keeps a spreadsheet from running a name that starts like a formula. */
export function csvCell(value: string | number | null | undefined): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ownedCardsCsv(data: Pick<ProfileExport, "owned">): string {
  const rows = [["Set", "Number", "Card", "Quantity"]];
  const sorted = [...data.owned].sort((a, b) => a.setName.localeCompare(b.setName) || String(a.number).localeCompare(String(b.number), undefined, { numeric: true }));
  for (const o of sorted) rows.push([o.setName, String(o.number), o.name, String(o.quantity)]);
  // The BOM makes Excel read accents (Pokémon, Flabébé) correctly.
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
