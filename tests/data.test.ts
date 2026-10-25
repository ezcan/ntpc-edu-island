import { describe, it, expect } from "vitest";
import {
  datasetSchema,
  rawData,
  validation,
  selectExhibitors,
  currentSession,
  activeServices,
  sessionsFor,
} from "../src/lib/data";
import { parseCsv } from "../src/lib/csv";
if (!validation.success) throw validation.error;
const d = validation.data;
const names = (
  zone: "future" | "maker" | "research",
  date: string,
  period: "morning" | "afternoon",
) => selectExhibitors(d, zone, { date, period, search: "" }).map((e) => e.name);
describe("輪值資料與資訊誠實性", () => {
  it("29 所學校、2 組團隊，31 個獨立 ID；16 個實體單位分開計算", () => {
    expect(d.exhibitors.filter((e) => e.type === "school")).toHaveLength(29);
    expect(d.exhibitors.filter((e) => e.type === "team")).toHaveLength(2);
    expect(new Set(d.exhibitors.map((e) => e.id)).size).toBe(31);
    expect(d.booths.units).toHaveLength(16);
  });
  it("全部學校模式是 16 / 8 / 5+2，特別活動不混入學校", () => {
    expect(
      selectExhibitors(d, "future", {
        date: null,
        period: "morning",
        search: "",
      }),
    ).toHaveLength(16);
    expect(
      selectExhibitors(d, "maker", {
        date: null,
        period: "morning",
        search: "",
      }),
    ).toHaveLength(8);
    expect(
      selectExhibitors(d, "research", {
        date: null,
        period: "morning",
        search: "",
      }),
    ).toHaveLength(7);
    expect(d.exhibitors.some((e) => e.name.includes("龍埔"))).toBe(false);
    expect(d.events[0].start).toBe("15:00");
    expect(d.events[0].end).toBe("15:40");
  });
  it("11/12 上午正確顯示三個展區", () => {
    expect(names("future", "2026-11-12", "morning")).toEqual([
      "三民高中",
      "中港國小",
    ]);
    expect(names("maker", "2026-11-12", "morning")).toEqual(["江翠國中"]);
    expect(names("research", "2026-11-12", "morning")).toEqual(["頂溪國小"]);
  });
  it("11/14 上午同時展出學校與輔導團隊，下午只有團隊", () => {
    expect(names("research", "2026-11-14", "morning")).toEqual([
      "新店國小",
      "智慧學習輔導小組",
    ]);
    expect(names("research", "2026-11-14", "afternoon")).toEqual([
      "智慧學習輔導小組",
    ]);
  });
  it("11/15 兩時段為同一 DOC／北區輔導團組別", () => {
    expect(names("research", "2026-11-15", "morning")).toEqual([
      "數位機會中心／北區輔導團",
    ]);
    expect(names("research", "2026-11-15", "afternoon")).toEqual([
      "數位機會中心／北區輔導團",
    ]);
  });
  it("四天八時段每個展區都有有效輪值，每位參展者至少有一時段", () => {
    expect(d.schedules.sessions).toHaveLength(24);
    d.exhibitors.forEach((e) =>
      expect(sessionsFor(d, e.id).length).toBeGreaterThan(0),
    );
    for (const date of ["2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"])
      for (const period of ["morning", "afternoon"])
        for (const zone of ["future", "maker", "research"])
          expect(
            d.schedules.sessions.filter(
              (s) =>
                s.date === date && s.period === period && s.zoneId === zone,
            ),
          ).toHaveLength(1);
  });
  it("未提供的介紹、成果與位置保持空值", () => {
    d.exhibitors.forEach((e) => {
      expect(e.introduction).toBeNull();
      expect(e.exhibitDescription).toBeNull();
      expect(e.images).toEqual([]);
      expect(e.officialUrl).toBeNull();
    });
    d.schedules.sessions.forEach((s) => expect(s.boothIds).toBeNull());
    d.booths.units.forEach((b) => expect(b.confirmed).toBe(false));
  });
  it("服務展示未設定每日時段，不能冒稱當日展出", () => {
    expect(
      activeServices(d, { date: null, period: "morning", search: "" }),
    ).toHaveLength(3);
    expect(
      activeServices(d, { date: "2026-11-12", period: "morning", search: "" }),
    ).toHaveLength(0);
  });
  it("臺灣時區的目前展出僅在展覽營運時間成立", () => {
    expect(currentSession(new Date("2026-10-25T03:00:00Z"))).toBeNull();
    expect(currentSession(new Date("2026-11-12T01:59:00Z"))).toBeNull();
    expect(currentSession(new Date("2026-11-12T02:00:00Z"))).toEqual({
      date: "2026-11-12",
      period: "morning",
    });
    expect(currentSession(new Date("2026-11-12T06:00:00Z"))?.period).toBe(
      "afternoon",
    );
    expect(currentSession(new Date("2026-11-12T10:00:00Z"))).toBeNull();
    expect(currentSession(new Date("2026-11-16T02:00:00Z"))).toBeNull();
  });
  it("搜尋可跨區且不改變資料", () => {
    expect(
      selectExhibitors(d, null, {
        date: null,
        period: "morning",
        search: "三民",
      }).map((e) => e.id),
    ).toEqual(["sanmin"]);
  });
});
describe("不合法資料有明確診斷", () => {
  it.each([
    "duplicate",
    "bad-date",
    "missing-ref",
    "bad-zone",
    "bad-booth",
    "unsafe-url",
    "duplicate-session",
  ])("%s 會被拒絕", (kind) => {
    const copy = structuredClone(rawData);
    if (kind === "duplicate") copy.exhibitors[1].id = copy.exhibitors[0].id;
    if (kind === "bad-date") copy.schedules.sessions[0].date = "2026-02-30";
    if (kind === "missing-ref")
      copy.schedules.sessions[0].exhibitorIds = ["does-not-exist"];
    if (kind === "bad-zone") copy.exhibitors[0].zoneId = "unknown";
    if (kind === "bad-booth")
      (
        copy.schedules.sessions[0] as unknown as { boothIds: string[] }
      ).boothIds = ["unknown"];
    if (kind === "unsafe-url")
      (copy.exhibitors[0] as unknown as { officialUrl: string }).officialUrl =
        "javascript:alert(1)";
    if (kind === "duplicate-session")
      copy.schedules.sessions.push(copy.schedules.sessions[0]);
    const result = datasetSchema.safeParse(copy);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.length).toBeGreaterThan(0);
  });
});
describe("承辦人 CSV 匯入", () => {
  it("正確處理 UTF-8 BOM、繁中、逗號、換行與雙引號", () => {
    expect(
      parseCsv(
        '\uFEFFid,introduction\r\nsanmin,"第一行，含逗號,\n第二行有""引號"""\r\n',
      ),
    ).toEqual([
      ["id", "introduction"],
      ["sanmin", '第一行，含逗號,\n第二行有"引號"'],
    ]);
  });
  it("拒絕不完整引號與錯誤結尾", () => {
    expect(() => parseCsv('id,x\n"oops')).toThrow();
    expect(() => parseCsv('id,x\n"oops"junk')).toThrow();
  });
});
