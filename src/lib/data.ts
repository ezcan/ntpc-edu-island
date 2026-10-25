import { z } from "zod";
import zonesJson from "../data/zones.json";
import exhibitorsJson from "../data/exhibitors.json";
import schedulesJson from "../data/schedules.json";
import boothsJson from "../data/booths.json";
import servicesJson from "../data/services.json";
import eventsJson from "../data/events.json";
import sceneJson from "../data/scene-config.json";

export const zoneIdSchema = z.enum(["future", "maker", "research", "service"]);
export const periodSchema = z.enum(["morning", "afternoon"]);
export const dates = [
  "2026-11-12",
  "2026-11-13",
  "2026-11-14",
  "2026-11-15",
] as const;
const dateSchema = z
  .string()
  .refine(
    (v) =>
      /^\d{4}-\d{2}-\d{2}$/.test(v) &&
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "日期不合法",
  );
const httpUrl = z
  .url()
  .refine((v) => /^https?:\/\//.test(v), "網址必須使用 HTTP(S)");
const assetUrl = z
  .string()
  .refine(
    (v) => /^https:\/\//.test(v) || /^\/(?!\/)[^<>]*$/.test(v),
    "素材請用站內絕對路徑或 HTTPS 網址",
  );
export const exhibitorSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  type: z.enum(["school", "team"]),
  name: z.string().min(1),
  zoneId: zoneIdSchema,
  logo: assetUrl.nullable(),
  introduction: z.string().nullable(),
  exhibitTitle: z.string().nullable(),
  exhibitDescription: z.string().nullable(),
  learningHighlights: z.array(z.string()),
  interaction: z.string().nullable(),
  audience: z.string().nullable(),
  stampRule: z.string().nullable(),
  images: z.array(assetUrl),
  videos: z.array(httpUrl),
  officialUrl: httpUrl.nullable(),
  source: z.string().min(1),
  verificationStatus: z.enum([
    "pending-content",
    "confirmed",
    "pending-final-approval",
  ]),
});
const sessionSchema = z.object({
  date: dateSchema,
  period: periodSchema,
  zoneId: zoneIdSchema,
  exhibitorIds: z.array(z.string()).min(1),
  boothIds: z.array(z.string()).nullable(),
  status: z.enum(["pending-final-approval", "confirmed"]),
});
const position = z.tuple([z.number(), z.number(), z.number()]);
export const datasetSchema = z
  .object({
    zones: z.array(
      z.object({
        id: zoneIdSchema,
        name: z.string(),
        subtitle: z.string(),
        theme: z.string(),
        element: z.string(),
        color: z.string().regex(/^#[0-9a-f]{6}$/i),
        lightColor: z.string(),
        boothUnits: z.number().int().positive(),
        description: z.string(),
      }),
    ),
    exhibitors: z.array(exhibitorSchema),
    schedules: z.object({
      metadata: z.object({
        title: z.string(),
        version: z.string(),
        verificationStatus: z.string(),
        note: z.string(),
      }),
      periods: z.record(
        periodSchema,
        z.object({ label: z.string(), start: z.string(), end: z.string() }),
      ),
      sessions: z.array(sessionSchema),
    }),
    booths: z.object({
      status: z.string(),
      description: z.string(),
      units: z.array(
        z.object({
          id: z.string(),
          zoneId: zoneIdSchema,
          position: position.nullable(),
          confirmed: z.boolean(),
        }),
      ),
    }),
    services: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        zoneId: z.literal("service"),
        introduction: z.string().nullable(),
        images: z.array(assetUrl),
        officialUrl: httpUrl.nullable(),
        interaction: z.string().nullable(),
        sessions: z.array(z.object({ date: dateSchema, period: periodSchema })),
        source: z.string(),
        verificationStatus: z.string(),
      }),
    ),
    events: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        date: dateSchema,
        start: z.string().regex(/^\d\d:\d\d$/),
        end: z.string().regex(/^\d\d:\d\d$/),
        description: z.string().nullable(),
        location: z.string().nullable(),
        source: z.string(),
        status: z.string(),
      }),
    ),
    scene: z.object({
      status: z.string(),
      footprintMeters: z.array(z.number()),
      openSides: z.array(z.string()),
      wallSides: z.array(z.string()),
      island: z.object({
        radius: z.number().positive(),
        depth: z.number().positive(),
        grassColor: z.string(),
        earthColor: z.string(),
      }),
      zones: z.record(
        zoneIdSchema,
        z.object({ position, rotation: z.number() }),
      ),
      equipment: z.array(
        z.object({
          id: z.string(),
          type: z.enum(["screen", "photo-booth", "desk", "stamp"]),
          mount: z.enum(["wall", "mobile"]).optional(),
          position,
          referenceSizeMeters: position.optional(),
        }),
      ),
      mascotSlots: z.array(
        z.object({
          element: z.string(),
          zoneId: zoneIdSchema,
          modelUrl: assetUrl.nullable(),
          status: z.string(),
          position,
        }),
      ),
      models: z.array(
        z.object({
          file: z.string(),
          url: assetUrl.optional(),
          position,
          height: z.number().positive(),
          rotation: z.number(),
          animated: z.boolean().optional(),
        }),
      ),
    }),
  })
  .superRefine((d, ctx) => {
    const error = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });
    for (const key of ["zones", "exhibitors", "services", "events"] as const) {
      const seen = new Set<string>();
      d[key].forEach((v, i) => {
        if (seen.has(v.id)) error([key, i, "id"], `重複 ID：${v.id}`);
        seen.add(v.id);
      });
    }
    if (d.zones.length !== 4) error(["zones"], "必須包含完整四大展區");
    const ids = new Map(d.exhibitors.map((v) => [v.id, v]));
    const zones = new Set(d.zones.map((v) => v.id));
    d.exhibitors.forEach((e, i) => {
      if (!zones.has(e.zoneId)) error(["exhibitors", i, "zoneId"], "無效展區");
    });
    const booths = new Map(d.booths.units.map((v) => [v.id, v]));
    if (booths.size !== d.booths.units.length)
      error(["booths", "units"], "攤位 ID 重複");
    const seen = new Set<string>();
    d.schedules.sessions.forEach((s, i) => {
      const key = `${s.date}/${s.period}/${s.zoneId}`;
      if (seen.has(key)) error(["schedules", "sessions", i], "展區時段重複");
      seen.add(key);
      if (!dates.includes(s.date as (typeof dates)[number]))
        error(["schedules", "sessions", i, "date"], "不在展覽日期內");
      if (new Set(s.exhibitorIds).size !== s.exhibitorIds.length)
        error(["schedules", "sessions", i], "同時段參展者重複");
      s.exhibitorIds.forEach((id) => {
        if (!ids.has(id))
          error(["schedules", "sessions", i], `遺失參展者參照：${id}`);
        else if (ids.get(id)?.zoneId !== s.zoneId)
          error(["schedules", "sessions", i], `參展者展區不符：${id}`);
      });
      s.boothIds?.forEach((id) => {
        if (booths.get(id)?.zoneId !== s.zoneId)
          error(["schedules", "sessions", i], `攤位參照無效：${id}`);
      });
    });
    d.services.forEach((service, i) => {
      const seen = new Set<string>();
      service.sessions.forEach((session) => {
        const key = session.date + "/" + session.period;
        if (
          !dates.includes(session.date as (typeof dates)[number]) ||
          seen.has(key)
        )
          error(["services", i, "sessions"], "服務日期不在展期內或時段重複");
        seen.add(key);
      });
    });
    d.events.forEach((event, i) => {
      const validTime = (v: string) =>
        Number(v.slice(0, 2)) < 24 && Number(v.slice(3)) < 60;
      if (
        !validTime(event.start) ||
        !validTime(event.end) ||
        event.start >= event.end
      )
        error(["events", i], "活動起訖時間不合法");
    });
    for (const z of d.zones)
      if (
        d.booths.units.filter((b) => b.zoneId === z.id).length !== z.boothUnits
      )
        error(["booths"], "展區攤位單位數不符");
  });
export type Dataset = z.infer<typeof datasetSchema>;
export type ZoneId = z.infer<typeof zoneIdSchema>;
export type Period = z.infer<typeof periodSchema>;
export type Exhibitor = z.infer<typeof exhibitorSchema>;
export type Zone = Dataset["zones"][number];
export type Service = Dataset["services"][number];
export interface Filter {
  date: string | null;
  period: Period;
  search: string;
}
export const rawData = {
  zones: zonesJson,
  exhibitors: exhibitorsJson,
  schedules: schedulesJson,
  booths: boothsJson,
  services: servicesJson,
  events: eventsJson,
  scene: sceneJson,
};
export const validation = datasetSchema.safeParse(rawData);
export function selectExhibitors(
  d: Dataset,
  zone: ZoneId | null,
  filter: Filter,
) {
  const active = filter.date
    ? new Set(
        d.schedules.sessions
          .filter((s) => s.date === filter.date && s.period === filter.period)
          .flatMap((s) => s.exhibitorIds),
      )
    : null;
  return d.exhibitors.filter(
    (e) =>
      (!zone || e.zoneId === zone) &&
      (!active || active.has(e.id)) &&
      (!filter.search || e.name.includes(filter.search.trim())),
  );
}
export function sessionsFor(d: Dataset, id: string) {
  return d.schedules.sessions.filter((s) => s.exhibitorIds.includes(id));
}
export function activeServices(d: Dataset, filter: Filter) {
  return d.services.filter(
    (s) =>
      !filter.date ||
      s.sessions.some(
        (v) => v.date === filter.date && v.period === filter.period,
      ),
  );
}
export function currentSession(
  now = new Date(),
): { date: string; period: Period } | null {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: string) =>
    parts.find((p) => p.type === type)?.value || "";
  const date = `${value("year")}-${value("month")}-${value("day")}`;
  const hour = Number(value("hour"));
  return dates.includes(date as (typeof dates)[number]) &&
    hour >= 10 &&
    hour < 18
    ? { date, period: hour < 14 ? "morning" : "afternoon" }
    : null;
}
export function assetPath(path: string) {
  return path.startsWith("/") ? import.meta.env.BASE_URL + path.slice(1) : path;
}
export const shortDate = (date: string) =>
  `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`;
export const periodName = (p: Period) => (p === "morning" ? "上午" : "下午");
