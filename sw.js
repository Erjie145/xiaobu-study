/* 小步陪伴 · Service Worker
 * v13：所有静态资源带版本号，强制绕过 iPad 上残留的旧 HTTP / SW 缓存。
 * 以后升级：把 CACHE 与 V 一起 +1，并同步 index.html / manifest 里的 ?v= 参数。
 */
const CACHE = 'xiaobu-v51';
const V = '?v=51';
/* 音频单独一个缓存：改代码升版本时不会把几万个发音文件一起清掉重下。
   音频内容有改动时，把 AUDIO 的名字和 app.js 里的语音包 ?v= 一起 +1。 */
const AUDIO = 'xiaobu-audio-v42';
const ASSETS = [
  './',
  'index.html',
  'styles.css' + V,
  'app.js' + V,
  'data.js' + V,
  'manifest.webmanifest' + V,
  'icons/favicon.png' + V,
  'icons/icon-192.png' + V,
  'icons/icon-512.png' + V,
  'icons/apple-touch-icon.png' + V,
  'icons/pipi.png' + V,
  'icons/pipi-lg.png' + V,
  'icons/pipi-sm.png' + V,
  'audio/manifest.json' + V,
  'audio/pet/manifest.json' + V,
  'audio/lesson/index.json'          /* 天禄讲题语音包的索引，离线也能查 */
];

self.addEventListener('install', e => {
  e.waitUntil(
    Promise.all([caches.open(CACHE), caches.open(AUDIO)]).then(async ([c, ac]) => {
      // 逐项缓存：单个资源失败不影响整个 SW 安装
      await Promise.all(ASSETS.map(u => c.add(u).catch(() => {})));
      // 按清单预缓存全部课本单词的高清发音，断网也能听写（放进音频缓存，升级不重下）
      try {
        const r = await fetch('audio/manifest.json' + V, { cache: 'no-store' });
        if (r.ok) {
          const list = await r.json();
          await Promise.all(list.map(u => ac.add(u).catch(() => {})));
        }
      } catch (err) { /* 清单读取失败不影响应用安装 */ }
      // 天禄的可爱语音包（三种声线 × 12 句），离线点它也能说话
      try {
        const pr = await fetch('audio/pet/manifest.json' + V, { cache: 'no-store' });
        if (pr.ok) {
          const pm = await pr.json();
          await Promise.all((pm.files || []).map(f => ac.add('audio/pet/' + f).catch(() => {})));
        }
      } catch (err) { /* 语音包没缓存成功也还能在线播放 */ }
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== AUDIO).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  /* 只处理本站资源。跨域请求（GitHub API 等）交给浏览器直连，
     否则会把 API 响应一起写进缓存，同步时永远读到旧 sha。 */
  let reqUrl;
  try { reqUrl = new URL(req.url); } catch (err) { return; }
  if (reqUrl.origin !== self.location.origin) return;

  // 页面导航：强制走网络，绝不返回旧快照；403/404/断网才回退离线首页
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req, { cache: 'reload' })
        .then(res => {
          if (res.status === 401 || res.status === 403 || res.status === 404) {
            return caches.match('./index.html').then(r => r || caches.match('./'));
          }
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  const path = new URL(req.url).pathname;
  const isCode = /\.(js|css|html|webmanifest)$/.test(path) || path.endsWith('/');

  // 代码文件：强制走网络，一打开就是最新版；断网或凭据过期时回退缓存
  if (isCode) {
    e.respondWith(
      fetch(req, { cache: 'reload' }).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        }
        // 403/404（例如分享链接凭据过期）：退回缓存里的上一版，保证页面还能打开
        return caches.match(req)
          .then(r => r || caches.match(req, { ignoreSearch: true }))
          .then(r => r || res);
      }).catch(() => caches.match(req)
        .then(r => r || caches.match(req, { ignoreSearch: true }))
        .then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // 音频 / 图标 / 清单：缓存优先，离线可播。
  // 带 ?v= 的请求不做忽略参数的兜底匹配，否则升级后还会拿到旧文件（例如语音包重录）。
  const isAudio = /\/audio\//.test(reqUrl.pathname);
  const store = isAudio ? AUDIO : CACHE;
  e.respondWith(
    caches.open(store).then(c => c.match(req).then(hit => hit ||
      (reqUrl.search ? Promise.resolve(null) : c.match(req, { ignoreSearch: true })).then(h2 => h2 ||
        fetch(req).then(res => {
          if (res && res.ok) c.put(req, res.clone());
          return res;
        })
      )
    ))
  );
});
