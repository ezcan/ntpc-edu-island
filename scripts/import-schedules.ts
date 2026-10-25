import fs from "node:fs";
import path from "node:path";
import { parseCsv } from "../src/lib/csv";
import { rawData, datasetSchema } from "../src/lib/data";
const input = process.argv[2];
if (!input) {
  console.error(
    "用法：npm run import:schedules -- <檔案.csv> [--write]（整份輪值更新，預設僅驗證）",
  );
  process.exit(1);
}
try {
  const [headers, ...rows] = parseCsv(fs.readFileSync(input, "utf8"));
  const expected = [
    "date",
    "period",
    "zoneId",
    "exhibitorIds",
    "boothIds",
    "status",
  ];
  if (JSON.stringify(headers) !== JSON.stringify(expected))
    throw new Error("請使用 public/templates/schedules.csv 的欄位與順序");
  const sessions = rows.map((cells, i) => {
    if (cells.length !== expected.length)
      throw new Error(`第 ${i + 2} 行欄位數錯誤`);
    return {
      date: cells[0],
      period: cells[1],
      zoneId: cells[2],
      exhibitorIds: JSON.parse(cells[3]),
      boothIds: JSON.parse(cells[4]),
      status: cells[5],
    };
  });
  const d = datasetSchema.parse({
    ...rawData,
    schedules: { ...rawData.schedules, sessions },
  });
  if (d.schedules.sessions.length !== 24)
    throw new Error("須保留四天 × 上下午 × 三個輪值展區的完整 24 筆時段");
  for (const e of d.exhibitors)
    if (!sessions.some((s) => s.exhibitorIds.includes(e.id)))
      throw new Error(`參展者缺少輪值：${e.id}`);
  if (process.argv.includes("--write")) {
    const target = path.resolve("src/data/schedules.json");
    const backup = target + "." + Date.now() + ".local";
    fs.copyFileSync(target, backup);
    const schedules = {
      ...d.schedules,
      metadata: {
        ...d.schedules.metadata,
        version: "csv-import-" + new Date().toISOString(),
      },
    };
    fs.writeFileSync(
      target + ".tmp",
      JSON.stringify(schedules, null, 2) + "\n",
    );
    fs.renameSync(target + ".tmp", target);
    console.log(`已更新完整輪值，原檔備份：${backup}`);
  } else console.log(`24 筆輪值驗證通過，未寫入；加上 --write 套用。`);
} catch (e) {
  console.error(
    "輪值匯入失敗，原始資料未變更：",
    e instanceof Error ? e.message : e,
  );
  process.exit(1);
}
