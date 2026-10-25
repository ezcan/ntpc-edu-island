/** RFC 4180-style CSV parser: supports BOM, commas, quoted newlines and escaped quotes. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let closed = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
        closed = true;
      } else cell += ch;
    } else if (ch === '"') {
      if (cell || closed) throw new Error("CSV 引號位置錯誤");
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
      closed = false;
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
      cell = "";
      closed = false;
    } else {
      if (closed) throw new Error("CSV 結束引號後有多餘字元");
      cell += ch;
    }
  }
  if (quoted) throw new Error("CSV 引號未結束");
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
