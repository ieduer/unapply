import { toPng } from 'html-to-image';

export async function generateShareImage(
  node: HTMLElement,
  filename = 'unapply-share.png',
): Promise<Blob | null> {
  try {
    const dataUrl = await toPng(node, {
      pixelRatio: 2,
      backgroundColor: '#070a10',
      cacheBust: true,
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
