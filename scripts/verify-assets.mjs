import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
const manifest = JSON.parse(
  readFileSync(
    new URL("../public/models/manifest.json", import.meta.url),
    "utf8",
  ),
);
for (const asset of manifest) {
  const bytes = readFileSync(
    new URL("../public/" + asset.path, import.meta.url),
  );
  if (
    bytes.length !== asset.bytes ||
    createHash("sha256").update(bytes).digest("hex") !== asset.sha256
  )
    throw new Error("模型完整性檢查失敗：" + asset.path);
  if (bytes.subarray(0, 4).toString() !== "glTF")
    throw new Error("模型不是有效 GLB：" + asset.path);
}
console.log(
  `${manifest.length} 個 GLB 的檔頭、大小與 SHA-256 全部符合已記錄的來源。`,
);
