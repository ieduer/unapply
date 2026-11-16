import { toPng } from 'html-to-image';
import { buildShareFontCss } from './shareFonts';

export async function generateShareImage(
  node: HTMLElement,
  filename = 'unapply-share.png',
): Promise<Blob | null> {
  try {
    // 只內嵌卡片用得到、頁面已載入的字型分片；不交給 html-to-image 把七百多條 @font-face 全抓一遍（見 shareFonts.ts）。
    const fontEmbedCSS = await buildShareFontCss(node).catch(() => '');
    const dataUrl = await toPng(node, {
      pixelRatio: 2,
      // 卡片圓角以外的四個角用目前色系的畫布色（跟頁面上看到的一樣）；寫死深色會在紙色下留下四塊黑角。
      backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--color-ink-950').trim() || '#fbfaf5',
      fontEmbedCSS,
    });
    const resp = await fetch(dataUrl);
    const blob = await resp.blob();
    triggerDownload(blob, filename);
    return blob;
  } catch (e) {
    console.error('share image failed', e);
    return null;
  }
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
