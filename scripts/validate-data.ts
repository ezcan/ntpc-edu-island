import { validation } from "../src/lib/data";
if (!validation.success) {
  console.error("資料驗證失敗：", validation.error.issues);
  process.exit(1);
}
const d = validation.data;
console.log(
  `資料驗證通過：${d.zones.length} 展區、${d.exhibitors.filter((e) => e.type === "school").length} 所學校、${d.exhibitors.filter((e) => e.type === "team").length} 組團隊、${d.schedules.sessions.length} 展區輪值時段、${d.booths.units.length} 攤位單位、${d.services.length} 項服務、${d.events.length} 場特別活動。`,
);
