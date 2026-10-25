import { test, expect, type Page } from "@playwright/test";
async function ready(page: Page) {
  await page.waitForFunction(() =>
    Boolean(
      (window as unknown as { __islandDiagnostics?: { pendingModels: number } })
        .__islandDiagnostics?.pendingModels === 0,
    ),
  );
}
async function zone(page: Page, name: string) {
  await page
    .getByRole("navigation", { name: "四大主題展區" })
    .getByRole("button", { name: new RegExp(name) })
    .click();
}
const panel = (page: Page) =>
  page.getByRole("complementary", { name: "展區與成果介紹" });
test("首頁啟動真實 WebGL，載入十個模型，旋轉與縮放能改變鏡頭", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await ready(page);
  await expect(
    page.getByRole("button", { name: "全部學校", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const before = await page.evaluate(() => (window as any).__islandDiagnostics);
  expect(before.loadedModels).toBe(10);
  expect(before.modelFailures).toEqual([]);
  expect(before.drawCalls).toBeGreaterThan(0);
  await page.getByRole("button", { name: "向左旋轉浮島", exact: true }).click();
  await page.waitForTimeout(1100);
  const after = await page.evaluate(() => (window as any).__islandDiagnostics);
  expect(after.camera[0]).not.toBeCloseTo(before.camera[0], 1);
  await page.getByRole("button", { name: "放大浮島", exact: true }).click();
  await page.waitForTimeout(1100);
  expect(
    (await page.evaluate(() => (window as any).__islandDiagnostics)).camera,
  ).not.toEqual(after.camera);
  expect(errors).toEqual([]);
});
test("四區均可從 3D 名牌進入且立即顯示清單", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  for (const [id, name, count] of [
    ["future", "未來學習室", 16],
    ["maker", "科技創客坊", 8],
    ["research", "跨域研究所", 7],
    ["service", "新北服務站", 3],
  ] as const) {
    // Always approach each label from the overview; focused cameras may place other zones off-screen.
    await page.getByRole("button", { name: "新北教育科技島首頁" }).click();
    await page.waitForFunction(() => (window as any).__islandDiagnostics?.cameraAnimating === false);
    const label = await page.locator(`.zone-label[data-zone="${id}"]`).boundingBox();
    if (!label) throw new Error("展區名牌沒有可點選範圍");
    // The island gently floats, so click the actual screen location without requiring a frozen label.
    await page.mouse.click(label.x + label.width / 2, label.y + label.height / 2);
    await expect(
      panel(page).getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    expect(
      await panel(page)
        .locator(id === "service" ? ".service-card" : ".exhibitor-card")
        .count(),
    ).toBe(count);
  }
});
test("11/12 上午未來學習室名單與場景名牌同步", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  await zone(page, "未來學習室");
  await page.getByRole("button", { name: "11/12 星期四", exact: true }).click();
  await expect(panel(page).locator(".exhibitor-card")).toHaveCount(2);
  await expect(
    panel(page).getByRole("heading", { name: "三民高中", exact: true }),
  ).toBeVisible();
  await expect(
    panel(page).getByRole("heading", { name: "中港國小", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('.zone-label[data-zone="future"] .label-names'),
  ).toHaveText("三民高中・中港國小");
});
test("11/14 上午新店與輔導組同時展出；11/15 上下午為同一 DOC 團隊", async ({
  page,
}) => {
  await page.goto("/");
  await zone(page, "跨域研究所");
  await page.getByRole("button", { name: "11/14 星期六", exact: true }).click();
  await expect(panel(page).locator(".exhibitor-card")).toHaveCount(2);
  await expect(
    panel(page).getByRole("heading", { name: "新店國小", exact: true }),
  ).toBeVisible();
  await expect(
    panel(page).getByRole("heading", { name: "智慧學習輔導小組", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "11/15 星期日", exact: true }).click();
  await expect(panel(page).locator(".exhibitor-card")).toHaveCount(1);
  await expect(
    panel(page).getByRole("heading", {
      name: "數位機會中心／北區輔導團",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "下午", exact: true }).click();
  await expect(
    panel(page).getByRole("heading", {
      name: "數位機會中心／北區輔導團",
      exact: true,
    }),
  ).toBeVisible();
});
test("學校詳情、返回、前後切換、深連結與清除跨時段選取", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await ready(page);
  await zone(page, "未來學習室");
  await panel(page)
    .getByRole("button", { name: "查看三民高中成果", exact: true })
    .click();
  await expect(
    panel(page).getByRole("heading", { name: "三民高中", exact: true }),
  ).toBeVisible();
  await expect(
    panel(page).getByText("介紹資料待更新", { exact: true }),
  ).toHaveCount(2);
  await expect(
    panel(page).getByText("10:00–14:00", { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/#\/school\/sanmin/);
  await expect(
    page.locator('.zone-label[data-zone="future"] .label-names'),
  ).toHaveText("三民高中");
  await panel(page)
    .getByRole("button", { name: "分享這所學校", exact: true })
    .click();
  await expect(
    panel(page).getByRole("button", { name: "已複製連結", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "#/school/sanmin",
  );
  await page.reload();
  await expect(
    panel(page).getByRole("heading", { name: "三民高中", exact: true }),
  ).toBeVisible();
  await panel(page)
    .getByRole("button", { name: /下一所／組/ })
    .click();
  await expect(
    panel(page).getByRole("heading", { name: "中港國小", exact: true }),
  ).toBeVisible();
  await panel(page)
    .getByRole("button", { name: /上一所／組/ })
    .click();
  await page.waitForFunction(
    () => (window as any).__islandDiagnostics?.cameraAnimating === false,
  );
  await page.getByRole("button", { name: "向左旋轉浮島", exact: true }).click();
  await page.waitForTimeout(1200);
  const rotatedCamera = await page.evaluate(
    () => (window as any).__islandDiagnostics.camera,
  );
  await page.getByRole("button", { name: "11/13 星期五", exact: true }).click();
  await page.waitForTimeout(1200);
  const filteredCamera = await page.evaluate(
    () => (window as any).__islandDiagnostics.camera,
  );
  filteredCamera.forEach((v: number, i: number) =>
    expect(v).toBeCloseTo(rotatedCamera[i], 6),
  );
  await expect(
    panel(page).getByRole("heading", { name: "參展學校與團隊", exact: true }),
  ).toBeVisible();
  await expect(
    panel(page).getByRole("heading", { name: "三民高中", exact: true }),
  ).toHaveCount(0);
});
test("全島搜尋與服務獨立資訊頁、活動不混入一般學校", async ({ page }) => {
  await page.goto("/");
  await panel(page)
    .getByRole("textbox", { name: "搜尋全島學校或團隊" })
    .fill("三民");
  await expect(panel(page).locator(".exhibitor-card")).toHaveCount(1);
  await panel(page).getByRole("button", { name: "查看三民高中成果" }).click();
  await expect(
    panel(page).getByRole("heading", { name: "三民高中", exact: true }),
  ).toBeVisible();
  await zone(page, "新北服務站");
  await panel(page)
    .getByRole("button", { name: /校園通 APP/ })
    .click();
  await expect(
    panel(page).getByRole("heading", { name: "校園通 APP", exact: true }),
  ).toBeVisible();
  await expect(
    panel(page).getByText("每日展示項目與時段待承辦人確認。"),
  ).toBeVisible();
  await page.getByRole("button", { name: "活動時間表", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "龍埔國小教育部公開授課",
  );
  await expect(page.getByRole("dialog")).toContainText("15:00–15:40");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("指定時段服務未核定時不宣稱當時展出，切換時段保留鏡頭", async ({
  page,
}) => {
  await page.goto("/#/zone/service");
  await ready(page);
  await page.waitForFunction(
    () => (window as any).__islandDiagnostics?.cameraAnimating === false,
  );
  const before = await page.evaluate(
    () => (window as any).__islandDiagnostics.camera,
  );
  await page.getByRole("button", { name: "11/12 星期四", exact: true }).click();
  await expect(
    panel(page).getByRole("heading", { name: "此時段展示項目待確認" }),
  ).toBeVisible();
  await page.waitForTimeout(1200);
  const after = await page.evaluate(
    () => (window as any).__islandDiagnostics.camera,
  );
  after.forEach((v: number, i: number) => expect(v).toBeCloseTo(before[i], 6));
});
test("WebGL 無法啟動時有可操作清單與詳情", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: any[]
    ) {
      if (
        type === "webgl2" ||
        type === "webgl" ||
        type === "experimental-webgl"
      )
        return null;
      return original.apply(this, [type, ...args] as any);
    } as typeof original;
  });
  await page.goto("/");
  await expect(page.getByText("用文字，一樣能探索整座島")).toBeVisible();
  await zone(page, "未來學習室");
  await expect(panel(page).locator(".exhibitor-card")).toHaveCount(16);
  await panel(page).getByRole("button", { name: "查看三民高中成果" }).click();
  await expect(
    panel(page).getByRole("heading", { name: "三民高中", exact: true }),
  ).toBeVisible();
});
test("手機有可操作 3D、底部抽屜與學校詳情，沒有橫向溢出", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto("/");
  await ready(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const drawer = page.getByRole("button", { name: "收合介紹", exact: true });
  await drawer.tap();
  await expect(
    page.getByRole("button", { name: "展開介紹", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "四大主題展區" })
    .getByRole("button", { name: /未來學習室/ })
    .tap();
  await expect(
    panel(page).getByRole("heading", { name: "未來學習室", exact: true }),
  ).toBeVisible();
  await panel(page).getByRole("button", { name: "查看三民高中成果" }).tap();
  await expect(
    panel(page).getByRole("heading", { name: "三民高中", exact: true }),
  ).toBeVisible();
  await panel(page).getByRole("button", { name: "返回學校與團隊清單" }).tap();
  await expect(panel(page).locator(".exhibitor-card")).toHaveCount(16);
  await page.screenshot({ path: "test-results/mobile.png" });
  await context.close();
});

test("建築射線選取可開啟展區，拖曳旋轉不誤選", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  await page.waitForTimeout(1800);
  const point = await page.evaluate(() =>
    (window as any).__islandDiagnostics.zoneScreenPositions.find(
      (p: any) => p.id === "future",
    ),
  );
  await page.mouse.click(point.x, point.y);
  await expect(
    panel(page).getByRole("heading", { name: "未來學習室", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "新北教育科技島首頁" }).click();
  await page.waitForTimeout(1800);
  const before = await page.evaluate(
    () => (window as any).__islandDiagnostics.camera,
  );
  const box = await page.locator(".scene-stage canvas").boundingBox();
  if (!box) throw new Error("沒有 3D 畫布");
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.65);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width * 0.7 + 90,
    box.y + box.height * 0.65,
    { steps: 10 },
  );
  await page.mouse.up();
  await page.waitForTimeout(1200);
  expect(
    await page.evaluate(() => (window as any).__islandDiagnostics.camera),
  ).not.toEqual(before);
  await expect(
    panel(page).getByRole("heading", { name: "一座島嶼， 無限種可能。" }),
  ).toBeVisible();
});
test("GLB 載入失敗顯示替代物件，其他互動保持正常", async ({ page }) => {
  await page.route("**/models/kenney/building-a.glb", (route) =>
    route.fulfill({ status: 404, body: "not found" }),
  );
  await page.goto("/");
  await ready(page);
  expect(
    await page.evaluate(
      () => (window as any).__islandDiagnostics.modelFailures,
    ),
  ).toEqual(["building-a.glb"]);
  await expect(
    page.getByText("部分模型載入失敗，已顯示替代物件。"),
  ).toBeVisible();
  await zone(page, "科技創客坊");
  await expect(panel(page).locator(".exhibitor-card")).toHaveCount(8);
});
test("成果圖片不存在仍可開啟學校詳情並顯示替代內容", async ({ page }) => {
  const { readFileSync } = await import("node:fs");
  const exhibitors = JSON.parse(
    readFileSync("src/data/exhibitors.json", "utf8"),
  );
  exhibitors[0].images = ["/images/test-missing.jpg"];
  await page.route("**/src/data/exhibitors.json*", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "export default " + JSON.stringify(exhibitors),
    }),
  );
  await page.route("**/images/test-missing.jpg", (route) =>
    route.fulfill({ status: 404, body: "missing" }),
  );
  await page.goto("/#/school/sanmin");
  await expect(
    panel(page).getByRole("heading", { name: "三民高中", exact: true }),
  ).toBeVisible();
  await expect(
    panel(page).getByText("圖片暫時無法顯示", { exact: true }),
  ).toBeVisible();
  await expect(
    panel(page).getByRole("heading", { name: "展出資訊" }),
  ).toBeVisible();
});
test("不合法 JSON 內容顯示具體欄位診斷", async ({ page }) => {
  const { readFileSync } = await import("node:fs");
  const exhibitors = JSON.parse(
    readFileSync("src/data/exhibitors.json", "utf8"),
  );
  exhibitors[0].zoneId = "invalid";
  await page.route("**/src/data/exhibitors.json*", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "export default " + JSON.stringify(exhibitors),
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "展示資料需要修正" }),
  ).toBeVisible();
  await expect(page.locator(".data-error")).toContainText(
    "exhibitors.0.zoneId",
  );
});
test("自動導覽可跨區播放並暫停", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  await page.getByRole("button", { name: "自動導覽", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "暫停導覽", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    panel(page).getByRole("heading", { name: "科技創客坊", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "暫停導覽", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "自動導覽", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
});
