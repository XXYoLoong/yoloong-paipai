// 项目报告/计划书 PDF 生成器。
// 复用项目已有依赖（pdf-lib + @pdf-lib/fontkit）与内置中文字体 assets/fonts/SimHei.ttf，
// 把 report-content.mjs 中的结构化「内容块」渲染为带封面、页码、截图与 ER 图的 A4 PDF。
// 不引入 puppeteer / pandoc 等重型外部工具，保证零额外环境即可生成。

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { reportBlocks, reportMeta } from "./report-content.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// —— 版面常量（A4，单位 pt）——
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 56;
const MARGIN_TOP = 64;
const MARGIN_BOTTOM = 58;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

const COLOR_INK = rgb(0.09, 0.11, 0.16);
const COLOR_MUTED = rgb(0.42, 0.46, 0.53);
const COLOR_ACCENT = rgb(0.05, 0.58, 0.53);
const COLOR_RULE = rgb(0.86, 0.88, 0.91);
const COLOR_NOTE_BG = rgb(0.95, 0.97, 0.97);

const SIZE = { h1: 19, h2: 14, h3: 11.5, body: 10.5, small: 8.8, cover: 30 };
const LH = 1.62; // 行高倍数

/** 判定是否为 CJK / 全角字符（这些字符可逐字换行）。 */
function isCjk(ch) {
  return /[\u3000-\u9fff\u3400-\u4dbf\uff00-\uffef\u2014\u2018\u2019\u201c\u201d\u2026\u00b7]/.test(ch);
}

/** 把一行文本切成「token」：CJK 单字、空格、或连续的拉丁/数字串。 */
function tokenize(text) {
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === " ") {
      tokens.push(" ");
      i += 1;
      continue;
    }
    if (isCjk(ch)) {
      tokens.push(ch);
      i += 1;
      continue;
    }
    let run = "";
    while (i < text.length && text[i] !== " " && !isCjk(text[i])) {
      run += text[i];
      i += 1;
    }
    tokens.push(run);
  }
  return tokens;
}

/** CJK 感知的贪心折行。超长的拉丁串（如 URL）按字符硬切。 */
function wrapText(text, font, size, maxWidth) {
  const cleaned = String(text).replace(/\t/g, "  ");
  const width = (s) => font.widthOfTextAtSize(s, size);
  const tokens = tokenize(cleaned);
  const lines = [];
  let line = "";

  const pushToken = (token) => {
    if (width(token) <= maxWidth) {
      const tentative = line + token;
      if (width(tentative) <= maxWidth || line === "") {
        line = tentative;
      } else {
        lines.push(line.replace(/\s+$/, ""));
        line = token === " " ? "" : token;
      }
      return;
    }
    // 单个 token 超宽：逐字符硬切
    for (const ch of token) {
      const tentative = line + ch;
      if (width(tentative) <= maxWidth || line === "") {
        line = tentative;
      } else {
        lines.push(line);
        line = ch;
      }
    }
  };

  for (const token of tokens) {
    pushToken(token);
  }
  if (line !== "") {
    lines.push(line);
  }
  return lines.length ? lines : [""];
}

async function main() {
  const fontPath = join(ROOT, "assets/fonts/SimHei.ttf");
  if (!existsSync(fontPath)) {
    throw new Error("缺少中文字体 assets/fonts/SimHei.ttf");
  }
  const fontBytes = new Uint8Array(await readFile(fontPath));

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fontBytes, { subset: true });

  pdf.setTitle(reportMeta.title);
  pdf.setAuthor(reportMeta.author);
  pdf.setSubject(reportMeta.subject);

  // 图片缓存，避免重复 embed
  const imageCache = new Map();
  async function embedImage(relPath) {
    if (imageCache.has(relPath)) {
      return imageCache.get(relPath);
    }
    const abs = join(ROOT, relPath);
    if (!existsSync(abs)) {
      return null;
    }
    const bytes = new Uint8Array(await readFile(abs));
    const img = relPath.toLowerCase().endsWith(".jpg") || relPath.toLowerCase().endsWith(".jpeg")
      ? await pdf.embedJpg(bytes)
      : await pdf.embedPng(bytes);
    imageCache.set(relPath, img);
    return img;
  }

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN_TOP;
  let pageStarted = false; // 当前页是否已绘制正文（用于页码）

  const pages = [page];
  function newPage() {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    pages.push(page);
    y = PAGE_H - MARGIN_TOP;
    pageStarted = true;
  }

  function ensureSpace(height) {
    if (y - height < MARGIN_BOTTOM) {
      newPage();
    }
  }

  function drawParagraph(text, { size = SIZE.body, color = COLOR_INK, indent = 0, gap = 6, lineHeight = LH } = {}) {
    const maxWidth = CONTENT_W - indent;
    const lines = wrapText(text, font, size, maxWidth);
    const step = size * lineHeight;
    for (const line of lines) {
      ensureSpace(step);
      page.drawText(line, { x: MARGIN_X + indent, y: y - size, size, font, color });
      y -= step;
    }
    y -= gap;
  }

  function drawHeading(text, level) {
    if (level === 1) {
      // 一级标题另起一页（封面/目录之后的章节），保持版面整洁
      if (pageStarted) {
        newPage();
      }
      pageStarted = true;
      y -= 6;
      ensureSpace(SIZE.h1 * 2);
      page.drawText(text, { x: MARGIN_X, y: y - SIZE.h1, size: SIZE.h1, font, color: COLOR_INK });
      y -= SIZE.h1 * 1.5;
      page.drawRectangle({ x: MARGIN_X, y: y + 6, width: 46, height: 2.4, color: COLOR_ACCENT });
      y -= 14;
      return;
    }
    if (level === 2) {
      y -= 8;
      const step = SIZE.h2 * 1.5;
      ensureSpace(step + 6);
      page.drawRectangle({ x: MARGIN_X, y: y - SIZE.h2 + 1, width: 3.2, height: SIZE.h2, color: COLOR_ACCENT });
      page.drawText(text, { x: MARGIN_X + 10, y: y - SIZE.h2, size: SIZE.h2, font, color: COLOR_INK });
      y -= step;
      return;
    }
    y -= 4;
    const step = SIZE.h3 * 1.5;
    ensureSpace(step);
    page.drawText(text, { x: MARGIN_X, y: y - SIZE.h3, size: SIZE.h3, font, color: COLOR_ACCENT });
    y -= step;
  }

  function drawBullet(text, prefix = "•") {
    const size = SIZE.body;
    const indent = 16;
    const maxWidth = CONTENT_W - indent;
    const lines = wrapText(text, font, size, maxWidth);
    const step = size * LH;
    lines.forEach((line, idx) => {
      ensureSpace(step);
      if (idx === 0) {
        page.drawText(prefix, { x: MARGIN_X, y: y - size, size, font, color: COLOR_ACCENT });
      }
      page.drawText(line, { x: MARGIN_X + indent, y: y - size, size, font, color: COLOR_INK });
      y -= step;
    });
    y -= 3;
  }

  function drawNote(text) {
    const size = SIZE.body;
    const padX = 12;
    const padY = 8;
    const maxWidth = CONTENT_W - padX * 2;
    const lines = wrapText(text, font, size, maxWidth);
    const step = size * LH;
    const boxH = lines.length * step + padY * 2;
    ensureSpace(boxH + 8);
    page.drawRectangle({ x: MARGIN_X, y: y - boxH, width: CONTENT_W, height: boxH, color: COLOR_NOTE_BG });
    page.drawRectangle({ x: MARGIN_X, y: y - boxH, width: 3, height: boxH, color: COLOR_ACCENT });
    let ty = y - padY;
    for (const line of lines) {
      page.drawText(line, { x: MARGIN_X + padX, y: ty - size, size, font, color: COLOR_INK });
      ty -= step;
    }
    y -= boxH + 10;
  }

  async function drawImage(relPath, caption) {
    const img = await embedImage(relPath);
    if (!img) {
      drawParagraph(`（缺少图片：${relPath}）`, { color: COLOR_MUTED, size: SIZE.small });
      return;
    }
    const maxW = CONTENT_W;
    const maxH = PAGE_H - MARGIN_TOP - MARGIN_BOTTOM - 60;
    let { width, height } = img.scale(1);
    const ratio = Math.min(maxW / width, maxH / height, 1);
    width *= ratio;
    height *= ratio;

    // 图片尽量整体不跨页
    if (y - height - 26 < MARGIN_BOTTOM) {
      newPage();
    }
    const x = MARGIN_X + (CONTENT_W - width) / 2;
    page.drawImage(img, { x, y: y - height, width, height });
    // 细边框
    page.drawRectangle({ x, y: y - height, width, height, borderColor: COLOR_RULE, borderWidth: 0.8 });
    y -= height + 6;
    if (caption) {
      const lines = wrapText(caption, font, SIZE.small, CONTENT_W);
      for (const line of lines) {
        ensureSpace(SIZE.small * LH);
        const w = font.widthOfTextAtSize(line, SIZE.small);
        page.drawText(line, { x: MARGIN_X + (CONTENT_W - w) / 2, y: y - SIZE.small, size: SIZE.small, font, color: COLOR_MUTED });
        y -= SIZE.small * LH;
      }
    }
    y -= 12;
  }

  function drawCover() {
    pageStarted = false;
    // 顶部强调条
    page.drawRectangle({ x: MARGIN_X, y: PAGE_H - 150, width: 60, height: 4, color: COLOR_ACCENT });
    let cy = PAGE_H - 220;
    const titleLines = wrapText(reportMeta.title, font, SIZE.cover, CONTENT_W);
    for (const line of titleLines) {
      page.drawText(line, { x: MARGIN_X, y: cy, size: SIZE.cover, font, color: COLOR_INK });
      cy -= SIZE.cover * 1.35;
    }
    cy -= 6;
    const subLines = wrapText(reportMeta.subtitle, font, SIZE.h2, CONTENT_W);
    for (const line of subLines) {
      page.drawText(line, { x: MARGIN_X, y: cy, size: SIZE.h2, font, color: COLOR_MUTED });
      cy -= SIZE.h2 * 1.5;
    }
    cy -= 30;
    for (const meta of reportMeta.coverMeta) {
      page.drawText(meta, { x: MARGIN_X, y: cy, size: SIZE.body, font, color: COLOR_INK });
      cy -= SIZE.body * 1.8;
    }
    newPage();
  }

  // —— 主渲染流程 ——
  drawCover();

  for (const block of reportBlocks) {
    switch (block.type) {
      case "h1":
        drawHeading(block.text, 1);
        break;
      case "h2":
        drawHeading(block.text, 2);
        break;
      case "h3":
        drawHeading(block.text, 3);
        break;
      case "p":
        pageStarted = true;
        drawParagraph(block.text);
        break;
      case "bullet":
        pageStarted = true;
        drawBullet(block.text, block.prefix ?? "•");
        break;
      case "note":
        pageStarted = true;
        drawNote(block.text);
        break;
      case "image":
        pageStarted = true;
        await drawImage(block.src, block.caption);
        break;
      case "pagebreak":
        newPage();
        break;
      case "space":
        y -= block.size ?? 12;
        break;
      default:
        break;
    }
  }

  // —— 页脚页码（封面页 index 0 不编号）——
  const total = pages.length;
  pages.forEach((p, idx) => {
    if (idx === 0) return;
    const label = `游龙排排 · 项目计划书与 AI 使用声明   ·   ${idx} / ${total - 1}`;
    const w = font.widthOfTextAtSize(label, 8);
    p.drawText(label, { x: (PAGE_W - w) / 2, y: 30, size: 8, font, color: COLOR_MUTED });
  });

  const outDir = join(ROOT, "docs");
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, "游龙排排-项目计划书.pdf");
  const bytes = await pdf.save();
  await writeFile(outPath, bytes);
  console.log(`已生成报告：${outPath}（${(bytes.length / 1024).toFixed(0)} KB，共 ${total} 页）`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
