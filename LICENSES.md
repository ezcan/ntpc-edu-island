# 素材、授權與參考來源

本專案未使用或複製「HEART 政策島」的程式、模型、圖片、品牌或其他受保護內容。主島、四個主題建築、雕塑、道路、植物實例、介面及場景配置為本次專案製作。官方新北識別、校徽與小通家族原始素材尚未提供，介面圖記不代表正式政府標誌。

## 實際使用的第三方素材

| 來源                                                                                                          | 版本／授權                                                  | 實際使用方式                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Kenney](https://kenney.nl/assets)，由 [Hidencod/tge-assets](https://github.com/Hidencod/tge-assets) 提供 GLB | `7be9b573bc74f32ed766b44b3f46550d02ca83b5`，CC0 1.0         | 十個模型：City Kit Commercial 的 building-a、building-c；Furniture Kit 的 desk、chair、computerscreen、bench；Mini Characters 的 character-female-a、character-male-a、character-female-c；Nature Kit 的 flower-purplea。 |
| [threejs-interactive-cubes](https://github.com/leonichevAndrei/threejs-interactive-cubes)                     | `ecbe03d24e422384fbd2639a52f35d0d38daa8ff`，README 宣告 MIT | 移植 Raycaster 選取流程至 `src/scene/picking.ts`，改為 canvas 座標、Pointer Events、拖曳／多指排除、遞迴選取與完整清理。未整包合併 src。                                                                                  |
| Three.js                                                                                                      | npm 鎖定版本，MIT                                           | Renderer、OrbitControls、CSS2DRenderer、GLTFLoader、RoundedBoxGeometry、BufferGeometryUtils。                                                                                                                             |
| React / React DOM                                                                                             | npm 鎖定版本，MIT                                           | 可存取的資訊面板與互動 UI。                                                                                                                                                                                               |
| Lucide React                                                                                                  | npm 鎖定版本，ISC（含上游 Feather MIT 聲明）                | 介面圖示。                                                                                                                                                                                                                |
| Zod                                                                                                           | npm 鎖定版本，MIT                                           | JSON schema 與匯入驗證。                                                                                                                                                                                                  |
| [GSAP](https://gsap.com/standard-license/)                                                                    | 3.15.0，Standard “no charge” license                        | 僅使用核心鏡頭動畫；**GSAP 不是 MIT 授權**。依其標準授權使用，未使用付費素材或未授權套件。                                                                                                                                |

十個 GLB 共約 1.08 MB，已在來源端轉成內嵌貼圖 GLB；沒有為求通過檢查而修改任何來源校驗值。逐檔來源、原作者、位元組數與 SHA-256 見 `public/models/manifest.json`。模型未以放大圖片或重型後製替代即時 3D。

原始 CC0 聲明與 npm 依賴授權保留於 `docs/third-party/`。互動參考倉庫未附獨立 LICENSE，README 明確宣告 MIT；已保留來源、作者歸屬與標準 MIT 許可文字。發布前仍可依組織程序檢視此來源聲明。

## 已檢查但未直接納入的參考專案

| 專案                                                                                        | 檢查結果                                                                                                                                                                                                 | 採用決定                                                                                                     |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [satoLG/portfolio](https://github.com/satoLG/portfolio)                                     | `e32fd55a0182186d89054ca4bf5628b24b887435`；Vite 5、TypeScript、Three.js 0.183.2、cannon-es；src/core、src/scene、shaders、音樂及角色等。README 宣告 MIT，但樹中無獨立 LICENSE，音訊與模型仍須逐一確認。 | 參考浮島、分層場景及裝置品質設計；**不複製其程式、美術、音樂或模型**，避免移植不必要的物理／音訊與不明資產。 |
| [RoySung/thress-building-playground](https://github.com/RoySung/thress-building-playground) | `8da348d78d33e80972e90ca76890825429bdc1d1`；單一 main.js、Vite 5、Three.js 0.185.1，README 宣告程式 MIT。MODEL_CREDITS.md 註明 threejsassets.com Free Tier 模型不可重新散布原始資產。                    | 參考多模式鏡頭與城市氛圍；**不複製其模型或程式**。以自製展館與可散布的 Kenney CC0 模型整合。                 |
| Kenney Building Kit / Mini Characters 等                                                    | tge-assets 有 City、Nature、Furniture、Mini Characters 等 19 個分類；未收錄獨立 Building Kit。                                                                                                           | 只取實際使用的十個模型，其餘不下載到本專案。                                                                 |

GitHub API 在本環境遭代理拒絕；檢查透過平台既有 HTTPS Git 驗證完成，讀取固定 revision 的檔案，未停用 TLS、套件完整性或簽章驗證。

## 內容與 placeholder

- 三十一筆學校／團隊介紹與三項服務介紹、官方網址、照片、影片與互動內容尚未提供，維持 null 或空陣列。
- 四個小通模型插槽以中性灰色 placeholder 物件表示，不是官方角色設計，也未宣稱替代物件為小通家族。
- Kenney 人物是一般場景訪客，不是學校學生的真實肖像或小通角色。
- 輪值依使用者提供的第一次籌備會議紀錄初始化，不代表最終核定。
- 原創內容的權利歸屬與後續授權應由專案方決定；本文件中的第三方 MIT／CC0 不會自動套用到所有專案內容。
