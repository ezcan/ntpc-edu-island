# 2026 新北教育科技島

可自由探索的 Three.js 浮空島，將四大展區、學校／團隊介紹及四天輪值整合在同一個資料驅動前端。介面採臺灣繁體中文，不需要後端、資料庫或密鑰。

## 執行

建議 Node.js 24；最低 Node.js 22.12。首次取得專案：

```bash
npm ci
npm run dev
```

開發伺服器預設埠為 5173。`npm install` 亦已實際執行；重現既有版本請使用有完整性校驗的 `npm ci`。專案 npm 快取位於忽略的 `.npm-cache/`，適用雲端受限 HOME。

```bash
npm run typecheck
npm run validate:data
npm test
npm run test:e2e
npm run build
npm run preview
```

正式靜態檔案在 `dist/`。支援一般靜態網站主機；hash 路由不需要伺服器 rewrite。部署到子路徑時，以 `VITE_BASE=/ntpc-edu-island/ npm run build` 建置；模型、模板與站內素材均使用此 base。`VITE_BASE` 是非秘密的建置參數。

端對端測試優先使用 `/usr/bin/chromium`（雲端已安裝）。其他系統先執行 `npx playwright install chromium`，或以 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 指定瀏覽器。測試會啟動／重用 5173 的 Vite 伺服器，使用 Chromium 軟體 WebGL，結果與失敗追蹤寫入忽略的 `test-results/` 及 `playwright-report/`。

## 已實作

- 原創厚底浮島、四種建築、中央雕塑、連通步道、樹木、雲、數據粒子、齒輪、風車、行人、螢幕與四個角色插槽。
- 十個實際 Kenney CC0 GLB，含建築、家具、人物與花卉；非僅下載而未使用。
- OrbitControls 自由旋轉／縮放／平移、GSAP 鏡頭聚焦、Raycaster 與可鍵盤操作的 CSS2D 名牌、區域高亮、自動導覽播放／暫停、全島返回。
- 浮島 → 展區 → 學校／團隊 → 成果詳情；清單直接位於展區面板。全島／區內搜尋、麵包屑、前後學校切換、網址深連結與複製分享。
- 四天上午／下午切換；清單與場景名牌共用輪值資料。切換時段保留鏡頭，離開時段的已選學校會清除並提示。
- 首頁預設全部學校；只有展覽實際營運時間才提供依 Asia/Taipei 判定的「查看目前展出」。
- 三項服務的各自詳情頁、可更新的每日服務時段；龍埔國小特別活動有獨立時間表。
- 手機底部可收合抽屜與較高的詳細內容面板；省電畫質、reduced-motion、鍵盤與模態視窗焦點管理。
- InstancedMesh 植物與粒子、依材質合併靜態幾何、DPR 上限、非同步 GLB 載入、延遲圖片與分包 3D 模組。
- GLB 失敗時替代物件、圖片錯誤替代內容、WebGL 失敗時可操作文字清單、JSON 錯誤路徑診斷。

## 資料結構

| 檔案                         | 用途                                                                   |
| ---------------------------- | ---------------------------------------------------------------------- |
| `src/data/zones.json`        | 四大主題名稱、顏色、元素、介紹、實體攤位單位數                         |
| `src/data/booths.json`       | 6 / 6 / 2 / 2，共 16 個實體單位；位置 null、未核定                     |
| `src/data/exhibitors.json`   | 29 所學校與 2 組團隊；school / team 分開                               |
| `src/data/schedules.json`    | 四天 × 兩時段 × 三個輪值展區，共 24 筆 session；來源、版本與待核定狀態 |
| `src/data/events.json`       | 龍埔國小 11/13 15:00–15:40 公開授課，不計入一般學校                    |
| `src/data/services.json`     | 校園通 APP、教育大數據平臺、新北星聯盟與每日時段                       |
| `src/data/scene-config.json` | 示意區域座標、旋轉、設備、模型與角色插槽                               |

`src/lib/data.ts` 用 Zod 定義 TypeScript 型別與跨檔參照驗證，檢查日期、重複 ID、無效展區、遺失學校／攤位參照與危險網址。UI 與建置使用相同 schema。學校詳情與輪值分開存放，不因多次出展重複簡介。

目前數量：**29 所學校 + 2 組團隊**。16 個單位是實體面積，非同時展示數。服務區不採一般學校卡片；每日時段尚未提供，指定日期時明確顯示待確認，全部模式可查看三項規劃服務。

## 承辦人更新內容

直接編輯 JSON，或使用 UTF-8 CSV 模板，不需要修改 TypeScript。先備份資料、確認來源與核定狀態；不要用生成內容填補未知事實。

```bash
# 預設僅驗證，不寫入；回填穩定 id 的既有資料
npm run import:csv -- public/templates/exhibitors.csv
npm run import:csv -- /path/to/回填資料.csv --write

# 完整輪值更新：必須有完整 24 筆與全部參展者
npm run import:schedules -- public/templates/schedules.csv
npm run import:schedules -- /path/to/新版輪值.csv --write
npm run validate:data
npm test
npm run build
```

- `public/templates/exhibitors.csv` 有全 31 筆穩定 ID；`exhibitor-template.json` 提供完整物件範本。
- CSV 空白欄位**保留既有值**；輸入字面值 `null` 清空可為 null 的欄位。
- `learningHighlights`、`images`、`videos` 使用 JSON 陣列，例如 `["協作探究"]`、`["/images/sanmin/work-01.jpg"]`；輸入 `[]` 清空陣列。CSV 編輯器會處理內含引號與逗號。
- 匯入僅更新既有 id，拒絕重複 id、未知欄位與不合法網址；通過完整資料驗證才原子寫入。每次寫入前產生 `.時間戳.local` 原檔備份，已加入忽略規則。
- 照片放 `public/images/<id>/`，JSON 以 `/images/<id>/file.jpg` 指定；HTTPS 外部圖片亦可。請先確認肖像權與使用授權，圖片只在有資料時顯示。
- `officialUrl` 僅在經查證後填入。影片使用 HTTP(S) 連結，UI 以安全新分頁開啟，不自動載入第三方追蹤播放器。
- 確認後將 `verificationStatus` 改為 `confirmed`；不可只改狀態而不補實際來源。
- `schedules.csv` 的 `exhibitorIds` 與 `boothIds` 使用 JSON；未核定位置維持 `null`。更新來源／版本請同步編輯 metadata。
- 服務每日展出項目在 `services.json` 的 `sessions` 更新，例如 `{"date":"2026-11-12","period":"morning"}`。初始為空，不推定每天展示。

## 展場配置與模型替換

`scene-config.json` 是 **12 × 12 公尺概念配置**，北側與東側為展示牆、南側與西側開放；含四臺壁掛螢幕、兩臺移動螢幕、拍貼機、服務臺與集章設施。所有設備與區域座標可調整，不是最終施工圖。16 個實體單位位於 booths.json，不會被生成為 16 個獨立商店。

取得正式展位時，在 `booths.json` 填入位置並設 `confirmed: true`，再於 session 填入 `boothIds`。只有選定輪值有唯一可確認的位置時才聚焦該展位；否則維持所屬展區焦點，不任意分配學校固定建築。

`public/models/kenney/` 是已授權輔助素材；正式特色模型可放 `public/models/custom/`，在 scene-config 的 `models` 設定 `file` 識別名、`url: "/models/custom/檔名.glb"`、height、座標及旋轉。未設定 url 時使用 kenney 目錄。四個官方角色請放 `public/models/mascots/`，直接在 `mascotSlots.modelUrl` 填站內路徑；正式 GLB 會取代該區中性 placeholder。不可未經授權重繪官方小通家族。角色需有實際動畫時，再以正式檔提供的 clip 綁定 AnimationMixer，現階段不宣稱已有官方骨架動畫。

## 仍待補齊

- 全部 29 所學校與 2 組團隊的簡介、成果、作品圖片／影片、校徽、官方連結及互動／集章規則；初始資料全為 null 或 []，畫面清楚標示待更新。
- 三項服務的介紹、官方連結、圖片、互動方式與每日展出時段。
- 四個小通正式模型與新北正式品牌素材；目前為中性 placeholder 與自製介面圖記。
- 所有輪值、實際展位對應與設備配置須承辦人最終核定。學校數、團隊數與特別活動已分開。
- 未在實際展場硬體量測 FPS；雲端瀏覽器採軟體 WebGL，只驗證功能。請於展示設備與目標中階手機實測後選用標準／省電模式。

授權與四個指定參考專案的評估見 [LICENSES.md](LICENSES.md)。實際驗證紀錄見 [docs/VALIDATION.md](docs/VALIDATION.md)。

## 雲端任務啟動

既有 checkout 位於 `/workspace/ntpc-edu-island`。每次任務已隔離，使用現有 checkout，不另建 Git worktree。依賴與 `dist/` 可隨快照保留；伺服器程序需在新任務重啟。可重用安裝與啟動步驟已另存環境設定草稿，草稿儲存不代表環境已發布。

畫面紀錄：[桌機全島](docs/screenshots/desktop.png)・[學校介紹](docs/screenshots/school.png)・[手機探索](docs/screenshots/mobile.png)。

## GitHub Pages 自動部署

倉庫：<https://github.com/ezcan/ntpc-edu-island>。

`.github/workflows/deploy-pages.yml` 會在推送 `main` 時，以 Node.js 24 安裝鎖定套件、校驗十個模型、執行單元測試及正式建置，再部署到 GitHub Pages。官方 Actions 固定至已查證的完整 commit SHA。

- Pages 的建置來源使用 **GitHub Actions**。
- 建置自動設定 `VITE_BASE=/ntpc-edu-island/`，模型、圖片、模板與分享連結支援專案子路徑。
- 啟用並成功部署後，網站網址為 <https://ezcan.github.io/ntpc-edu-island/>。
- 部署紀錄：<https://github.com/ezcan/ntpc-edu-island/actions/workflows/deploy-pages.yml>。
- 網頁內容為公開的展前版本；學校與團隊簡介、正式小通模型、最終輪值與配置仍待提供／核定，網站明確標示。

如果環境無法呼叫 GitHub API，首次啟用須由有權限者至倉庫 Settings → Pages，將 Source 設為 GitHub Actions，再於 Actions 重跑部署。後續推送 main 即自動更新，不必重新設定。
