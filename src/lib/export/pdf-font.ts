import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

let cachedFontBytes: Uint8Array | null = null;

function fontCandidates() {
  const root = process.cwd();
  return [
    join(root, "assets/fonts/NotoSansSC-Regular.otf"),
    join(root, "assets/fonts/NotoSansSC-Regular.ttf"),
    join(root, "assets/fonts/SimHei.ttf"),
    "C:\\Windows\\Fonts\\simhei.ttf",
    "C:\\Windows\\Fonts\\msyh.ttc",
    "C:\\Windows\\Fonts\\msyhbd.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    "/System/Library/Fonts/PingFang.ttc",
    "/System/Library/Fonts/STHeiti Light.ttc",
  ];
}

export async function loadPdfFontBytes() {
  if (cachedFontBytes) {
    return cachedFontBytes;
  }

  for (const candidate of fontCandidates()) {
    if (!existsSync(candidate)) {
      continue;
    }

    cachedFontBytes = new Uint8Array(await readFile(candidate));
    return cachedFontBytes;
  }

  throw new Error("未找到可用的中文字体。请将 NotoSansSC-Regular.otf 或 SimHei.ttf 放入 assets/fonts/。");
}
