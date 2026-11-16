// 分享圖用的字型樣式：只內嵌「頁面已經載入、而且這張卡片的文字用得到」的字型分片。
//
// html-to-image 預設會把頁面上每一條 @font-face 都下載後內嵌。本站有本站小子集、九十片共用
// unicode-range 分片，加上 Google Fonts 四個字族的分片，共七百五十多條——實測一張分享圖要重抓
// 754 個字型檔、21.7 MB、不限速也要 13.8 秒（2026-11-16），用行動網路等於按了沒反應還燒流量。
// 瀏覽器只會載入畫面上用到的分片，所以「已載入」就是「用得到」的上限；再用卡片文字的字元收窄一次。
// 與 path.bdfz.net 的 src/lib/shareFonts.ts 同一份邏輯（不在 shared-ui 共用清單裡，各站各一份）。

export interface CodepointRange {
  start: number;
  end: number;
}

/** 解析 CSS unicode-range（`U+4E00-4E05, U+26, U+4??`）。看不懂的片段略過。 */
export function parseUnicodeRange(value: string): CodepointRange[] {
  const ranges: CodepointRange[] = [];
  for (const part of value.split(',')) {
    const token = part.trim().replace(/^u\+/i, '');
    if (!/^[0-9a-f?]+(-[0-9a-f]+)?$/i.test(token)) continue;
    if (token.includes('?')) {
      ranges.push({
        start: Number.parseInt(token.replace(/\?/g, '0'), 16),
        end: Number.parseInt(token.replace(/\?/g, 'f'), 16),
      });
      continue;
    }
    const [from, to] = token.split('-');
    const start = Number.parseInt(from, 16);
    ranges.push({ start, end: to === undefined ? start : Number.parseInt(to, 16) });
  }
  return ranges;
}

export function rangesCoverAny(ranges: CodepointRange[], codepoints: Iterable<number>): boolean {
  // 沒寫 unicode-range 的字型涵蓋全部字元。
  if (ranges.length === 0) return true;
  for (const codepoint of codepoints) {
    if (ranges.some(range => codepoint >= range.start && codepoint <= range.end)) return true;
  }
  return false;
}

const WEIGHT_KEYWORDS: Record<string, string> = { normal: '400', bold: '700' };

/** 同一條 @font-face 在樣式表與 document.fonts 裡的寫法略有出入，比對前先正規化。 */
export function fontFaceKey(family: string, weight: string, style: string, unicodeRange: string): string {
  const cleanFamily = family.trim().replace(/^["']|["']$/g, '').toLowerCase();
  const cleanWeight = (weight || 'normal').trim().toLowerCase();
  const cleanStyle = (style || 'normal').trim().toLowerCase();
  const cleanRange = (unicodeRange || 'U+0-10FFFF').replace(/\s+/g, '').toLowerCase();
  return [cleanFamily, WEIGHT_KEYWORDS[cleanWeight] ?? cleanWeight, cleanStyle, cleanRange].join('|');
}

/** 取 src 裡第一個檔案網址，按樣式表所在位置解析成絕對網址。 */
export function firstFontUrl(src: string, baseUrl: string): string | null {
  const match = src.match(/url\(\s*(?:"([^"]+)"|'([^']+)'|([^)\s]+))\s*\)/);
  const raw = match?.[1] ?? match?.[2] ?? match?.[3];
  if (!raw || raw.startsWith('data:')) return null;
  try {
    return new URL(raw, baseUrl).href;
  } catch {
    return null;
  }
}

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// 一張卡片正常用到二、三十片；上限只是保險，避免異常情況下又變回整批下載。
const MAX_EMBEDDED_FACES = 64;

/**
 * 產生給 html-to-image `fontEmbedCSS` 用的樣式。任何一步失敗都只是少內嵌幾片字型
 * （圖上那幾個字改用系統字），不會讓下載失敗；全部失敗時回傳空字串。
 */
export async function buildShareFontCss(node: HTMLElement): Promise<string> {
  const codepoints = new Set<number>();
  for (const char of node.innerText || node.textContent || '') {
    const codepoint = char.codePointAt(0);
    if (codepoint !== undefined && codepoint > 0x20) codepoints.add(codepoint);
  }

  const loaded = new Set<string>();
  document.fonts.forEach(face => {
    if (face.status === 'loaded') {
      loaded.add(fontFaceKey(face.family, face.weight, face.style, face.unicodeRange));
    }
  });
  if (loaded.size === 0 || codepoints.size === 0) return '';

  const wanted: { rule: CSSFontFaceRule; url: string }[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // 跨來源且沒有 CORS 的樣式表讀不到規則。
    }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      const style = rule.style;
      const unicodeRange = style.getPropertyValue('unicode-range');
      const key = fontFaceKey(
        style.getPropertyValue('font-family'),
        style.getPropertyValue('font-weight'),
        style.getPropertyValue('font-style'),
        unicodeRange,
      );
      if (!loaded.has(key)) continue;
      if (!rangesCoverAny(parseUnicodeRange(unicodeRange), codepoints)) continue;
      const url = firstFontUrl(style.getPropertyValue('src'), sheet.href || window.location.href);
      if (url) wanted.push({ rule, url });
      if (wanted.length >= MAX_EMBEDDED_FACES) break;
    }
    if (wanted.length >= MAX_EMBEDDED_FACES) break;
  }

  const blocks = await Promise.all(
    wanted.map(async ({ rule, url }) => {
      try {
        const response = await fetch(url);
        if (!response.ok) return '';
        const dataUrl = await toDataUrl(await response.blob());
        const style = rule.style;
        const descriptors = [
          `font-family:${style.getPropertyValue('font-family')}`,
          `font-style:${style.getPropertyValue('font-style') || 'normal'}`,
          `font-weight:${style.getPropertyValue('font-weight') || 'normal'}`,
          `src:url(${dataUrl}) format("woff2")`,
        ];
        const unicodeRange = style.getPropertyValue('unicode-range');
        if (unicodeRange) descriptors.push(`unicode-range:${unicodeRange}`);
        return `@font-face{${descriptors.join(';')}}`;
      } catch {
        return '';
      }
    }),
  );
  return blocks.filter(Boolean).join('\n');
}
