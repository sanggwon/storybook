import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { StoryRecord } from '@storybook/shared';

export type BookFormat = 'book' | 'webtoon';

function esc(s: string) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

// 책자형(인쇄/가정용): 풀페이지 그림 + 하단 안전영역에 검정 글씨·흰 테두리 오버레이
function bookHtml(story: StoryRecord): string {
  const cover = story.scenes.find((s) => s.imageUrl)?.imageUrl ?? story.storyboardUrl ?? undefined;
  const pages = story.scenes
    .map(
      (s) => `
    <section class="page">
      ${s.imageUrl ? `<img class="bg" src="${s.imageUrl}"/>` : '<div class="bg blank"></div>'}
      ${s.text ? `<div class="scrim"></div><div class="cap"><p>${esc(s.text)}</p></div>` : ''}
    </section>`
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"/>
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; }
    body { margin:0; font-family:'Noto Sans KR', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .cover, .page { position:relative; width:210mm; height:297mm; overflow:hidden; page-break-after: always; background:#EFE4D2; }
    .bg { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
    .blank { background:#EFE4D2; }
    /* 하단 글 영역 가독성용 흰 그라데이션 (인물은 상단/중앙, 하단은 차분하게 그리도록 구도 지시함) */
    .scrim { position:absolute; left:0; right:0; bottom:0; height:42%; background:linear-gradient(to top, rgba(255,255,255,0.92), rgba(255,255,255,0)); }
    /* 안전영역: 가장자리에서 15mm 안쪽. 글은 검정 + 흰 테두리 */
    .cap { position:absolute; left:15mm; right:15mm; bottom:16mm; text-align:center; }
    .cap p { margin:0; color:#111; font-size:19px; line-height:1.75; font-weight:600;
      text-shadow:-1.3px -1.3px 0 #fff, 1.3px -1.3px 0 #fff, -1.3px 1.3px 0 #fff, 1.3px 1.3px 0 #fff, 0 2px 4px rgba(0,0,0,0.22); }
    .cover .veil { position:absolute; inset:0; background:rgba(20,15,10,0.18); }
    .cover h1 { position:absolute; left:15mm; right:15mm; top:26mm; text-align:center; margin:0;
      font-family:Georgia, serif; font-size:34px; color:#fff; text-shadow:0 2px 10px rgba(0,0,0,0.55); }
  </style></head>
  <body>
    <section class="cover">
      ${cover ? `<img class="bg" src="${cover}"/>` : '<div class="bg blank"></div>'}
      <div class="veil"></div>
      <h1>${esc(story.title)}</h1>
    </section>
    ${pages}
  </body></html>`;
}

// 웹툰형: 끊김 없이 세로로 이어지는 한 줄(그림→글→그림…)
function webtoonHtml(story: StoryRecord): string {
  const blocks = story.scenes
    .map(
      (s) => `
    <div class="cut">
      ${s.imageUrl ? `<img src="${s.imageUrl}"/>` : ''}
      ${s.text ? `<p>${esc(s.text)}</p>` : ''}
    </div>`
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"/>
  <style>
    @page { margin: 0; }
    * { box-sizing: border-box; }
    body { margin:0; background:#FAF7F0; font-family:'Noto Sans KR',sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .wrap { max-width: 800px; margin:0 auto; }
    .title { font-family:Georgia, serif; text-align:center; color:#23211C; font-size:26px; padding:24px 16px 8px; }
    .cut { page-break-inside: avoid; }
    .cut img { width:100%; display:block; }
    .cut p { margin:0; padding:16px 20px 28px; font-size:17px; line-height:1.85; color:#111; }
  </style></head>
  <body><div class="wrap">
    <div class="title">${esc(story.title)}</div>
    ${blocks}
  </div></body></html>`;
}

export async function exportBookPdf(story: StoryRecord, format: BookFormat = 'book'): Promise<void> {
  const html = format === 'webtoon' ? webtoonHtml(story) : bookHtml(story);
  if (Platform.OS === 'web') {
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 400);
    }
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: story.title });
  }
}
