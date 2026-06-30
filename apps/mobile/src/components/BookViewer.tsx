import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Image, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import type { StoryRecord } from '@storybook/shared';
import { api, imageSource, imageDataUrl } from '../api/client';
import { colors, radius, typography, spacing, shadows } from '../design/tokens';

type Scene = StoryRecord['scenes'][number];
type Mode = 'book' | 'webtoon';

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// StPageFlip 책자 HTML 생성 (이미지는 미리 받은 data URL)
function buildHtml(opts: { title: string; cover?: string; scenes: Scene[]; imgs: Record<string, string | undefined>; startPage: number }) {
  const { title, cover, scenes, imgs, startPage } = opts;
  const coverBg = cover ? `background-image:url('${cover}')` : '';
  const coverPage = `
    <div class="page page-cover" data-density="hard">
      <div class="bg" style="${coverBg}"></div>
      <div class="veil"></div>
      <div class="cover-title">${esc(title || '')}</div>
    </div>`;
  const scenePages = scenes
    .map((s) => {
      const bg = imgs[s.id] ? `background-image:url('${imgs[s.id]}')` : '';
      const cap = s.text ? `<div class="cap">${esc(s.text)}</div>` : '';
      return `
      <div class="page">
        <div id="bg-${s.no}" class="bg" style="${bg}"></div>
        ${cap}
        <button class="regen" id="rg-${s.no}" ontouchstart="rg(event,'${s.id}',${s.no})" onclick="rg(event,'${s.id}',${s.no})">🔄</button>
      </div>`;
    })
    .join('');
  const backPage = `<div class="page page-cover" data-density="hard"><div class="bg end"></div><div class="end-txt">끝</div></div>`;

  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html,body{margin:0;padding:0;height:100%;background:#1c140e;overflow:hidden;-webkit-user-select:none;user-select:none}
  #book{margin:0 auto}
  .page{background:#1c140e;overflow:hidden}
  .page-cover{background:#2a1d12}
  .bg{position:absolute;inset:0;background-size:cover;background-position:center;background-repeat:no-repeat}
  .bg.end{background:#2a1d12}
  .veil{position:absolute;inset:0;background:rgba(20,15,10,.30)}
  .cover-title{position:absolute;left:22px;right:22px;top:22%;text-align:center;color:#fff;font-family:Georgia,serif;font-size:30px;font-weight:700;line-height:1.25;text-shadow:0 2px 10px rgba(0,0,0,.6)}
  .end-txt{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-family:Georgia,serif;font-size:40px;opacity:.85}
  .cap{position:absolute;left:14px;right:14px;bottom:18px;background:rgba(255,255,255,.9);border-radius:14px;padding:12px 14px;font-size:17px;line-height:1.5;color:#1a1a1a;text-align:center;font-weight:600;box-shadow:0 6px 20px rgba(0,0,0,.25)}
  .regen{position:absolute;top:10px;right:10px;border:none;border-radius:999px;background:rgba(255,255,255,.92);padding:7px 11px;font-size:13px;font-weight:700;color:#1a1a1a}
  .nav{position:fixed;left:0;right:0;bottom:14px;display:flex;justify-content:center;gap:26px;z-index:50;pointer-events:none}
  .nav button{pointer-events:auto;width:46px;height:46px;border-radius:23px;border:none;background:rgba(255,255,255,.18);color:#fff;font-size:24px;line-height:1}
</style></head><body>
<div id="book">
  ${coverPage}
  ${scenePages}
  ${backPage}
</div>
<div class="nav"><button onclick="window.__pf&&window.__pf.flipPrev()">‹</button><button onclick="window.__pf&&window.__pf.flipNext()">›</button></div>
<script src="https://unpkg.com/page-flip@2.0.7/dist/js/page-flip.browser.js"></script>
<script>
  function post(o){ if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(o)); }
  function rg(e,id,no){ e.preventDefault(); e.stopPropagation(); var b=document.getElementById('rg-'+no); if(b) b.textContent='…'; post({type:'regen',sceneId:id,no:no}); }
  function init(){
    if(!window.St){ setTimeout(init,150); return; }
    var el=document.getElementById('book');
    var w=Math.min(window.innerWidth, 760);
    var h=window.innerHeight;
    var pf=new St.PageFlip(el,{
      width:w, height:h, size:'stretch',
      minWidth:200, maxWidth:1400, minHeight:300, maxHeight:2400,
      maxShadowOpacity:0.5, showCover:true, usePortrait:true,
      mobileScrollSupport:false, flippingTime:700, startPage:${Math.max(0, startPage)}
    });
    pf.loadFromHTML(document.querySelectorAll('.page'));
    window.__pf=pf;
    pf.on('flip', function(e){ post({type:'flip', page:e.data}); });
    post({type:'ready'});
  }
  window.addEventListener('load', init);
</script>
</body></html>`;
}

export function BookViewer({ story: initial }: { story: StoryRecord }) {
  const [story, setStory] = useState<StoryRecord>(initial);
  const [mode, setMode] = useState<Mode>('book');
  const [busyNo, setBusyNo] = useState<number | null>(null);
  const [imgs, setImgs] = useState<Record<string, string | undefined>>({});
  const [coverImg, setCoverImg] = useState<string | undefined>();
  const [loaded, setLoaded] = useState(false);
  const [loadN, setLoadN] = useState(0);
  const [htmlKey, setHtmlKey] = useState(0);
  const webRef = useRef<WebView>(null);
  const pageRef = useRef(0);

  const scenes = story.scenes;
  const total = scenes.length;
  const coverUrl = scenes.find((s) => s.imageUrl)?.imageUrl ?? story.storyboardUrl ?? undefined;

  // 진입 시 모든 이미지를 미리 data URL로 받아둔다
  useEffect(() => {
    let on = true;
    (async () => {
      setLoaded(false);
      setLoadN(0);
      const cov = await imageDataUrl(coverUrl);
      if (on) setCoverImg(cov);
      const acc: Record<string, string | undefined> = {};
      for (const s of scenes) {
        const u = await imageDataUrl(s.imageUrl);
        acc[s.id] = u;
        if (on) {
          setImgs({ ...acc });
          setLoadN((n) => n + 1);
        }
      }
      if (on) {
        setLoaded(true);
        setHtmlKey((k) => k + 1);
      }
    })();
    return () => {
      on = false;
    };
    // story.id 단위로만 다시 로드 (장면 이미지가 바뀌면 개별 갱신)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story.id]);

  const html = useMemo(
    () => buildHtml({ title: story.title, cover: coverImg, scenes, imgs, startPage: pageRef.current }),
    // htmlKey가 바뀔 때만 재생성 (리로드) — 넘김 중에는 그대로 유지
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [htmlKey]
  );

  async function regen(sceneId: string, no: number) {
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene || busyNo !== null) return;
    setBusyNo(no);
    try {
      const { jobId } = await api.regenScene(story.id, scene.id);
      let done = false;
      let fails = 0;
      while (!done) {
        await new Promise((r) => setTimeout(r, 1500));
        let job;
        try {
          job = await api.getJob(jobId);
          fails = 0;
        } catch (err) {
          if (++fails > 12) throw err;
          continue;
        }
        if (job.status === 'done') {
          done = true;
          const fresh = await api.getStory(story.id);
          const ns = fresh.scenes.find((s) => s.id === sceneId);
          const dataUrl = await imageDataUrl(ns?.imageUrl);
          setStory(fresh);
          setImgs((m) => ({ ...m, [sceneId]: dataUrl }));
          setHtmlKey((k) => k + 1); // 새 이미지로 책자 갱신(현재 페이지 유지)
        } else if (job.status === 'failed') {
          done = true;
          Alert.alert('다시 그리기 실패', job.error ?? '잠시 후 다시 시도해 주세요.');
        }
      }
    } catch (e: any) {
      Alert.alert('오류', e?.message ?? '실패했어요.');
    } finally {
      setBusyNo(null);
    }
  }

  function onMessage(e: { nativeEvent: { data: string } }) {
    try {
      const m = JSON.parse(e.nativeEvent.data);
      if (m.type === 'flip') pageRef.current = m.page;
      else if (m.type === 'regen') regen(m.sceneId, m.no);
    } catch {
      /* ignore */
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <View style={styles.bar}>
        <Text style={styles.barTitle} numberOfLines={1}>{story.title}</Text>
        <View style={styles.seg}>
          <Pressable onPress={() => setMode('book')} style={[styles.segBtn, mode === 'book' && styles.segOn]}>
            <Text style={[styles.segTxt, mode === 'book' && styles.segTxtOn]}>📖 책자</Text>
          </Pressable>
          <Pressable onPress={() => setMode('webtoon')} style={[styles.segBtn, mode === 'webtoon' && styles.segOn]}>
            <Text style={[styles.segTxt, mode === 'webtoon' && styles.segTxtOn]}>📱 웹툰</Text>
          </Pressable>
        </View>
      </View>

      {!loaded ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadTxt}>책을 준비하는 중… ({loadN}/{total})</Text>
        </View>
      ) : mode === 'book' ? (
        <WebView
          key={htmlKey}
          ref={webRef}
          originWhitelist={['*']}
          source={{ html }}
          style={{ flex: 1, backgroundColor: colors.ink }}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
          onMessage={onMessage}
          allowFileAccess
          mixedContentMode="always"
        />
      ) : (
        <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.screen }}>
          {scenes.map((s) => {
            const busy = busyNo === s.no;
            return (
              <View key={s.id} style={styles.webtoonPage}>
                {imgs[s.id] ? (
                  <Image source={{ uri: imgs[s.id] }} style={styles.webtoonImg} resizeMode="cover" />
                ) : s.imageUrl ? (
                  <Image source={imageSource(s.imageUrl)} style={styles.webtoonImg} resizeMode="cover" />
                ) : (
                  <View style={[styles.webtoonImg, styles.blank]} />
                )}
                <View style={styles.webtoonBody}>
                  <Text style={styles.pageNoSm}>{s.no}. {s.title}</Text>
                  {!!s.text && <Text style={styles.webtoonText}>{s.text}</Text>}
                  <Pressable onPress={() => regen(s.id, s.no)} disabled={busyNo !== null} style={[styles.regen, busyNo !== null && busyNo !== s.no && { opacity: 0.4 }]}>
                    <Text style={styles.regenTxt}>{busy ? '그리는 중…' : '🔄 다시'}</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.ink },
  barTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#fff', letterSpacing: typography.headTracking },
  seg: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 999, padding: 3 },
  segBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  segOn: { backgroundColor: '#fff' },
  segTxt: { fontSize: 12.5, fontWeight: '700', color: '#fff' },
  segTxtOn: { color: colors.ink },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: colors.ink },
  loadTxt: { color: '#fff', fontSize: 14, opacity: 0.85 },
  blank: { backgroundColor: '#EFE4D2' },
  regen: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.bg, alignSelf: 'center', marginTop: 6 },
  regenTxt: { color: colors.sub, fontSize: 12, fontWeight: '600' },
  webtoonPage: { marginBottom: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.card, overflow: 'hidden', ...shadows.card },
  webtoonImg: { width: '100%', aspectRatio: 1.25, backgroundColor: '#000' },
  webtoonBody: { padding: 18, gap: 10 },
  pageNoSm: { fontSize: 13, fontWeight: '700', color: colors.accentDeep },
  webtoonText: { fontSize: 16, color: colors.ink, lineHeight: 27 },
});
