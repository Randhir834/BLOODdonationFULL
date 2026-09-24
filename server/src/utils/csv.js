// A spreadsheet treats a cell that starts with one of these as a formula, so a name someone typed as
// "=HYPERLINK(...)" would run when the export is opened. A leading apostrophe makes it plain text.
const FORMULA_START = /^[=+\-@\t\r]/;

// Excel only reads a UTF-8 file as UTF-8 when it starts with this byte order mark.
const BOM = "﻿";

const cell = (value) => {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** rows: arrays of values, first row the header. Returns CSV text with CRLF line ends. */
export const toCsv = (rows) => `${BOM}${rows.map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
