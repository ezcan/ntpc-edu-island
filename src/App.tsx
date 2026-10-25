import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Compass,
  Copy,
  ExternalLink,
  Flame,
  Home,
  Info,
  Layers3,
  Leaf,
  Maximize2,
  Minus,
  MousePointer2,
  Pause,
  Play,
  Plus,
  Search,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Waves,
  Wind,
  X,
  RotateCcw,
  MapPin,
  Clock3,
  BookOpen,
  ImageOff,
} from "lucide-react";
import {
  validation,
  dates,
  selectExhibitors,
  sessionsFor,
  activeServices,
  currentSession,
  shortDate,
  periodName,
  assetPath,
  type Dataset,
  type ZoneId,
  type Filter,
  type Exhibitor,
  type Service,
} from "./lib/data";
import type { IslandScene } from "./scene/IslandScene";

const icons = { future: Waves, maker: Flame, research: Wind, service: Leaf };
const weekdays = ["四", "五", "六", "日"];
interface Route {
  zone: ZoneId | null;
  exhibitorId: string | null;
  serviceId: string | null;
}
function parseRoute(d: Dataset): Route {
  const parts = location.hash.split("?")[0].split("/");
  if (parts[1] === "school") {
    const e = d.exhibitors.find((e) => e.id === parts[2]);
    if (e) return { zone: e.zoneId, exhibitorId: e.id, serviceId: null };
  }
  if (parts[1] === "service") {
    const e = d.services.find((e) => e.id === parts[2]);
    if (e) return { zone: "service", exhibitorId: null, serviceId: e.id };
  }
  if (parts[1] === "zone" && d.zones.some((z) => z.id === parts[2]))
    return { zone: parts[2] as ZoneId, exhibitorId: null, serviceId: null };
  return { zone: null, exhibitorId: null, serviceId: null };
}
function filterFromUrl(): Filter {
  const q = new URLSearchParams(location.hash.split("?")[1]);
  return {
    date: dates.includes(q.get("date") as (typeof dates)[number])
      ? q.get("date")
      : null,
    period: q.get("period") === "afternoon" ? "afternoon" : "morning",
    search: "",
  };
}
function routeHash(r: Route, f: Filter) {
  const path = r.exhibitorId
    ? `/school/${r.exhibitorId}`
    : r.serviceId
      ? `/service/${r.serviceId}`
      : r.zone
        ? `/zone/${r.zone}`
        : "/";
  return "#" + path + (f.date ? `?date=${f.date}&period=${f.period}` : "");
}
function MediaImage({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <div className={"image-fallback " + className}>
      <ImageOff size={20} />
      圖片暫時無法顯示
    </div>
  ) : (
    <img
      className={className}
      src={assetPath(src)}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
function Scene({
  d,
  zone,
  exhibitorId,
  filter,
  low,
  onSelect,
  onIssue,
  sceneRef,
}: {
  d: Dataset;
  zone: ZoneId | null;
  exhibitorId: string | null;
  filter: Filter;
  low: boolean;
  onSelect: (id: ZoneId) => void;
  onIssue: (s: string) => void;
  sceneRef: React.RefObject<IslandScene | null>;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const previousFocus = useRef<{
    zone: ZoneId | null;
    exhibitorId: string | null;
  } | null>(null);
  useEffect(() => {
    let stopped = false;
    let instance: IslandScene | null = null;
    import("./scene/IslandScene")
      .then(({ IslandScene }) => {
        if (stopped || !mount.current) return;
        try {
          instance = new IslandScene(
            mount.current,
            d,
            (id) => selectRef.current(id),
            onIssue,
          );
          sceneRef.current = instance;
          setReady(true);
        } catch {
          setFailed(true);
          onIssue("此裝置無法啟動 WebGL，請使用展區導覽與學校清單繼續探索。");
        }
      })
      .catch(() => {
        setFailed(true);
        onIssue("3D 模組無法載入，請使用文字版展區與學校清單。");
      });
    return () => {
      stopped = true;
      instance?.dispose();
      sceneRef.current = null;
    };
  }, [d]);
  useEffect(() => {
    if (!ready) return;
    const previous = previousFocus.current;
    previousFocus.current = { zone, exhibitorId };
    if (previous?.zone === zone && previous.exhibitorId && !exhibitorId) return;
    const booths = exhibitorId
      ? d.schedules.sessions
          .filter(
            (s) =>
              s.exhibitorIds.includes(exhibitorId) &&
              (!filter.date ||
                (s.date === filter.date && s.period === filter.period)),
          )
          .flatMap((s) => s.boothIds || [])
      : [];
    const booth =
      booths.length && new Set(booths).size === 1
        ? d.booths.units.find(
            (b) => b.id === booths[0] && b.confirmed && b.position,
          )
        : null;
    sceneRef.current?.focus(zone, booth?.position || undefined);
  }, [ready, zone, exhibitorId]);
  useEffect(() => {
    sceneRef.current?.updateLabels(filter, exhibitorId || undefined);
  }, [ready, filter, exhibitorId, zone]);
  useEffect(() => {
    sceneRef.current?.setQuality(low);
  }, [ready, low]);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    Object.defineProperty(window, "__islandDiagnostics", {
      configurable: true,
      get: () => sceneRef.current?.diagnostics,
    });
    return () => { Reflect.deleteProperty(window, "__islandDiagnostics"); };
  }, []);
  return (
    <div
      className="scene-stage"
      ref={mount}
      data-testid="scene-stage"
      aria-label="互動浮島"
    >
      {!ready && !failed && (
        <div className="scene-loading">
          <span className="loader" />
          正在喚醒教育科技島…
        </div>
      )}
      {failed && (
        <div className="webgl-fallback">
          <Compass size={40} />
          <h2>用文字，一樣能探索整座島</h2>
          <p>這個裝置無法顯示 3D。選擇任一展區，查看完整學校與輪值資訊。</p>
        </div>
      )}
    </div>
  );
}
export function App() {
  if (!validation.success)
    return (
      <main className="data-error">
        <h1>展示資料需要修正</h1>
        <p>請承辦人依下列位置修正 JSON；修正前暫停展示，避免顯示錯誤資料。</p>
        <ul>
          {validation.error.issues.map((e, i) => (
            <li key={i}>
              {e.path.join(".")}：{e.message}
            </li>
          ))}
        </ul>
      </main>
    );
  return <IslandApp d={validation.data} />;
}
function IslandApp({ d }: { d: Dataset }) {
  const [route, setRoute] = useState(() => parseRoute(d));
  const [filter, setFilter] = useState<Filter>(() => {
    const f = filterFromUrl(),
      r = parseRoute(d);
    return r.exhibitorId &&
      !selectExhibitors(d, r.zone, f).some((e) => e.id === r.exhibitorId)
      ? { ...f, date: null }
      : f;
  });
  const [low, setLow] = useState(() => innerWidth < 768);
  const [tour, setTour] = useState(false);
  const [modal, setModal] = useState<"help" | "events" | "about" | null>(null);
  const [issue, setIssue] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [current, setCurrent] = useState(currentSession);
  const scene = useRef<IslandScene | null>(null);
  const panel = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const zone = d.zones.find((z) => z.id === route.zone);
  const exhibitor = d.exhibitors.find((e) => e.id === route.exhibitorId);
  const service = d.services.find((s) => s.id === route.serviceId);
  const shown = selectExhibitors(d, route.zone, filter);
  const visibleServices = activeServices(d, filter);
  function navigate(next: Route, stop = true) {
    if (stop) setTour(false);
    setRoute(next);
    setDrawerOpen(true);
    history.pushState(null, "", routeHash(next, filter));
    panel.current?.scrollTo({ top: 0 });
  }
  function goZone(id: ZoneId, stop = true) {
    setFilter((f) => ({ ...f, search: "" }));
    navigate({ zone: id, exhibitorId: null, serviceId: null }, stop);
  }
  function home() {
    setFilter((f) => ({ ...f, search: "" }));
    navigate({ zone: null, exhibitorId: null, serviceId: null });
    scene.current?.focus(null);
  }
  function goExhibitor(e: Exhibitor) {
    navigate({ zone: e.zoneId, exhibitorId: e.id, serviceId: null });
  }
  function goService(s: Service) {
    navigate({ zone: "service", exhibitorId: null, serviceId: s.id });
  }
  function changeFilter(next: Filter) {
    let r = route;
    if (
      exhibitor &&
      !selectExhibitors(d, route.zone, next).some((e) => e.id === exhibitor.id)
    ) {
      r = { ...route, exhibitorId: null };
      setRoute(r);
      setNotice("已切換時段，返回此展區的參展清單。");
    }
    if (service && !activeServices(d, next).some((s) => s.id === service.id)) {
      r = { ...r, serviceId: null };
      setRoute(r);
      setNotice("該服務尚未設定此時段，已返回展示清單。");
    }
    setFilter(next);
    setTour(false);
    history.replaceState(null, "", routeHash(r, next));
  }
  useEffect(() => {
    const handler = () => {
      const r = parseRoute(d);
      let f = filterFromUrl();
      if (
        r.exhibitorId &&
        !selectExhibitors(d, r.zone, f).some((e) => e.id === r.exhibitorId)
      )
        f = { ...f, date: null };
      setRoute(r);
      setFilter(f);
      setDrawerOpen(true);
      setTour(false);
    };
    window.addEventListener("hashchange", handler);
    window.addEventListener("popstate", handler);
    return () => {
      window.removeEventListener("hashchange", handler);
      window.removeEventListener("popstate", handler);
    };
  }, [d]);
  useEffect(() => {
    const timer = setInterval(
      () =>
        setCurrent((old) => {
          const next = currentSession();
          return old?.date === next?.date && old?.period === next?.period
            ? old
            : next;
        }),
      1000,
    );
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    document.title = `${exhibitor?.name || service?.name || zone?.name || "2026 新北教育科技島"}｜新北教育科技島`;
    if (exhibitor || service) titleRef.current?.focus();
  }, [exhibitor, service, zone]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    if (!tour) return;
    const order = d.zones.map((z) => z.id);
    let i = Math.max(0, order.indexOf(route.zone || "future"));
    goZone(order[i], false);
    const timer = setInterval(() => {
      i = (i + 1) % order.length;
      goZone(order[i], false);
    }, 7500);
    return () => clearInterval(timer);
  }, [tour]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (modal) setModal(null);
        else if (exhibitor || service) goZone(route.zone!);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  async function share() {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setNotice("請複製瀏覽器網址，即可分享目前介紹頁。");
    }
  }
  const schoolTotal = d.exhibitors.filter((e) => e.type === "school").length,
    teamTotal = d.exhibitors.filter((e) => e.type === "team").length;
  const zoneStyle = zone
    ? ({
        "--zone": zone.color,
        "--zone-light": zone.lightColor,
      } as CSSProperties)
    : undefined;
  const filteredCount = selectExhibitors(d, null, filter).length;
  return (
    <div className="app-shell">
      <a
        href="#content-panel"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          panel.current?.focus();
        }}
      >
        跳至展區與學校清單
      </a>
      <header className="topbar">
        <button
          className="brand"
          onClick={home}
          aria-label="新北教育科技島首頁"
        >
          <span className="brand-symbol">
            <Layers3 size={25} />
          </span>
          <span>
            <strong>新北教育科技島</strong>
            <small>2026 臺灣教育科技展</small>
          </span>
        </button>
        <div className="date-console" aria-label="日期與時段篩選">
          <button
            className={"all-date " + (!filter.date ? "active" : "")}
            aria-pressed={!filter.date}
            onClick={() => changeFilter({ ...filter, date: null })}
          >
            <Layers3 size={15} />
            <span>全部學校</span>
          </button>
          <div className="dates">
            {dates.map((date, i) => (
              <button
                key={date}
                aria-label={`${shortDate(date)} 星期${weekdays[i]}`}
                aria-pressed={filter.date === date}
                className={filter.date === date ? "active" : ""}
                onClick={() => changeFilter({ ...filter, date })}
              >
                <b>{shortDate(date)}</b>
                <small>（{weekdays[i]}）</small>
              </button>
            ))}
          </div>
          <div
            className={"periods " + (!filter.date ? "muted" : "")}
            aria-label="時段"
          >
            {(["morning", "afternoon"] as const).map((period) => (
              <button
                disabled={!filter.date}
                key={period}
                aria-pressed={filter.period === period && !!filter.date}
                onClick={() => changeFilter({ ...filter, period })}
              >
                {periodName(period)}
              </button>
            ))}
          </div>
        </div>
        <div className="header-actions">
          <button
            className="icon-button"
            aria-label="活動時間表"
            onClick={() => setModal("events")}
          >
            <CalendarDays size={20} />
          </button>
          <button
            className="icon-button"
            aria-label="操作說明"
            onClick={() => setModal("help")}
          >
            <Info size={20} />
          </button>
        </div>
      </header>
      <main className={"island-main " + (zone ? "has-zone" : "")}>
        <Scene
          d={d}
          zone={route.zone}
          exhibitorId={route.exhibitorId}
          filter={filter}
          low={low}
          sceneRef={scene}
          onSelect={goZone}
          onIssue={setIssue}
        />
        <div className="intro">
          <div className="eyebrow">
            <span />
            從新北出發，探索學習的未來
          </div>
          <h1>
            小小島嶼，
            <br />
            大大<span>學習力。</span>
          </h1>
          <p>
            讓好奇帶路，讓想像發生。
            <br />
            一起發現教育的下一種可能。
          </p>
          <span className="explore-note">
            <MousePointer2 size={14} />
            點選島上建築，開始探索
          </span>
        </div>
        <nav className="zone-nav" aria-label="四大主題展區">
          <span className="nav-caption">選一個方向，開始探索</span>
          {d.zones.map((z, i) => {
            const Icon = icons[z.id];
            return (
              <button
                key={z.id}
                aria-pressed={z.id === route.zone}
                className={z.id === route.zone ? "selected" : ""}
                style={
                  {
                    "--zone": z.color,
                    "--zone-light": z.lightColor,
                  } as CSSProperties
                }
                onClick={() => goZone(z.id)}
              >
                <span className="nav-icon">
                  <Icon size={19} />
                </span>
                <span>
                  <strong>{z.name}</strong>
                  <small>{z.theme}</small>
                </span>
                <span className="nav-number">0{i + 1}</span>
                <ChevronRight size={15} />
              </button>
            );
          })}
        </nav>
        <div className="scene-meta">
          <span className="live-dot" />
          {filter.date
            ? `${shortDate(filter.date)} ${periodName(filter.period)}・${filteredCount} 組輪值`
            : "自由探索模式"}
          <span className="meta-divider" />
          展位配置為示意
        </div>
        <aside
          ref={panel}
          id="content-panel"
          tabIndex={-1}
          className={
            "info-panel " + (drawerOpen ? "drawer-open" : "drawer-closed")
          }
          style={zoneStyle}
          aria-label="展區與成果介紹"
        >
          <button
            className="drawer-handle"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((v) => !v)}
          >
            <span />
            {drawerOpen ? "收合介紹" : "展開介紹"}
            <ChevronDown size={16} />
          </button>
          <div className="panel-inner">
            <div className="breadcrumb">
              <button onClick={home} aria-label="返回全島">
                <Home size={13} />
                <span>教育科技島</span>
              </button>
              {zone && (
                <>
                  <ChevronRight size={12} />
                  <button onClick={() => goZone(zone.id)}>{zone.name}</button>
                </>
              )}
              {(exhibitor || service) && (
                <>
                  <ChevronRight size={12} />
                  <span className="current-crumb">
                    {exhibitor?.name || service?.name}
                  </span>
                </>
              )}
            </div>
            {!zone && (
              <>
                <div className="panel-eyebrow">
                  <Sparkles size={14} />
                  學習的未來，在這裡相遇
                </div>
                <h2 className="overview-title">
                  一座島嶼，
                  <br />
                  無限種可能。
                </h2>
                <p className="panel-copy">
                  四種教育能量，在新北交會。
                  <br />
                  走進每個展區，遇見正在發生的學習。
                </p>
                <div className="stats">
                  <div>
                    <b>
                      {schoolTotal}
                      <span>所</span>
                    </b>
                    <small>參展學校</small>
                  </div>
                  <div>
                    <b>
                      {teamTotal}
                      <span>組</span>
                    </b>
                    <small>教育團隊</small>
                  </div>
                  <div>
                    <b>
                      4<span>大</span>
                    </b>
                    <small>主題展區</small>
                  </div>
                </div>
                <label className="search-field home-search">
                  <Search size={16} />
                  <input
                    aria-label="搜尋全島學校或團隊"
                    placeholder="尋找參展學校或團隊"
                    value={filter.search}
                    onChange={(e) =>
                      setFilter({ ...filter, search: e.target.value })
                    }
                  />
                  {filter.search && (
                    <button
                      aria-label="清除全島搜尋"
                      onClick={() => setFilter({ ...filter, search: "" })}
                    >
                      <X size={14} />
                    </button>
                  )}
                </label>
                {filter.search && (
                  <div className="exhibitor-list search-results">
                    <div className="list-heading">
                      <h3>搜尋結果</h3>
                      <small>{shown.length} 筆</small>
                    </div>
                    {shown.map((e) => (
                      <ExhibitorCard
                        key={e.id}
                        e={e}
                        d={d}
                        open={() => goExhibitor(e)}
                      />
                    ))}
                    {!shown.length && (
                      <p className="panel-copy">找不到符合的學校或團隊。</p>
                    )}
                  </div>
                )}
                <div className="section-label">
                  <span>你的探索地圖</span>
                  <small>點選展區，認識學校</small>
                </div>
                <div className="zone-cards">
                  {d.zones.map((z) => {
                    const Icon = icons[z.id];
                    const entries = selectExhibitors(d, z.id, filter);
                    return (
                      <button
                        key={z.id}
                        style={
                          {
                            "--zone": z.color,
                            "--zone-light": z.lightColor,
                          } as CSSProperties
                        }
                        onClick={() => goZone(z.id)}
                      >
                        <span className="zone-card-icon">
                          <Icon size={23} />
                        </span>
                        <span>
                          <strong>{z.name}</strong>
                          <small>
                            {z.id === "service"
                              ? `${visibleServices.length} 項${filter.date ? "本時段" : "規劃"}服務`
                              : `${entries.filter((e) => e.type === "school").length} 所學校${entries.some((e) => e.type === "team") ? `・${entries.filter((e) => e.type === "team").length} 組團隊` : ""}`}
                          </small>
                        </span>
                        <ArrowUpRight size={19} />
                      </button>
                    );
                  })}
                </div>
                <button
                  className="event-feature"
                  onClick={() => setModal("events")}
                >
                  <span className="event-date">
                    11<span>13</span>
                  </span>
                  <span>
                    <small>特別活動・15:00–15:40</small>
                    <strong>龍埔國小教育部公開授課</strong>
                    <span>
                      查看活動時間表 <ArrowRight size={13} />
                    </span>
                  </span>
                </button>
                <div className="preparation-note">
                  <span />
                  展前探索開放中
                  <p>
                    輪值依第一次籌備會議紀錄建立，
                    <br />
                    展示內容與實體配置待最終核定。
                  </p>
                </div>
              </>
            )}
            {zone && !exhibitor && !service && (
              <>
                <div className="zone-heading">
                  <span className="zone-element">
                    {(() => {
                      const Icon = icons[zone.id];
                      return <Icon size={27} />;
                    })()}
                  </span>
                  <div>
                    <div className="panel-eyebrow">
                      {zone.element}的能量 · {zone.theme}
                    </div>
                    <h2>{zone.name}</h2>
                  </div>
                </div>
                <p className="zone-subtitle">{zone.subtitle}</p>
                <p className="panel-copy">{zone.description}</p>
                <div className="zone-summary">
                  <span>
                    <b>
                      {zone.id === "service"
                        ? visibleServices.length
                        : shown.length}
                    </b>{" "}
                    {zone.id === "service" ? "項展示服務" : "所學校／組團隊"}
                  </span>
                  <span>{zone.boothUnits} 個實體攤位單位</span>
                </div>
                {zone.id !== "service" && (
                  <label className="search-field">
                    <Search size={17} />
                    <input
                      aria-label="搜尋學校或團隊"
                      placeholder="搜尋學校或團隊"
                      value={filter.search}
                      onChange={(e) =>
                        setFilter({ ...filter, search: e.target.value })
                      }
                    />
                    {filter.search && (
                      <button
                        aria-label="清除搜尋"
                        onClick={() => setFilter({ ...filter, search: "" })}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </label>
                )}
                <div className="list-heading">
                  <h3>
                    {zone.id === "service" ? "展示服務" : "參展學校與團隊"}
                  </h3>
                  <small>
                    {filter.date
                      ? `${shortDate(filter.date)} ${periodName(filter.period)}`
                      : "全部日期"}
                  </small>
                </div>
                <div className="exhibitor-list">
                  {zone.id === "service"
                    ? visibleServices.map((s, i) => (
                        <button
                          className="service-card"
                          key={s.id}
                          onClick={() => goService(s)}
                        >
                          <span>0{i + 1}</span>
                          <div>
                            <h3>{s.name}</h3>
                            <p>{s.introduction || "介紹資料待更新"}</p>
                          </div>
                          <ChevronRight size={17} />
                        </button>
                      ))
                    : shown.map((e) => (
                        <ExhibitorCard
                          key={e.id}
                          e={e}
                          d={d}
                          open={() => goExhibitor(e)}
                        />
                      ))}
                  {((zone.id === "service" && !visibleServices.length) ||
                    (zone.id !== "service" && !shown.length)) && (
                    <div className="empty-state">
                      <Search size={27} />
                      <h3>
                        {filter.search
                          ? "找不到符合的學校或團隊"
                          : "此時段展示項目待確認"}
                      </h3>
                      <p>
                        {filter.search
                          ? "試試其他名稱，或清除搜尋。"
                          : "切換「全部學校」查看規劃中的展示服務。"}
                      </p>
                    </div>
                  )}
                </div>
                <p className="content-status">
                  <Info size={14} />
                  學校與服務介紹持續更新中；輪值待最終核定。
                </p>
              </>
            )}
            {exhibitor && (
              <>
                <button
                  className="back-link"
                  onClick={() => goZone(exhibitor.zoneId)}
                >
                  <ArrowLeft size={15} />
                  返回學校與團隊清單
                </button>
                <div className="detail-identity">
                  {exhibitor.logo ? (
                    <MediaImage
                      src={exhibitor.logo}
                      alt={`${exhibitor.name}校徽`}
                      className="school-logo"
                    />
                  ) : (
                    <span className="school-monogram">
                      {exhibitor.name.slice(0, 2)}
                    </span>
                  )}
                  <span className="type-tag">
                    {exhibitor.type === "team" ? "教育團隊" : "參展學校"}
                  </span>
                </div>
                <h2 className="detail-title" tabIndex={-1} ref={titleRef}>
                  {exhibitor.name}
                </h2>
                <div className="detail-subtitle">
                  <MapPin size={14} />
                  {zone?.name}
                  <span className="pending-badge">
                    {exhibitor.verificationStatus === "confirmed"
                      ? "資料已確認"
                      : "介紹資料待更新"}
                  </span>
                </div>
                <DetailSection
                  number="01"
                  title={exhibitor.type === "team" ? "團隊介紹" : "學校介紹"}
                >
                  <p>{exhibitor.introduction || "介紹資料待更新"}</p>
                  {exhibitor.officialUrl && (
                    <a
                      className="external-link"
                      href={exhibitor.officialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      前往官方網站 <ExternalLink size={14} />
                    </a>
                  )}
                </DetailSection>
                <DetailSection number="02" title="這次展出什麼？">
                  {exhibitor.exhibitTitle && <h4>{exhibitor.exhibitTitle}</h4>}
                  <p>{exhibitor.exhibitDescription || "展出成果資料待更新"}</p>
                  {exhibitor.learningHighlights.length > 0 && (
                    <ul>
                      {exhibitor.learningHighlights.map((h) => (
                        <li key={h}>{h}</li>
                      ))}
                    </ul>
                  )}
                  {exhibitor.images.length > 0 && (
                    <div className="media-gallery">
                      {exhibitor.images.map((src, i) => (
                        <MediaImage
                          key={src}
                          src={src}
                          alt={`${exhibitor.name}成果照片 ${i + 1}`}
                        />
                      ))}
                    </div>
                  )}
                  {exhibitor.videos.map((url, i) => (
                    <a
                      className="external-link"
                      href={url}
                      key={url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      觀看成果影片 {i + 1} <ExternalLink size={14} />
                    </a>
                  ))}
                </DetailSection>
                <DetailSection number="03" title="現場可以體驗什麼？">
                  <p>{exhibitor.interaction || "現場互動內容待更新"}</p>
                  {exhibitor.audience && <p>適合對象：{exhibitor.audience}</p>}
                  {exhibitor.stampRule && (
                    <p>集章條件：{exhibitor.stampRule}</p>
                  )}
                </DetailSection>
                <DetailSection number="04" title="展出資訊">
                  <div className="session-list">
                    {sessionsFor(d, exhibitor.id).map((s) => (
                      <div key={s.date + s.period}>
                        <CalendarDays size={15} />
                        <b>{shortDate(s.date)}</b>
                        <span>{periodName(s.period)}</span>
                        <small>
                          {d.schedules.periods[s.period].start}–
                          {d.schedules.periods[s.period].end}
                        </small>
                        {s.boothIds?.map((id) => {
                          const booth = d.booths.units.find(
                            (b) => b.id === id && b.confirmed,
                          );
                          return booth ? (
                            <small key={id}>展位 {id}</small>
                          ) : null;
                        })}
                      </div>
                    ))}
                  </div>
                  <p className="fine-print">輪值待最終核定・實際展位尚未確認</p>
                </DetailSection>
                <button className="primary-button" onClick={share}>
                  {copied ? <Check size={16} /> : <Share2 size={16} />}{" "}
                  {copied
                    ? "已複製連結"
                    : exhibitor.type === "team"
                      ? "分享團隊介紹"
                      : "分享這所學校"}
                </button>
                <div className="school-pagination">
                  {[-1, 1].map((dir) => {
                    const idx = shown.findIndex((e) => e.id === exhibitor.id),
                      next = shown[idx + dir];
                    return (
                      <button
                        key={dir}
                        disabled={!next}
                        onClick={() => next && goExhibitor(next)}
                      >
                        {dir < 0 && <ArrowLeft size={15} />}
                        <span>
                          {dir < 0 ? "上一所／組" : "下一所／組"}
                          <small>{next?.name || "已到清單邊界"}</small>
                        </span>
                        {dir > 0 && <ArrowRight size={15} />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            {service && (
              <>
                <button className="back-link" onClick={() => goZone("service")}>
                  <ArrowLeft size={15} />
                  返回服務清單
                </button>
                <span className="service-detail-symbol">
                  <Leaf size={34} />
                </span>
                <h2 className="detail-title" tabIndex={-1} ref={titleRef}>
                  {service.name}
                </h2>
                <DetailSection number="01" title="服務介紹">
                  <p>{service.introduction || "介紹資料待更新"}</p>
                  {service.images.map((src, i) => (
                    <MediaImage
                      key={src}
                      src={src}
                      alt={`${service.name}展示圖片 ${i + 1}`}
                    />
                  ))}
                  {service.officialUrl && (
                    <a
                      className="external-link"
                      href={service.officialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      官方服務網站 <ExternalLink size={14} />
                    </a>
                  )}
                </DetailSection>
                <DetailSection number="02" title="現場互動方式">
                  <p>{service.interaction || "現場互動內容待更新"}</p>
                </DetailSection>
                <DetailSection number="03" title="展示時段">
                  {service.sessions.length ? (
                    service.sessions.map((s) => (
                      <p key={s.date + s.period}>
                        {shortDate(s.date)} {periodName(s.period)}
                      </p>
                    ))
                  ) : (
                    <p>每日展示項目與時段待承辦人確認。</p>
                  )}
                </DetailSection>
                <button className="primary-button" onClick={share}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}{" "}
                  {copied ? "已複製連結" : "分享服務資訊"}
                </button>
              </>
            )}
          </div>
        </aside>
        <div className="view-controls">
          <div className="view-buttons">
            <button
              aria-label="放大浮島"
              onClick={() => scene.current?.zoom(1)}
            >
              <Plus size={18} />
            </button>
            <button
              aria-label="縮小浮島"
              onClick={() => scene.current?.zoom(-1)}
            >
              <Minus size={18} />
            </button>
            <span />
            <button
              aria-label="向左旋轉浮島"
              onClick={() => scene.current?.rotate(-1)}
            >
              <RotateCcw size={17} />
            </button>
            <button aria-label="返回全島" onClick={home}>
              <Maximize2 size={17} />
            </button>
          </div>
          <button
            className={"tour-button " + (tour ? "playing" : "")}
            aria-pressed={tour}
            onClick={() => setTour((v) => !v)}
          >
            {tour ? (
              <Pause size={15} fill="currentColor" />
            ) : (
              <Play size={15} fill="currentColor" />
            )}
            {tour ? "暫停導覽" : "自動導覽"}
          </button>
        </div>
        {issue && (
          <div className="scene-issue" role="status">
            <Info size={15} />
            {issue}
            <button aria-label="關閉提示" onClick={() => setIssue("")}>
              <X size={15} />
            </button>
          </div>
        )}
      </main>
      <footer className="footer">
        <span>
          <span className="footer-mark">N</span>新北市政府教育局
          <span className="footer-separator" />
          2026.11.12 — 11.15
        </span>
        <span className="footer-center">
          <MousePointer2 size={13} />
          拖曳旋轉<span>・</span>滾輪縮放<span>・</span>點選探索
        </span>
        <div>
          <button aria-pressed={low} onClick={() => setLow((v) => !v)}>
            <SlidersHorizontal size={14} />
            {low ? "省電畫質" : "標準畫質"}
          </button>
          <button onClick={() => setModal("about")}>
            關於這座島 <ArrowUpRight size={13} />
          </button>
        </div>
      </footer>
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
      {current && (
        <button
          className="current-session"
          onClick={() => changeFilter({ ...filter, ...current })}
        >
          查看目前展出
        </button>
      )}
      {modal && (
        <Modal
          title={
            modal === "help"
              ? "讓好奇帶路，一起探索"
              : modal === "events"
                ? "四天的精彩，一次掌握"
                : "關於這座教育科技島"
          }
          close={() => setModal(null)}
        >
          {modal === "help" && (
            <div className="help-content">
              <div>
                <MousePointer2 />
                <span>
                  <b>自在探索</b>
                  <p>拖曳旋轉、滾輪縮放；手機使用單指旋轉、雙指縮放或平移。</p>
                </span>
              </div>
              <div>
                <Compass />
                <span>
                  <b>走進一個展區</b>
                  <p>
                    點選建築、島上名牌或展區按鈕，鏡頭會帶你靠近，並展開學校清單。
                  </p>
                </span>
              </div>
              <div>
                <BookOpen />
                <span>
                  <b>認識學校成果</b>
                  <p>
                    點選學校卡片查看介紹與輪值；可分享網址，或用上一所／下一所繼續探索。
                  </p>
                </span>
              </div>
              <div>
                <CalendarDays />
                <span>
                  <b>選擇你的參觀時段</b>
                  <p>
                    使用頂部日期與上午／下午切換。網站預設顯示全部學校，非「目前展出」。
                  </p>
                </span>
              </div>
              <p className="fine-print">
                鍵盤：Tab 選取、Enter 啟動；聚焦 3D 後，← → 旋轉、+ − 縮放、Home
                返回全島。Esc 關閉視窗或返回清單。
              </p>
            </div>
          )}
          {modal === "events" && (
            <>
              <p className="panel-copy">
                展覽日期：2026/11/12（四）至 11/15（日）
                <br />
                上午 10:00–14:00・下午 14:00–18:00
              </p>
              <div className="event-list">
                {d.events
                  .filter((e) => !filter.date || e.date === filter.date)
                  .map((e) => (
                    <article key={e.id}>
                      <span className="event-pill">特別活動</span>
                      <h3>{e.name}</h3>
                      <p>
                        <CalendarDays size={15} />
                        {shortDate(e.date)}
                        <Clock3 size={15} />
                        {e.start}–{e.end}
                      </p>
                      {e.description && <p>{e.description}</p>}
                      <small>不計入一般輪值學校數・待最終核定</small>
                    </article>
                  ))}
                {filter.date &&
                  !d.events.some((e) => e.date === filter.date) && (
                    <p>所選日期尚無特別活動資料。</p>
                  )}
              </div>
              <button
                className="primary-button"
                onClick={() => {
                  setModal(null);
                  goZone("future");
                }}
              >
                查看學校輪值 <ArrowRight size={16} />
              </button>
            </>
          )}
          {modal === "about" && (
            <>
              <p className="panel-copy">
                以一座可探索的浮空島，認識新北的教育科技。四大展區串起 29
                所學校、2 組教育團隊與 3 項教育服務。
              </p>
              <p className="panel-copy">
                目前為展前探索版本。輪值來源為使用者提供的第一次籌備會議紀錄；所有輪值與配置待最終核定。未取得的學校簡介與成果會明確標示待更新。
              </p>
              <p className="panel-copy">
                小通家族模型尚未提供，場景中的中性暫代物件僅為
                placeholder，並非正式角色。場景藝術原創；部分模型採 Kenney CC0
                素材，授權與參考專案詳見專案 LICENSES.md。
              </p>
              <a
                className="external-link"
                href={assetPath("/templates/exhibitors.csv")}
                download
              >
                下載承辦人資料回填模板 <ArrowUpRight size={15} />
              </a>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
function ExhibitorCard({
  e,
  d,
  open,
}: {
  e: Exhibitor;
  d: Dataset;
  open: () => void;
}) {
  return (
    <button
      className="exhibitor-card"
      onClick={open}
      aria-label={`查看${e.name}成果`}
      data-testid={`exhibitor-${e.id}`}
    >
      {e.images[0] && (
        <MediaImage
          src={e.images[0]}
          alt={`${e.name}成果縮圖`}
          className="card-photo"
        />
      )}
      <div className="card-top">
        {e.logo ? (
          <MediaImage
            src={e.logo}
            alt={`${e.name}校徽`}
            className="card-logo"
          />
        ) : (
          <span className="card-monogram">{e.name.slice(0, 2)}</span>
        )}
        <div>
          <h3>{e.name}</h3>
          <span>{e.type === "team" ? "教育團隊" : "參展學校"}</span>
        </div>
        <ArrowUpRight size={17} />
      </div>
      <p>{e.introduction || "介紹資料待更新"}</p>
      <div className="exhibit-title">{e.exhibitTitle || "展出主題待更新"}</div>
      {e.exhibitDescription && (
        <p className="card-description">{e.exhibitDescription}</p>
      )}
      <div className="card-bottom">
        <div className="date-tags">
          {sessionsFor(d, e.id).map((s) => (
            <span key={s.date + s.period}>
              {shortDate(s.date)} {periodName(s.period)}
            </span>
          ))}
        </div>
        <span>
          查看成果 <ChevronRight size={12} />
        </span>
      </div>
    </button>
  );
}
function DetailSection({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="detail-section">
      <h3>
        <span>{number}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    function trap(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const items = Array.from(
          ref.current!.querySelectorAll<HTMLElement>(
            'button,a[href],input,[tabindex="0"]',
          ),
        ).filter((el) => !el.hasAttribute("disabled"));
        const first = items[0],
          last = items.at(-1);
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    const el = ref.current!;
    el.addEventListener("keydown", trap);
    return () => {
      el.removeEventListener("keydown", trap);
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop" onClick={close}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close icon-button"
          aria-label="關閉視窗"
          onClick={close}
        >
          <X size={21} />
        </button>
        <div className="panel-eyebrow">
          <Compass size={15} />
          2026 新北教育科技島
        </div>
        <h2 id="modal-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}
