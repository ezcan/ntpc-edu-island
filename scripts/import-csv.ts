import fs from "node:fs";
import path from "node:path";
import { parseCsv } from "../src/lib/csv";
import { rawData, datasetSchema, exhibitorSchema } from "../src/lib/data";
const input = process.argv[2];
const write = process.argv.includes("--write");
if (!input) {
  console.error(
    "用法：npm run import:csv -- <檔案.csv> [--write]（預設僅驗證）",
  );
  process.exit(1);
}
try {
  const [headers, ...rows] = parseCsv(fs.readFileSync(input, "utf8"));
  const allowed = [
    "id",
    "introduction",
    "exhibitTitle",
    "exhibitDescription",
    "learningHighlights",
    "interaction",
    "audience",
    "stampRule",
    "officialUrl",
    "logo",
    "images",
    "videos",
    "verificationStatus",
  ];
  if (
    !headers ||
    headers[0] !== "id" ||
    new Set(headers).size !== headers.length ||
    headers.some((h) => !allowed.includes(h))
  )
    throw new Error("欄位不合法，請使用 public/templates/exhibitors.csv");
  const data = structuredClone(rawData);
  const seen = new Set();
  rows.forEach((cells, index) => {
    if (cells.length !== headers.length)
      throw new Error(`第 ${index + 2} 行欄位數錯誤`);
    const id = cells[0];
    if (seen.has(id)) throw new Error(`重複 ID：${id}`);
    seen.add(id);
    const entry = data.exhibitors.find((e) => e.id === id);
    if (!entry) throw new Error(`未知 ID：${id}`);
    const updates: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      if (i === 0 || !cells[i].trim()) return;
      const value = cells[i].trim();
      updates[h] =
        value === "null"
          ? null
          : ["images", "videos", "learningHighlights"].includes(h)
            ? JSON.parse(value)
            : value;
    });
    Object.assign(entry, exhibitorSchema.parse({ ...entry, ...updates }));
  });
  datasetSchema.parse(data);
  if (write) {
    const target = path.resolve("src/data/exhibitors.json");
    const backup = target + "." + Date.now() + ".local";
    fs.copyFileSync(target, backup);
    fs.writeFileSync(
      target + ".tmp",
      JSON.stringify(data.exhibitors, null, 2) + "\n",
    );
    fs.renameSync(target + ".tmp", target);
    console.log(`已匯入 ${rows.length} 筆，原檔保留於 ${backup}`);
  } else console.log(`已驗證 ${rows.length} 筆，未寫入。加上 --write 套用。`);
} catch (e) {
  console.error(
    "匯入失敗，原始資料未變更：",
    e instanceof Error ? e.message : e,
  );
  process.exit(1);
}
