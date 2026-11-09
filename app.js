/* 小步陪伴 · 应用逻辑
 * 纯前端、无依赖、数据全部保存在本机 localStorage
 */
(function () {
  'use strict';

  const D = window.SB_DATA;
  const KEY = 'xiaobu.study.v1';
  const $ = sel => document.querySelector(sel);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pad = n => String(n).padStart(2, '0');
  const dstr = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const today = () => dstr(new Date());
  const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return dstr(d); };
  const weekNames = ['日', '一', '二', '三', '四', '五', '六'];
  const ic = (name, cls) => '<svg class="icon ' + (cls || '') + '"><use href="#i-' + name + '"></use></svg>';

  /* ---------------- 数据层 ---------------- */
  const defaultDB = () => ({
    settings: {
      name: '', rate: 0.85, goal: 5, showZh: true,
      canvas: 'ipad11', sound: true, soundVolume: 0.5,
      voiceMode: 'recorded', voiceURI: '', repeat: false,
      oralCount: 5, oralMinutes: 8, ocrKey: '', onlineVoice: true, zhVoiceURI: '', petVoice: true, petVoiceStyle: 'sweet',
      grade: 5, term: 1, book: 'wy2024', mathLevel: 'normal',
      dictKeyboard: true
    },
    tasks: {}, checkins: {}, stars: 0, starUsed: 0, bestStreak: 0,
    /* v50：每日基础任务模板（可指定周几生效），每天首次打开时自动加进当天清单。
       baseGone 是「删掉的模板项」，taskGone 是「当天删掉的任务」，都跟着数据同步，
       否则另一台设备会把删掉的又补回来。 */
    baseTasks: [], baseGone: {}, taskGone: {},
    mistakes: [], customWords: [], counters: { dictation: 0, math: 0, oral: 0 },
    /* v46：错题删除名单（id → 删除时间）。删掉的错题在另一台设备上还有旧副本，
       同步时「取并集」会把它复活，所以删除要留下记录一起同步。
       v47 增加 mkGone：按「科目+题目」记的内容指纹，能清掉另一台 id 不同的同一道题。 */
    mkDeleted: {}, mkGone: {},
    oral: { best: {} },
    /* 宠物喂养：积分、零食柜、喂食次数、每日积分明细
       pointsIn / pointsOut 是累计获得与累计花掉，只增不减。
       同步时用「累计获得 - 累计花掉」算余额，否则两台设备一合并，
       兑换掉的积分和星星会被另一边的旧余额「取大值」顶回来。 */
    pet: {
      points: 0, pointsIn: 0, pointsOut: 0, food: {}, fed: 0, fondness: 0, day: '',
      avatar: '', pic: '',            /* v26：自定义宠物图（压缩后的 dataURL） */
      earned: { checkin: false, oral: 0, dict: 0, master: 0 }, log: []
    },
    /* v41：家庭同步（令牌只存本机，绝不进入备份和上传内容） */
    sync: {
      token: '', owner: '', repo: 'xiaobu-sync', on: false,
      lastAt: 0, sha: '', updatedAt: 0, device: '', err: ''
    }
  });
  let db;
  try {
    const raw = localStorage.getItem(KEY);
    db = raw ? Object.assign(defaultDB(), JSON.parse(raw)) : defaultDB();
    db.settings = Object.assign(defaultDB().settings, db.settings || {});
    // v11 首次升级：老数据没有倒计时设置时，切到默认的「8 分钟 5 道题」
    if (db.settings.oralMinutes == null) {
      db.settings.oralMinutes = 8;
      if (db.settings.oralCount === 10) db.settings.oralCount = 5;
    }
    if (db.settings.zhVoiceURI == null) db.settings.zhVoiceURI = '';
    db.counters = Object.assign({ dictation: 0, math: 0, oral: 0 }, db.counters || {});
    db.oral = Object.assign({ best: {} }, db.oral || {});
    db.oral.best = db.oral.best || {};
    // v22 首次升级：记录「已经换成积分的星星」，累计星星数不受影响
    if (db.starUsed == null) db.starUsed = 0;   // 防御旧备份里写成 null
    // v21 首次升级：老数据补上宠物喂养字段
    db.pet = Object.assign({ points: 0, food: {}, fed: 0, fondness: 0, day: '', earned: {}, log: [] }, db.pet || {});
    db.pet.food = db.pet.food || {};
    db.pet.log = db.pet.log || [];
    db.pet.earned = Object.assign({ checkin: false, oral: 0, dict: 0, master: 0 }, db.pet.earned || {});
    // v45：累计获得 / 累计花掉。老数据只有净余额，就把余额当成「累计获得」，
    // 之后每次加分或花分都同时累加，跨设备合并时就不会把兑换结果顶回去
    if (db.pet.pointsIn == null || db.pet.pointsOut == null) {
      db.pet.pointsOut = Math.max(0, db.pet.pointsOut | 0);
      db.pet.pointsIn = Math.max(0, (db.pet.points | 0) + db.pet.pointsOut);
    }
    // v26 首次升级：自定义宠物图，老数据补空字符串（表示用默认天禄）
    db.pet.avatar = typeof db.pet.avatar === 'string' ? db.pet.avatar : '';
    db.pet.pic = typeof db.pet.pic === 'string' ? db.pet.pic : '';
    // v46：老数据补上错题删除名单，并把名单里残留的错题清掉
    db.mkDeleted = (db.mkDeleted && typeof db.mkDeleted === 'object' && !Array.isArray(db.mkDeleted)) ? db.mkDeleted : {};
    // v47：内容指纹名单（另一台 id 不同的同一道题）
    db.mkGone = (db.mkGone && typeof db.mkGone === 'object' && !Array.isArray(db.mkGone)) ? db.mkGone : {};
    // v50：每日基础任务模板
    db.baseTasks = Array.isArray(db.baseTasks) ? db.baseTasks.filter(t => t && t.content) : [];
    db.baseGone = (db.baseGone && typeof db.baseGone === 'object' && !Array.isArray(db.baseGone)) ? db.baseGone : {};
    db.taskGone = (db.taskGone && typeof db.taskGone === 'object' && !Array.isArray(db.taskGone)) ? db.taskGone : {};
    // v47：历史数据里若有两条一模一样的错题（科目+日期+题目相同、id 不同），收成一条
    const mkBefore = Array.isArray(db.mistakes) ? db.mistakes.length : 0;
    dedupeMistakes();
    if (Array.isArray(db.mistakes) && db.mistakes.length !== mkBefore) persist();
    // v41：老数据补同步字段；device 是这台设备的固定编号，用于日志和冲突判断
    db.sync = Object.assign({ token: '', owner: '', repo: 'xiaobu-sync', on: false, lastAt: 0, sha: '', updatedAt: 0, device: '', err: '' }, db.sync || {});
    if (!db.sync.device) db.sync.device = uid();
  } catch (e) { db = defaultDB(); }
  /* v48：饱食度记录。老数据（和新装）第一次进来时，天禄当作刚吃饱，之后开始计时 */
  if (!Array.isArray(db.pet.feedLog)) {
    db.pet.feedLog = [{ t: Date.now(), e: 100 }];
    persist();
  }
  /* v41：同步运行时状态。放在 save 之前声明，避免 TDZ（首启迁移会调用 save） */
  const SYNC = { lock: false, busy: null, timer: null, state: 'off', msg: '', err: '', tries: 0, info: null };
  function scheduleSync(ms) {
    if (!db || !db.sync || !db.sync.on || !db.sync.token) return;
    clearTimeout(SYNC.timer);
    SYNC.timer = setTimeout(() => { syncNow('edit'); }, ms || 6000);
  }

  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { toast('本机存储写入失败，请检查浏览器设置（可能是自定义图片太大）'); return false; }
    if (!SYNC.lock) { db.sync.updatedAt = Date.now(); scheduleSync(8000); }
    return true;
  };

  /* ================= 家庭同步（v41 起） =================
   * 两端共用一个 GitHub 账号下的私有仓库（默认 xiaobu-sync/data.json）。
   * 令牌只保存在本机 localStorage，不上传、不导出、不进备份。
   */
  const GH_API = 'https://api.github.com';
  const SYNC_FILE = 'data.json';
  const SYNC_VER = 1;

  const b64enc = str => {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    }
    return btoa(bin);
  };
  const b64dec = str => {
    const bin = atob(String(str || '').replace(/\s+/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  };
  /* 稳定的序列化（键排序），用来判断两份数据是否等价 */
  function stable(v) {
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    if (v && typeof v === 'object') {
      return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
    }
    return JSON.stringify(v);
  }
  function stripForUpload(src) {
    const c = JSON.parse(stable(src));   // 顺带去掉 undefined / 原型
    c.sync = { updatedAt: src.sync.updatedAt || 0, device: src.sync.device || '' };
    return c;
  }
  /* 导出 / 复制备份用：永远不带令牌，避免备份文件被转发时泄露账号钥匙 */
  function exportSnapshot(pretty) {
    const c = JSON.parse(JSON.stringify(db));
    if (c.sync) { c.sync.token = ''; c.sync.sha = ''; }
    return pretty ? JSON.stringify(c, null, 2) : JSON.stringify(c);
  }
  function persist(message) {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { if (message) toast('本机存储写入失败，可能是自定义图片太大'); }
  }

  async function gh(path, opt) {
    const o = opt || {};
    const headers = { 'Accept': 'application/vnd.github+json' };
    if (db.sync.token) headers['Authorization'] = 'Bearer ' + db.sync.token;
    if (o.body) headers['Content-Type'] = 'application/json';
    const res = await fetch(GH_API + path, {
      method: o.method || 'GET',
      headers,
      body: o.body ? JSON.stringify(o.body) : undefined,
      cache: 'no-store'   // GitHub API 带 max-age，浏览器缓存会让我们拿到旧 sha，导致 409
    });
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    return { status: res.status, ok: res.ok, data };
  }

  /* 首次连接：拿到账号名；没有仓库就建一个私有仓库 */
  async function ensureRepo() {
    if (!db.sync.owner) {
      const me = await gh('/user');
      if (me.status === 401) throw new Error('令牌无效或已过期，请重新生成');
      if (!me.ok || !me.data || !me.data.login) throw new Error('读不到 GitHub 账号信息（' + me.status + '）');
      db.sync.owner = me.data.login;
      persist();
    }
    const path = '/repos/' + db.sync.owner + '/' + db.sync.repo;
    const r = await gh(path + '?t=' + Date.now());
    if (r.status === 200) return;
    if (r.status !== 404) throw new Error('访问仓库失败（' + r.status + '）');
    const created = await gh('/user/repos', {
      method: 'POST',
      body: {
        name: db.sync.repo, private: true, auto_init: true,
        description: '小步陪伴 · 家庭同步数据（请勿删除）'
      }
    });
    if (!created.ok && created.status !== 422) throw new Error('创建同步仓库失败（' + created.status + '）');
    await new Promise(r2 => setTimeout(r2, 1200));   // 新仓库要等几秒才可写
  }

  async function pullRemote() {
    const base = '/repos/' + db.sync.owner + '/' + db.sync.repo + '/contents/' + SYNC_FILE;
    for (let i = 0; i < 3; i++) {
      // 每次带一个新的时间戳：GitHub 的 CDN 会缓存 GET 响应，
      // 不加的话刚写完立刻读回来的还是旧 sha，PUT 必然 409
      const r = await gh(base + '?ref=main&t=' + Date.now() + '-' + i);
      if (r.status === 404) return null;
      if (r.ok && r.data && r.data.content) {
        try {
          const payload = JSON.parse(b64dec(r.data.content));
          return { sha: r.data.sha, payload: payload };
        } catch (e) { return null; }
      }
      await new Promise(r2 => setTimeout(r2, 800));
    }
    throw new Error('下载同步数据失败');
  }

  async function putRemote(payload, sha) {
    const p = '/repos/' + db.sync.owner + '/' + db.sync.repo + '/contents/' + SYNC_FILE;
    const body = {
      message: 'sync from ' + (db.sync.device || 'device') + ' @ ' + new Date().toISOString(),
      content: b64enc(JSON.stringify(payload))
    };
    if (sha) body.sha = sha;
    const r = await gh(p, { method: 'PUT', body });
    if (r.status === 409 || r.status === 422) return { conflict: true, msg: (r.data && r.data.message) || '' };
    if (!r.ok) throw new Error('上传失败（' + r.status + '）' + ((r.data && r.data.message) ? '：' + r.data.message : ''));
    return { sha: r.data && r.data.content ? r.data.content.sha : sha };
  }

  /* v47 修正：毫秒时间戳超过了 32 位整数，用 `| 0` 会溢出成负数，
     比较结果全错（墓碑合并不进来）。统一用这个函数读时间戳。 */
  function TS(v) { const n = Number(v); return isFinite(n) ? n : 0; }

  /* v47：错题的「内容指纹」= 科目 + 题目。
     两台设备各自记过一次同一道题时 id 不一样，只按 id 删不掉另一台那份；
     所以删除时也记一条内容指纹，另一台收到后连自己那份一起清掉。 */
  function mkKey(m) {
    return (m && m.q) ? (String(m.subject || '') + '\u0001' + String(m.q).trim()) : '';
  }
  function mkBuried(m) {
    if (!m) return true;
    if (m.id && db.mkDeleted && db.mkDeleted[m.id]) return true;
    const k = mkKey(m);
    if (!k || !db.mkGone || !db.mkGone[k]) return false;
    // 删掉之后又做错的（时间更晚）：算新错题，指纹作废
    if (TS(m.ts) > TS(db.mkGone[k])) { delete db.mkGone[k]; return false; }
    return true;
  }

  /* v47：把「科目 + 日期 + 题目」完全相同的错题收成一条。
     两台设备各自记过一次，会存成两条内容一样、id 不同的题：孩子看到两道一样的，
     删掉一条还剩一条，就像是删不掉。收起来的那条也记进删除名单。 */
  function dedupeMistakes() {
    if (!Array.isArray(db.mistakes)) { db.mistakes = []; return; }
    const seen = new Map();
    db.mistakes = db.mistakes.filter(m => {
      if (!m) return false;
      if (mkBuried(m)) return false;
      const k = [m.subject || '', m.date || '', String(m.q || '').trim()].join('\u0001');
      const e = seen.get(k);
      if (!e) { seen.set(k, m); return true; }
      if (m.mastered && !e.mastered) e.mastered = true;
      if (!e.note && m.note) e.note = m.note;
      if (!e.zh && m.zh) e.zh = m.zh;
      if (!e.tip && m.tip) e.tip = m.tip;
      buryMistake(m);
      return false;
    });
  }

  /* v46：删错题时在本地记一个「墓碑」。
     本来只是从数组里过滤掉，但另一台设备还留着同一道题，同步一合并又回来了。
     墓碑随数据一起同步，合并时按名单剔除，删掉的就真的没了。
     v47 起同时记 id 和内容指纹：id 只对得上同一份记录，指纹才能清掉另一台那份。
     只增不减，超过 600 条时丢掉最早的（正常一年也删不到这么多）。 */
  function trimMap(o, max) {
    const keys = Object.keys(o);
    const lim = max || 600;
    if (keys.length <= lim) return;
    keys.sort((a, b) => TS(o[a]) - TS(o[b]));
    keys.slice(0, keys.length - lim).forEach(k => { delete o[k]; });
  }
  function buryMistake(m) {
    if (!m) return;
    const id = typeof m === 'string' ? m : m.id;
    const t = Date.now();
    db.mkDeleted = (db.mkDeleted && typeof db.mkDeleted === 'object' && !Array.isArray(db.mkDeleted)) ? db.mkDeleted : {};
    db.mkGone = (db.mkGone && typeof db.mkGone === 'object' && !Array.isArray(db.mkGone)) ? db.mkGone : {};
    if (id) db.mkDeleted[id] = t;
    const k = (typeof m === 'object') ? mkKey(m) : '';
    if (k) db.mkGone[k] = t;
    trimMap(db.mkDeleted, 600);
    trimMap(db.mkGone, 600);
  }

  /* 合并：记录类按条目取并集，标量类取较大值，设置类以较新的一边为准 */
  function mergeAll(L, R) {
    const out = JSON.parse(JSON.stringify(L));
    const newer = (R.sync && R.sync.updatedAt || 0) > (L.sync && L.sync.updatedAt || 0);
    let changed = false;
    const mark = () => { changed = true; };

    // 打卡记录：并集，同一天取星星多的那次
    const ck = Object.assign({}, out.checkins || {});
    for (const k in (R.checkins || {})) {
      const a = ck[k], b = R.checkins[k];
      if (!a) { ck[k] = b; mark(); }
      else if ((b.stars | 0) > (a.stars | 0)) { ck[k] = Object.assign({}, a, { stars: b.stars }); mark(); }
    }
    out.checkins = ck;

    /* 作业条目：按日期 + id 并集。
       v52：完成状态按「最后一次点击」的时间（doneAt）取新的，不再无条件让 done:true 赢——
       不然本机取消勾选后，同步会把另一台/云端遗留的 done:true 合并回来，钩子自动复活。
       老数据没有 doneAt 时保持原来的「有一边打钩就算完成」兜底。 */
    const tk = Object.assign({}, out.tasks || {});
    for (const d in (R.tasks || {})) {
      const mine = (tk[d] || []).slice();
      const map = new Map(mine.map(t => [t.id, t]));
      let add = false;
      for (const t of R.tasks[d]) {
        const e = map.get(t.id);
        if (!e) { map.set(t.id, t); add = true; }
        else if (!!t.done !== !!e.done) {
          const rt = TS(t.doneAt), lt = TS(e.doneAt);
          if (rt > lt) {                    /* 远端最后点的：跟它走（勾上或取消都算） */
            map.set(t.id, Object.assign({}, e, { done: !!t.done, doneAt: t.doneAt }));
            add = true;
          } else if (rt === lt && t.done && !e.done) {
            /* 两边都没有时间戳（老数据）：维持旧规则，至少不会把已完成的弄丢 */
            map.set(t.id, Object.assign({}, e, { done: true }));
            add = true;
          }
        }
      }
      if (add) { tk[d] = Array.from(map.values()); mark(); }
    }
    out.tasks = tk;

    /* v50：每日基础任务模板 + 两张删除名单。
       模板按「科目+内容」并集（id 也由内容推出，重复项自然合并）；
       删掉的模板项、当天删掉的任务都按时间取新的，避免另一台又补回来。 */
    const bg = Object.assign({}, out.baseGone || {});
    for (const k in (R.baseGone || {})) {
      if (TS(R.baseGone[k]) > TS(bg[k])) { bg[k] = R.baseGone[k]; mark(); }
    }
    out.baseGone = bg;
    const tg = Object.assign({}, out.taskGone || {});
    for (const k in (R.taskGone || {})) {
      if (TS(R.taskGone[k]) > TS(tg[k])) { tg[k] = R.taskGone[k]; mark(); }
    }
    out.taskGone = tg;
    const bm = new Map();
    (out.baseTasks || []).forEach(b => {
      if (!b || !b.content) return;
      const k = baseKeyOf(b);
      if (bg[k]) return;
      bm.set(k, b);
    });
    (R.baseTasks || []).forEach(b => {
      if (!b || !b.content) return;
      const k = baseKeyOf(b);
      if (bg[k] || bm.has(k)) return;
      bm.set(k, b); mark();
    });
    out.baseTasks = Array.from(bm.values());
    /* 当天清单里已经被删掉的条目（另一台删的）顺手清掉 */
    for (const d in out.tasks) {
      const arr = out.tasks[d];
      if (!Array.isArray(arr)) continue;
      const kept = arr.filter(t => !tg[d + '|' + t.id]);
      if (kept.length !== arr.length) { out.tasks[d] = kept; mark(); }
    }

    // 错题本：先把两边的「已删除」名单合起来，按 id 并集，讲懂过就算讲懂
    const dead = Object.assign({}, out.mkDeleted || {});
    const gone = Object.assign({}, out.mkGone || {});
    for (const id in (R.mkDeleted || {})) {
      if (TS(R.mkDeleted[id]) > TS(dead[id])) { dead[id] = R.mkDeleted[id]; mark(); }
    }
    for (const k in (R.mkGone || {})) {
      if (TS(R.mkGone[k]) > TS(gone[k])) { gone[k] = R.mkGone[k]; mark(); }
    }
    /* id 对得上，或者内容指纹对得上（另一台记的同一道题、id 不同），都算已删 */
    const buried = m => {
      if (!m) return true;
      if (m.id && dead[m.id]) return true;
      const k = mkKey(m);
      if (!k || !gone[k]) return false;
      if (TS(m.ts) > TS(gone[k])) { delete gone[k]; mark(); return false; }   // 删掉以后又做错的新记录
      return true;
    };
    const mkLen = (out.mistakes || []).length;
    const mkMap = new Map();
    for (const m of (out.mistakes || [])) {
      if (!m) { mark(); continue; }
      if (buried(m)) {
        if (m.id && !dead[m.id]) dead[m.id] = Date.now();   // 顺手补 id，旧版本设备也能删掉
        mark(); continue;
      }
      mkMap.set(m.id, m);
    }
    for (const m of (R.mistakes || [])) {
      if (!m || buried(m)) continue;
      const e = mkMap.get(m.id);
      if (!e) { mkMap.set(m.id, m); mark(); }
      else if (m.mastered && !e.mastered) { mkMap.set(m.id, Object.assign({}, e, { mastered: true })); mark(); }
    }
    if (mkMap.size !== mkLen) mark();
    out.mistakes = Array.from(mkMap.values());
    out.mkDeleted = dead;
    out.mkGone = gone;
    /* v47：两台设备各自记下的同一道题（id 不同、内容一样）并集会变成两条，
       孩子看到两道一模一样的题，删一条还剩一条。这里按「科目+日期+题目」收敛成一条。 */
    const byQ = new Map();
    out.mistakes = out.mistakes.filter(m => {
      const k = [m.subject || '', m.date || '', String(m.q || '').trim()].join('\u0001');
      const e = byQ.get(k);
      if (!e) { byQ.set(k, m); return true; }
      if (m.mastered && !e.mastered) e.mastered = true;
      if (!e.note && m.note) e.note = m.note;
      if (!e.zh && m.zh) e.zh = m.zh;
      if (!e.tip && m.tip) e.tip = m.tip;
      mark();
      return false;
    });

    // 自定义词库：按单词去重并集
    const wMap = new Map((out.customWords || []).map(w => [String(w.word || w).toLowerCase(), w]));
    for (const w of (R.customWords || [])) {
      const key = String(w.word || w).toLowerCase();
      if (!wMap.has(key)) { wMap.set(key, w); mark(); }
    }
    out.customWords = Array.from(wMap.values());

    // 计数 / 连续天数 / 星星：取大值，避免来回覆盖导致倒退
    const cs = Object.assign({}, out.counters || {});
    for (const k in (R.counters || {})) {
      if ((R.counters[k] | 0) > (cs[k] | 0)) { cs[k] = R.counters[k]; mark(); }
    }
    out.counters = cs;
    /* 星星会被兑换掉，直接「取大」的旧逻辑会让另一边留着的余额把星星顶回来。
       累计星星 = 当前星星 + 已兑换，只增不减；余额 = 累计 - 已兑换。 */
    const totStars = Math.max((out.stars | 0) + (out.starUsed | 0), (R.stars | 0) + (R.starUsed | 0));
    const usedStars = Math.max(out.starUsed | 0, R.starUsed | 0);
    if (totStars !== (out.stars | 0) + (out.starUsed | 0) || usedStars !== (out.starUsed | 0)) {
      out.starUsed = usedStars;
      out.stars = Math.max(0, totStars - usedStars);
      mark();
    }
    if ((R.bestStreak | 0) > (out.bestStreak | 0)) { out.bestStreak = R.bestStreak; mark(); }

    // 口算最好成绩
    out.oral = out.oral || { best: {} };
    out.oral.best = out.oral.best || {};
    for (const k in ((R.oral && R.oral.best) || {})) {
      if ((R.oral.best[k] | 0) > (out.oral.best[k] | 0)) { out.oral.best[k] = R.oral.best[k]; mark(); }
    }

    // 宠物：积分会被兑换零食花掉，同样用「累计获得 - 累计花掉」算余额
    out.pet = Object.assign({}, out.pet || {});
    const RP = R.pet || {};
    const petIn = p => (p && p.pointsIn != null) ? (p.pointsIn | 0) : Math.max(0, ((p && p.points) | 0) + ((p && p.pointsOut) | 0));
    const petOut = p => (p && p.pointsOut) | 0;
    const inMax = Math.max(petIn(out.pet), petIn(RP));
    const outMax = Math.max(petOut(out.pet), petOut(RP));
    const pointsBal = Math.max(0, inMax - outMax);
    if (inMax !== (out.pet.pointsIn | 0) || outMax !== (out.pet.pointsOut | 0) || pointsBal !== (out.pet.points | 0)) mark();
    out.pet.pointsIn = inMax;
    out.pet.pointsOut = outMax;
    out.pet.points = pointsBal;
    ['fed', 'fondness'].forEach(k => {
      if ((RP[k] | 0) > (out.pet[k] | 0)) { out.pet[k] = RP[k]; mark(); }
    });
    out.pet.food = Object.assign({}, out.pet.food || {});
    /* v48：喂食记录按时间取并集（同一毫秒只算一次），只留最近 3 天——
       更早的早就饿回去了，留着只会让数据越来越大 */
    const fl = [];
    const seenFeedT = new Set();
    const addFeed = f => {
      const t = TS(f && f.t);
      if (!t || seenFeedT.has(t)) return;
      seenFeedT.add(t);
      fl.push({ t: t, e: Math.max(0, Math.min(100, Number(f.e) || 0)) });
    };
    (out.pet.feedLog || []).forEach(addFeed);
    (RP.feedLog || []).forEach(addFeed);
    fl.sort((a, b) => a.t - b.t);
    const flKept = fl.filter(f => f.t >= Date.now() - 3 * 24 * 3600000);
    if (flKept.length !== (out.pet.feedLog || []).length) mark();
    out.pet.feedLog = flKept;
    for (const k in (RP.food || {})) {
      if ((RP.food[k] | 0) > (out.pet.food[k] | 0)) { out.pet.food[k] = RP.food[k]; mark(); }
    }
    if ((!out.pet.avatar || out.pet.avatar === '') && RP.avatar) { out.pet.avatar = RP.avatar; mark(); }
    if ((!out.pet.pic || out.pet.pic === '') && RP.pic) { out.pet.pic = RP.pic; mark(); }
    if (Array.isArray(RP.log) && RP.log.length) {
      const seen = new Set((out.pet.log || []).map(x => x.t + '|' + x.k));
      const add = RP.log.filter(x => !seen.has(x.t + '|' + x.k));
      if (add.length) { out.pet.log = (out.pet.log || []).concat(add).slice(-200); mark(); }
    }

    // 设置：首次在这台设备上连接时，整体以已有设备为准；之后按修改时间取新的。
    // 例外：音效开关与音量是「这台设备的偏好」，不跟着账号走 ——
    // 否则另一台设备的旧设置会在同步时把本机刚调好的音量盖回去（v49 修的就是这个）。
    if ((newer || !(L.sync && L.sync.lastAt)) && R.settings && stable(R.settings) !== stable(out.settings)) {
      const mergedSet = Object.assign({}, out.settings, R.settings, {
        sound: out.settings.sound === undefined ? true : out.settings.sound,
        soundVolume: out.settings.soundVolume === undefined ? 0.5 : out.settings.soundVolume
      });
      if (stable(mergedSet) !== stable(out.settings)) { out.settings = mergedSet; mark(); }
    }

    out.sync = Object.assign({}, L.sync);
    return { data: out, changed };
  }

  async function syncNow(why) {
    if (!db.sync.token || !db.sync.on) return null;
    if (SYNC.busy) return SYNC.busy;
    SYNC.state = 'syncing';
    paintSync();
    let changed = false;
    SYNC.busy = (async () => {
      try {
        await ensureRepo();
        const remote = await pullRemote();
        let sha = remote ? remote.sha : '';
        /* v47：把云端那份的错题情况记下来，设置里能看到「本机几道 / 云端几道」，
           两台设备对不上时一眼就知道是没同步成功，还是数据真的不一样 */
        if (remote && remote.payload && remote.payload.data) {
          const rd = remote.payload.data;
          SYNC.info = {
            at: remote.payload.updatedAt || 0, device: remote.payload.device || '',
            mistakes: (rd.mistakes || []).length,
            deleted: Object.keys(rd.mkDeleted || {}).length
          };
        } else {
          SYNC.info = { at: 0, device: '', mistakes: 0, deleted: 0, empty: true };
        }

        if (remote && remote.payload && remote.payload.data) {
          const before = stable(stripForUpload(db));
          const merged = mergeAll(db, remote.payload.data);
          if (merged.changed && stable(stripForUpload(merged.data)) !== before) {
            SYNC.lock = true;
            db = merged.data;
            db.sync.updatedAt = Math.max(db.sync.updatedAt || 0, remote.payload.updatedAt || 0) + 1;
            SYNC.lock = false;
            persist();
            changed = true;
          }
        }

        const local = stripForUpload(db);
        const same = remote && remote.payload && remote.payload.data &&
          stable(remote.payload.data) === stable(local);
        if (!same) {
          const payload = { v: SYNC_VER, updatedAt: db.sync.updatedAt || Date.now(), device: db.sync.device, data: local };
          let r = await putRemote(payload, sha);
          if (r.conflict) {
            // 另一端刚写过：重新拉、再合并、再推一次
            const fresh = await pullRemote();
            if (fresh && fresh.payload && fresh.payload.data) {
              const m2 = mergeAll(db, fresh.payload.data);
              if (m2.changed) { SYNC.lock = true; db = m2.data; SYNC.lock = false; changed = true; }
            }
            payload.data = stripForUpload(db);
            payload.updatedAt = db.sync.updatedAt = Date.now();
            r = await putRemote(payload, fresh ? fresh.sha : '');
            if (r.conflict) throw new Error('两台设备同时改动，稍后会自动重试 [' + (r.msg || '') + ']');
          }
          sha = r.sha;
        }

        db.sync.sha = sha;
        db.sync.lastAt = Date.now();
        db.sync.err = '';
        SYNC.state = 'ok';
        SYNC.tries = 0;
      } catch (e) {
        SYNC.state = 'err';
        SYNC.err = String((e && e.message) || e);
        db.sync.err = SYNC.err;
      } finally {
        SYNC.busy = null;
        SYNC.lock = false;
        persist();
        paintSync();
        /* v49：合并后设置可能变了（例如另一台改了音效），让音效立刻跟着走，
           不然要等下次重开 App 才生效。 */
        try { Sound.config({ on: db.settings.sound !== false, vol: db.settings.soundVolume == null ? 0.5 : db.settings.soundVolume }); } catch (e) { }
        if (changed) { try { render(); } catch (e) {} }
      }
      return SYNC.state;
    })();
    return SYNC.busy;
  }

  function syncAgo(ts) {
    if (!ts) return '还没同步过';
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 45) return '刚刚同步';
    if (s < 3600) return Math.floor(s / 60) + ' 分钟前同步';
    if (s < 86400) return Math.floor(s / 3600) + ' 小时前同步';
    return Math.floor(s / 86400) + ' 天前同步';
  }

  /* 把技术错误翻成家长能看懂的一句话 */
  function syncErrText(e) {
    const s = String(e || '');
    if (/Failed to fetch|NetworkError|Load failed|network error|net::/i.test(s)) return '连不上 GitHub（网络问题），换到 Wi-Fi 或稍后再试';
    if (/401|令牌无效|Bad credentials/i.test(s)) return 'GitHub 令牌失效了，需要重新生成一次再连接';
    if (/409|422|同时改动/.test(s)) return '两台设备刚好同时改动，点「立即同步」重试一次';
    if (/403/.test(s)) return 'GitHub 拒绝了这次请求（403），检查令牌权限是否包含仓库读写';
    return s || '未知原因';
  }

  function syncBoxHtml() {
    const s = db.sync;
    if (!s.on || !s.token) {
      return '<div class="sync-box">' +
        '<div class="sync-title">' + ic('refresh', 'sm') + ' 两台设备共用一份记录</div>' +
        '<div class="tiny muted" style="line-height:1.85;margin:6px 0 10px">平板和手机登录同一个 GitHub 账号，就能自动同步打卡、星星、错题和宠物。' +
        '数据存在你自己的私有仓库里，别人看不到，也不需要额外的服务器。</div>' +
        '<button class="btn sm" data-action="sync-start">' + ic('refresh', 'sm') + '连接并开启同步</button></div>';
    }
    const st = SYNC.state;
    const dot = st === 'err' ? 'var(--coral)' : st === 'syncing' ? 'var(--sun)' : 'var(--green, #35b37e)';
    const txt = st === 'syncing' ? '正在同步…'
      : st === 'err' ? ('同步失败：' + esc(syncErrText(SYNC.err || db.sync.err)))
        : syncAgo(s.lastAt);
    /* v47：本机与云端的错题对不上时，家长能一眼看出差在哪 */
    const info = SYNC.info;
    const mine = db.mistakes.length;
    const mineDel = Object.keys(db.mkDeleted || {}).length;
    const diff = !!info && st === 'ok' && info.mistakes !== mine;
    const infoLine = info && st !== 'err' && st !== 'syncing'
      ? '<div class="sync-line tiny ' + (diff ? '' : 'muted') + '" style="margin-top:6px">' +
      '<b>错题：本机 ' + mine + ' 道 · 云端 ' + (info.mistakes | 0) + ' 道</b>' +
      (mineDel || info.deleted ? '<span class="muted">（删除记录 ' + mineDel + ' / ' + (info.deleted | 0) + '）</span>' : '') + '</div>'
      : '';
    return '<div class="sync-box on">' +
      '<div class="sync-line"><i class="sync-dot" style="background:' + dot + '"></i>' +
      '<b>' + esc(s.owner || '已连接') + ' / ' + esc(s.repo) + '</b></div>' +
      '<div class="tiny muted" style="margin:4px 0 2px">' + txt + '</div>' + infoLine +
      '<div class="btn-row" style="margin-top:10px">' +
      '<button class="btn ghost sm" data-action="sync-now">' + ic('refresh', 'sm') + '立即同步</button>' +
      '<button class="btn ghost sm" data-action="sync-clear-mk">' + ic('trash', 'sm') + '清空本机错题</button>' +
      '<button class="btn ghost sm" data-action="sync-off" style="color:var(--coral)">关闭同步</button></div></div>';
  }
  function paintSync() {
    const box = document.getElementById('syncBox');
    if (box) box.innerHTML = syncBoxHtml();
  }

  /* 打开浏览器可见时补一次同步（iOS 从后台回来最常见） */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && db.sync.on && db.sync.token) {
      setTimeout(() => { syncNow('visible'); }, 1200);
    }
  });


  /* ---------------- v25 · 学习难度与课本 ---------------- */
  const BOOKS = [
    { id: 'wy2024', name: '外研社（2024 新版）' },
    { id: 'pep', name: '人教版 PEP' },
    { id: 'sh2024', name: '上海版（沪教牛津 · 新版）' },
    { id: 'yl', name: '译林版' },
    { id: 'other', name: '其他 / 自编教材' }
  ];
  const GRADE_CN = ['一', '二', '三', '四', '五', '六'];
  function gradeNo() { return Math.min(6, Math.max(1, parseInt(db.settings.grade, 10) || 5)); }
  function termNo() { return parseInt(db.settings.term, 10) === 2 ? 2 : 1; }
  function gradeName(n) { return GRADE_CN[Math.min(6, Math.max(1, n)) - 1] + '年级'; }
  /* 数学难度：比年级低一档 / 跟年级 / 高一档 */
  function mathGrade() {
    const lv = db.settings.mathLevel || 'normal';
    return Math.min(6, Math.max(1, gradeNo() + (lv === 'easy' ? -1 : lv === 'hard' ? 1 : 0)));
  }
  function bookName(id) { const b = BOOKS.find(x => x.id === (id || 'wy2024')); return b ? b.name : '外研社（2024 新版）'; }
  function bookLabel() { return bookName(db.settings.book) + ' · ' + gradeName(gradeNo()) + (termNo() === 1 ? '上册' : '下册'); }

  const S = {
    tab: 'home',
    cal: { y: new Date().getFullYear(), m: new Date().getMonth() },
    dict: { stage: 'setup', units: [], rate: 0.85, queue: [], idx: 0, answers: [], hint: false, input: '', checked: false, lastOK: false, showZh: true },
    math: { tab: 'photo', subject: '数学', rows: [], judge: null, tag: 'all', gen: [], quiz: { ids: [], idx: 0, answers: [], input: '', checked: false, lastOK: false } },
    oral: { list: [], answers: [], startAt: 0, endAt: 0, limitMs: 0, running: false, done: false, timedOut: false, elapsed: 0, timer: null, cur: 0 },
    photo: { url: '', text: '', busy: false, name: '', subject: 'math', blob: null },
    dictPhoto: null,                       /* v26：听写拍照导入的临时状态 */
    mk: { filter: 'all', open: null, speakingId: null },
    baseEdit: null,                        /* v50：正在编辑的每日基础任务 */
    baseBack: false,                       /* v51：基础任务编辑弹窗是否从设置页打开（关掉时回设置） */
    keepDraft: false,                      /* v51：回到设置页时保留已输入未保存的设置草稿 */
    draft: null,
    pendingImport: null,
    modal: null
  };
  S.dict.rate = db.settings.rate;
  S.dict.showZh = db.settings.showZh;

  /* ---------------- 派生统计 ---------------- */
  function tasks(date) { return db.tasks[date] || []; }

  /* ================= v50 · 每日基础任务 =================
   * 家长可以设一份「每天都要做」的基础清单（朗读、口算、整理书包……），
   * 每一项可以勾选周几生效，所以也能做出「工作日一套、周末一套」。
   * 每天第一次打开「今日作业」时自动补进当天清单，已打钩的状态不受影响。
   * 关键点：任务 id 用「科目+内容」推出来（两台设备生成同一个 id，同步不会重复）；
   * 删掉的任务记进 taskGone，删掉模板项记进 baseGone，都跟着数据走，免得被另一台补回来。
   */
  const WD_NAMES = ['日', '一', '二', '三', '四', '五', '六'];
  function baseKeyOf(t) { return String(t.subject || '') + '|' + String(t.content || '').trim(); }
  function baseTasksOf() { return Array.isArray(db.baseTasks) ? db.baseTasks : []; }
  function weekdayOf(dateStr) {
    const d = new Date(String(dateStr) + 'T00:00:00');
    return isNaN(d.getTime()) ? new Date().getDay() : d.getDay();
  }
  function baseTaskId(t) { return 'base:' + baseKeyOf(t); }
  /* 当天是否该出现这一项：days 为空 = 每天 */
  function baseOnDay(t, wd) {
    const days = Array.isArray(t.days) && t.days.length ? t.days : [0, 1, 2, 3, 4, 5, 6];
    return days.indexOf(wd) >= 0;
  }
  /* 把今天该做的基础任务补进清单。可以在每次渲染前调用，重复调用不会重复添加 */
  function seedDayTasks() {
    const day = today();
    const wd = weekdayOf(day);
    const list = db.tasks[day] || [];
    const have = new Set(list.map(t => baseKeyOf(t)));
    const gone = db.taskGone || {};
    let added = 0;
    baseTasksOf().forEach(b => {
      if (!baseOnDay(b, wd)) return;
      const k = baseKeyOf(b);
      if (have.has(k)) return;
      if (gone[day + '|' + baseTaskId(b)]) return;      // 今天手动删掉了，别硬塞回来
      list.push({
        id: baseTaskId(b), subject: b.subject || '其他', content: String(b.content).trim(),
        minutes: Math.min(180, Math.max(1, b.minutes | 0 || 20)), done: false, base: 1
      });
      have.add(k); added++;
    });
    if (added) { db.tasks[day] = list; save(); }
    return added;
  }
  function streak() {
    let n = 0, d = today();
    if (!db.checkins[d]) d = addDays(d, -1);
    while (db.checkins[d]) { n++; d = addDays(d, -1); }
    return n;
  }
  function syncBest() { const s = streak(); if (s > db.bestStreak) { db.bestStreak = s; save(); } return db.bestStreak; }
  function stats() {
    syncBest();
    return {
      totalCheckins: Object.keys(db.checkins).length,
      bestStreak: db.bestStreak,
      totalStars: db.stars + (db.starUsed || 0),   // 换掉的星星也算进累计，徽章不会掉
      dictationCount: db.counters.dictation,
      mathCount: db.counters.math,
      masteredCount: db.mistakes.filter(m => m.mastered).length
    };
  }
  function addStars(n) { db.stars += n; save(); }
  function addMistake(obj) {
    const exist = db.mistakes.find(m => !m.mastered && m.subject === obj.subject && m.q === obj.q);
    if (exist) { exist.mine = obj.mine; exist.date = today(); exist.ts = Date.now(); }
    else {
      const item = Object.assign({ id: uid(), date: today(), mastered: false, note: '' }, obj, { ts: Date.now() });
      db.mistakes.unshift(item);
      /* v47：删掉的题后来又做错了，要能重新收进来——清掉内容指纹，否则下次打开又被过滤掉 */
      const k = mkKey(item);
      if (k && db.mkGone) delete db.mkGone[k];
    }
    save();
  }

  /* ---------------- 判分 ---------------- */
  const norm = s => String(s == null ? '' : s).trim().replace(/\s+/g, '').toLowerCase().replace(/。$/, '');
  function parseFrac(s) {
    const t = String(s).replace(/\s/g, '');
    let m = /^(\d+)\/(\d+)$/.exec(t);
    if (m && Number(m[2]) !== 0) return Number(m[1]) / Number(m[2]);
    m = /^(\d+)\s+(\d+)\/(\d+)$/.exec(String(s).trim());
    if (m && Number(m[3]) !== 0) return Number(m[1]) + Number(m[2]) / Number(m[3]);
    return null;
  }
  function grade(mine, correct, type) {
    const m = norm(mine), c = String(correct == null ? '' : correct).trim();
    if (!m) return false;
    const mn = parseFloat(m.replace(/[约≈元分棵米平方厘米²³°]/g, ''));
    const cn = parseFloat(c.replace(/[约≈元分棵米平方厘米²³°]/g, ''));
    if (type === 'frac') {
      const f = parseFrac(m), cf = parseFrac(c);
      if (f !== null && cf !== null) return Math.abs(f - cf) < 1e-6;
      if (!isNaN(mn) && !isNaN(cn)) return Math.abs(mn - cn) < 1e-6;
      return m === norm(c);
    }
    if (type === 'num') {
      if (!isNaN(mn) && !isNaN(cn)) return Math.abs(mn - cn) < 1e-6;
      return m === norm(c);
    }
    return c.split('|').some(x => norm(x) === m);
  }
  function inferTag(q) {
    const s = String(q);
    if (/面积|平行四边形|三角形|梯形|周长|正方形|长方形/.test(s)) return 'area';
    if (/体积|立方|平方米|平方分米|换算|厘米|cm³/.test(s)) return 'volume';
    if (/解方程|x\s*[+\-×÷=]|=\s*\?\s*x|x =|x=/.test(s)) return 'equation';
    if (/\//.test(s) || /分数|几分之/.test(s)) return 'fraction';
    if (/找回|一共|每隔|平均|买|元|米|棵|付|走一圈/.test(s)) return 'word';
    if (/[+\-×÷]\s*\d/.test(s) && /\(|\)/.test(s)) return 'mixed';
    if (/×|÷/.test(s) && /\./.test(s)) return 'decimal';
    if (/最大公因数|最小公倍数|因数|栽|间隔/.test(s)) return 'number';
    return 'mixed';
  }

  /* ---------------- 音频底座：音效与高清发音共用一个 AudioContext ---------------- */
  /* iOS 只允许用户手势里 resume；解锁之后 Web Audio 的 source.start() 不再受手势限制。
     这是「预录 MP3 用 Web Audio 播、而不是 new Audio().play()」的关键原因。 */
  const AudioSys = (function () {
    let ctx = null;
    function get() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try { ctx = new AC(); } catch (e) { return null; }
      }
      if (ctx.state === 'suspended') {
        try { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) { }
      }
      return ctx;
    }
    return { get: get, wake: get };
  })();

  /* ---------------- 语音：内置词库播高清预录音，其余回退浏览器朗读 ---------------- */
  let voicesReady = [];
  function loadVoices() { if ('speechSynthesis' in window) voicesReady = window.speechSynthesis.getVoices() || []; }
  if ('speechSynthesis' in window) { loadVoices(); window.speechSynthesis.onvoiceschanged = loadVoices; }
  const wordKey = w => String(w).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') + '.mp3';

  /* 高清发音引擎：先把 MP3 解码成 AudioBuffer，再用 Web Audio 播放。
     旧做法 new Audio(src).play() 在 iPad 上首词常因「音频还没加载完」被系统拒绝，
     一旦被拒就静默回退到旧的浏览器朗读，听起来就像「语音没换」。 */
  const Voice = (function () {
    const buffers = {};   // key -> AudioBuffer，解码一次反复用
    const pending = {};   // key -> Promise，避免同一个词重复请求
    let cur = null;       // 当前正在播的 BufferSource，新词来了先停掉
    function load(key) {
      if (buffers[key]) return Promise.resolve(buffers[key]);
      if (pending[key]) return pending[key];
      const c = AudioSys.get();
      if (!c) return Promise.reject(new Error('no-audiocontext'));
      pending[key] = fetch('audio/' + key)
        .then(r => { if (!r.ok) throw new Error('http-' + r.status); return r.arrayBuffer(); })
        .then(ab => new Promise((resolve, reject) => {
          let settled = false;
          const done = buf => { if (settled) return; settled = true; buffers[key] = buf; delete pending[key]; resolve(buf); };
          const fail = err => { if (settled) return; settled = true; delete pending[key]; reject(err); };
          try {
            const ret = c.decodeAudioData(ab, done, fail);      // 老 Safari：回调形式
            if (ret && ret.then) ret.then(done, fail);          // 新浏览器：Promise 形式
          } catch (e) { fail(e); }
        }))
        .catch(e => { delete pending[key]; throw e; });
      return pending[key];
    }
    function play(w, rate, onStart) {
      const c = AudioSys.get();
      if (!c) return Promise.reject(new Error('no-audiocontext'));
      return load(wordKey(w)).then(buf => new Promise((resolve, reject) => {
        try {
          if (cur) { try { cur.onended = null; cur.stop(); } catch (e) { } }
          const src = c.createBufferSource(), g = c.createGain();
          g.gain.value = 1;
          src.buffer = buf;
          if (rate && src.playbackRate) { try { src.playbackRate.value = Math.min(1.3, Math.max(0.5, rate)); } catch (e) { } }
          src.connect(g); g.connect(c.destination);
          src.onended = () => { if (cur === src) cur = null; resolve(); };
          cur = src;
          src.start(0);
          if (onStart) { try { onStart(); } catch (e) { } }
        } catch (e) { reject(e); }
      }));
    }
    return {
      unlock() { AudioSys.wake(); },
      load: load,
      prefetch(key) { return load(key).catch(() => {}); },   // 提前解码，点播放立刻出声
      play: play
    };
  })();

  /* 在线真人发音（有道词典）：本地没有预录音的词（手动输入的、或还没缓存上的课本词）
     用它兜底，不再退回难听的浏览器机器音。用 <audio> 元素播放，可绕过跨域限制。 */
  const OnlineVoice = (function () {
    let cur = null;
    function urlFor(text, le) {
      // 英文单词走有道；中文整句走百度翻译的真人语音（有道中文只支持单词级，整句会报错）
      if (le === 'zh') return 'https://fanyi.baidu.com/gettts?lan=zh&spd=5&source=web&text=' + encodeURIComponent(text);
      return 'https://dict.youdao.com/dictvoice?audio=' + encodeURIComponent(text) + '&le=en';
    }
    function stop() {
      if (cur) { try { cur.onended = null; cur.onerror = null; cur.pause(); } catch (e) { } cur = null; }
    }
    function play(text, rate, onStart, le) {
      return new Promise((resolve, reject) => {
        try {
          stop();
          const a = new Audio(urlFor(text, le));
          a.preload = 'auto';
          if (rate && a.playbackRate !== undefined) { try { a.playbackRate = Math.min(2, Math.max(0.5, rate)); } catch (e) { } }
          a.onended = () => { if (cur === a) cur = null; resolve(); };
          a.onerror = () => { if (cur === a) cur = null; reject(new Error('load-fail')); };
          cur = a;
          const p = a.play();
          if (onStart) { try { onStart(); } catch (e) { } }
          if (p && p.catch) p.catch(err => { if (cur === a) cur = null; reject(err); });
        } catch (e) { reject(e); }
      });
    }
    return { play: play, stop: stop };
  })();

  /* ---------- 讲题语音：用天禄的声音念 ----------
     讲解句子是每次现拼的，浏览器里合成不出天禄的声音，所以把「固定句型 + 知识点句库」
     提前用 6 种宠物声线录好（audio/lesson），运行时按句式拼接播放；
     题目里的长句子、答案数字只上屏、不硬读，避免用另一种声音串台。 */
  const LessonVoice = (function () {
    let manifest = null;
    let loading = null;
    let cur = null;
    let timer = null;
    let token = 0;
    let pool = [];
    /* 语音包文件改过内容（剪掉首尾静音），加版本号让 iPad 拿到新文件 */
    const VER = '?v=42';
    const CN = '零一二三四五六七八九';
    const U = ['', '十', '百', '千'];
    const SEC = ['', '万', '亿'];

    function hashText(str) {
      let h = 0x811c9dc5;
      for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
      return h.toString(36);
    }
    function ready() {
      if (manifest) return Promise.resolve(manifest);
      if (!loading) {
        loading = fetch('audio/lesson/index.json', { cache: 'force-cache' })
          .then(r => r.json()).then(j => (manifest = (j && j.lines) || {}))
          .catch(() => (manifest = {}));
      }
      return loading;
    }
    function readInt(str) {
      str = String(str).replace(/^0+(?=\d)/, '');
      if (str === '0') return '零';
      const secs = [];
      for (let i = str.length; i > 0; i -= 4) secs.unshift(str.slice(Math.max(0, i - 4), i));
      let out = '';
      secs.forEach((sec, idx) => {
        const su = SEC[secs.length - 1 - idx];
        let part = '', zero = false;
        for (let j = 0; j < sec.length; j++) {
          const d = +sec[j], pos = sec.length - 1 - j;
          if (d === 0) { zero = true; continue; }
          if (zero && part) part += '零';
          zero = false;
          part += CN[d] + U[pos];
        }
        if (part) {
          if (out && (zero || /^0/.test(sec))) out += '零';
          out += part + su;
        }
      });
      return out.replace(/^一十/, '十');
    }
    function readNumber(str) {
      const [ip, fp] = String(str).split('.');
      let out = readInt(ip || '0');
      if (fp) out += '点' + fp.split('').map(c => CN[+c] || '').join('');
      return out;
    }
    /* 纯数字算式才逐字读；带汉字的应用题题干只上屏 */
    function exprChars(text) {
      const t = String(text == null ? '' : text).replace(/\s/g, '');
      if (!t || !/^[\d.＋+\-−×*÷/=()（）]+$/.test(t)) return null;
      const map = { '+': '加', '＋': '加', '-': '减', '−': '减', '×': '乘以', '*': '乘以', '÷': '除以', '/': '除以', '=': '等于' };
      const out = [];
      let i = 0;
      while (i < t.length) {
        const c = t[i];
        if (/[\d.]/.test(c)) {
          let j = i;
          while (j < t.length && /[\d.]/.test(t[j])) j++;
          out.push(...readNumber(t.slice(i, j)).split(''));
          i = j;
        } else {
          if (map[c]) out.push(map[c]);
          i++;
        }
      }
      return out.length ? out : null;
    }
    function stop() {
      token++;
      clearTimeout(timer);
      timer = null;
      pool.forEach(a => { try { a.onended = null; a.onerror = null; a.pause(); } catch (e) { } });
      pool = [];
      cur = null;
    }
    /* lines 元素是字符串（固定句）或 {expr:'36+27'}（算式）。
       返回 false 表示语音包不可用，调用方应退回在线发音。 */
    function play(lines, style, onEnd) {
      stop();
      const my = ++token;
      if (!manifest || !Object.keys(manifest).length) return false;
      /* 音频文件的首尾静音已经剪掉了，这里只需要极短的换气：
         句子之间 90ms，数字/运算积木之间 0ms（靠音频尾部 45ms 余量自然连读） */
      const items = [];
      lines.forEach(x => {
        if (typeof x === 'string') { if (manifest[hashText(x)]) items.push({ t: x, gap: 90 }); }
        else if (x && x.expr) {
          const cs = exprChars(x.expr);
          if (cs) cs.forEach(c => { if (manifest[hashText(c)]) items.push({ t: c, gap: 0 }); });
        }
      });
      if (!items.length) return false;
      const dir = 'audio/lesson/' + style + '/';
      /* 同时只留两个 Audio：一个在响，下一个已经缓冲好，接缝几乎听不出来 */
      const mk = t => {
        const a = new Audio(dir + hashText(t) + '.mp3' + VER);
        a.preload = 'auto';
        pool.push(a);
        return a;
      };
      let a0 = mk(items[0].t);
      let a1 = items.length > 1 ? mk(items[1].t) : null;
      let k = 0;
      const finish = () => { cur = null; a0 = a1 = null; pool = []; if (onEnd) { try { onEnd(); } catch (e) { } } };
      const step = () => {
        if (my !== token) return;
        if (!a0) { finish(); return; }
        const a = a0, it = items[k];
        cur = a;
        let advanced = false;
        const next = () => {
          if (advanced) return;
          advanced = true;
          if (my !== token) return;
          if (cur === a) cur = null;
          a0 = a1;
          a1 = items[k + 2] ? mk(items[k + 2].t) : null;
          k++;
          timer = setTimeout(step, it.gap);
        };
        a.onended = next;
        a.onerror = next;
        const pr = a.play();
        if (pr && pr.catch) pr.catch(() => { if (my === token) next(); });
      };
      step();
      return true;
    }
    return { ready: ready, play: play, stop: stop, hashText: hashText, exprChars: exprChars, readNumber: readNumber };
  })();

  /* 讲解的「口播稿」：只说固定套路和知识点，具体题目、答案交给屏幕 */
  function lessonLines(m) {
    const lines = [];
    const add = t => { if (t) lines.push(t); };
    if (m.kind === 'general' && m.subject === '语文') {
      add('我们一起来看看这一题。');
      add('写错的字，我们一个一个字对清楚。');
      add('正确答案和你的答案都在屏幕上，我们对照着看。');
      add('建议先把正确答案认真读一遍，再遮住答案默写两遍，最后自己检查一遍。');
      add('明天再复习一次，写对了就可以标记已掌握啦。');
      return lines;
    }
    if (m.subject === '英语') {
      add('我们一起来看看这个单词。');
      add('这个单词怎么拼、是什么意思，我们看屏幕。');
      add('建议先把正确答案认真读一遍，再遮住答案默写两遍，最后自己检查一遍。');
      add('明天再复习一次，写对了就可以标记已掌握啦。');
      return lines;
    }
    add('我们一起来看看这道题。');
    if (LessonVoice.exprChars(m.q)) { add('我先把题目的数字读给你听。'); lines.push({ expr: m.q }); }
    else add('题目在屏幕上，我们一起读一遍。');
    add('正确答案和你的答案都在屏幕上，我们对照着看。');
    const L = D.lessons[m.tag] || D.lessons[inferTag(m.q)];
    if (L) {
      add('这道题考的知识点是' + L.title + '。');
      if (L.points && L.points.length) { add('先记住这几句话。'); L.points.forEach(add); }
      const steps = (m.solution && m.solution.length) ? m.solution : (L.steps || []);
      if (steps.length) { add('解题可以按这个顺序来。'); steps.forEach(add); }
      if (L.pitfalls && L.pitfalls.length) { add('最容易出错的地方是。'); L.pitfalls.forEach(add); }
      if (L.similar && L.similar.length) add('再自己试一道类似的题：' + L.similar[0].q + '。答案是' + L.similar[0].a + '。');
    }
    add('把思路说出来，再在本子上重新算一遍，就真正弄懂啦。');
    return lines;
  }

  /* 讲错题：优先用天禄的声音（语音包），没装好就退回在线真人发音 */
  function speakLesson(m, onEnd) {
    const sel = String(db.settings.zhVoiceURI || '');
    if (sel !== '' && sel !== 'pet') return speakChinese(aiLessonText(m), onEnd);
    stopChinese();
    const lines = lessonLines(m);
    const style = db.settings.petVoiceStyle || 'sweet';
    const my = zhToken;
    LessonVoice.ready().then(() => {
      if (my !== zhToken) return;
      const ok = LessonVoice.play(lines, style, () => { if (onEnd) { try { onEnd(); } catch (e) { } } });
      if (!ok) speakChinese(aiLessonText(m), onEnd);
    });
    return true;
  }

  function pickVoice() {
    const saved = db.settings.voiceURI;
    if (saved) { const hit = voicesReady.find(v => v.voiceURI === saved); if (hit) return hit; }
    const en = voicesReady.filter(v => /^en/i.test(v.lang));
    const score = v => {
      let s = 0;
      const n = (v.name || '') + ' ' + (v.voiceURI || '');
      if (/enhanced|premium|neural|siri/i.test(n)) s += 100;
      if (/en[-_]US/i.test(v.lang)) s += 50;
      if (/samantha|ava|allison|susan|aria|jenny|zira|alex|karen|moira|tessa|google us english/i.test(n)) s += 20;
      if (v.localService) s += 5;
      return s;
    };
    en.sort((a, b) => score(b) - score(a));
    return en[0] || null;
  }
  function ttsSpeak(text, rate) {
    if (!('speechSynthesis' in window)) { toast('当前浏览器不支持朗读'); return false; }
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text));
      u.lang = 'en-US'; u.rate = rate || S.dict.rate || 0.9; u.pitch = 1; u.volume = 1;
      const v = pickVoice(); if (v) u.voice = v;
      window.speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  }
  function speak(text, rate) {
    const w = String(text).trim();
    const isWord = /^[a-zA-Z][a-zA-Z\s\-']*$/.test(w);
    const r = rate || S.dict.rate || 0.9;
    if (db.settings.voiceMode !== 'tts' && isWord) {
      const rep = db.settings.repeat === true;
      S.dict.lastVoice = 'recorded';
      updateVoiceChip();
      Voice.play(w, r).then(() => {
        if (rep) setTimeout(() => Voice.play(w, r).catch(() => {}), 650);
      }).catch(() => {
        // 本地没有预录音（手动输入的词、或课本词还没缓存上）：改用在线真人发音（有道），
        // 不再退回难听的浏览器机器音；在线也失败（彻底断网）才退回 iPad 自带朗读。
        if (db.settings.onlineVoice !== false) {
          S.dict.lastVoice = 'online';
          updateVoiceChip();
          OnlineVoice.play(w, r, () => {
            if (rep) setTimeout(() => OnlineVoice.play(w, r).catch(() => {}), 650);
          }).catch(() => {
            S.dict.lastVoice = 'tts';
            ttsSpeak(w, r);
            toast('在线发音没连上，改用 iPad 自带朗读（请检查网络，或 iPad 侧边静音开关是否打开）');
            updateVoiceChip();
          });
        } else {
          S.dict.lastVoice = 'tts';
          ttsSpeak(w, r);
          toast('这个词没有预录音，已用浏览器朗读（可在「设置」开启在线真人发音）');
          updateVoiceChip();
        }
      });
    } else {
      S.dict.lastVoice = 'tts';
      ttsSpeak(w, r);
      updateVoiceChip();
    }
    return true;
  }
  function englishVoices() { return voicesReady.filter(v => /^en/i.test(v.lang)); }

  /* 听写页显示「实际生效」的发音来源，而不是只显示设置值，方便一眼确认有没有换成功 */
  function voiceChipHtml() {
    const wantRecorded = db.settings.voiceMode !== 'tts';
    const actual = S.dict.lastVoice || (wantRecorded ? 'recorded' : 'tts');
    let label = actual === 'recorded' ? '高清预录人声' : (actual === 'online' ? '在线真人发音' : '浏览器朗读');
    if (wantRecorded && actual === 'tts') label += '（预录音未生效，点播放重试）';
    return '<span class="chip m" id="voiceChip">' + label + '</span>';
  }
  function updateVoiceChip() {
    const el = $('#voiceChip');
    if (el) el.outerHTML = voiceChipHtml();
  }

  /* ---------------- 小工具 ---------------- */
  let toastTimer;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2300);
  }
  function confetti() {
    const box = document.createElement('div'); box.className = 'confetti';
    const colors = ['#7a6cf0', '#f5b73d', '#37b9a5', '#f4758b', '#5b9bf3'];
    for (let i = 0; i < 26; i++) {
      const p = document.createElement('i');
      p.style.cssText = 'position:absolute;left:' + (Math.random() * 100) + '%;top:-12px;width:8px;height:13px;border-radius:2px;background:' +
        colors[i % colors.length] + ';animation:fall ' + (1.3 + Math.random() * 1.2) + 's linear ' + (Math.random() * .5) + 's forwards;transform:rotate(' + (Math.random() * 180) + 'deg)';
      box.appendChild(p);
    }
    document.body.appendChild(box); setTimeout(() => box.remove(), 3200);
  }
  function openModal(html) { $('#modalRoot').innerHTML = '<div class="modal-mask" data-action="mask">' + html + '</div>'; }
  function closeModal() {
    $('#modalRoot').innerHTML = ''; S.draft = null; S.modal = null;
    /* v49：在设置里试听过的音量是临时的，关掉弹窗（含点「取消」）就恢复成已保存的设置 */
    Sound.config({ on: db.settings.sound !== false, vol: db.settings.soundVolume == null ? 0.5 : db.settings.soundVolume });
  }
  function modalHead(title) { return '<div class="modal-h"><h3>' + esc(title) + '</h3><button class="x" data-action="close-modal">' + ic('x') + '</button></div>'; }
  function empty(text, icon) { return '<div class="empty">' + ic(icon || 'book') + '<div>' + esc(text) + '</div></div>'; }
  const isStandalone = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;

  /* ---------------- 音效：Web Audio 合成，无需音频文件、离线可用 ---------------- */
  const Sound = (function () {
    const cfg = { on: true, vol: 0.5 };
    function ac() { return cfg.on ? AudioSys.get() : null; }
    function tone(freq, t, dur, type, amp, glide) {
      const c = ac(); if (!c) return;
      const o = c.createOscillator(), g = c.createGain();
      const s = c.currentTime + t;
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, s);
      if (glide) o.frequency.exponentialRampToValueAtTime(glide, s + dur);
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, amp * cfg.vol), s + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
      o.connect(g); g.connect(c.destination);
      o.start(s); o.stop(s + dur + 0.03);
    }
    return {
      config(o) { Object.assign(cfg, o); },
      wake() { AudioSys.wake(); },
      click() { tone(760, 0, 0.045, 'sine', 0.34, 1040); tone(1520, 0, 0.028, 'sine', 0.10); },
      tick() { tone(880, 0, 0.06, 'sine', 0.18); tone(1320, 0.055, 0.09, 'sine', 0.12); },
      ok() { tone(784, 0.06, 0.09, 'sine', 0.20); tone(1175, 0.15, 0.13, 'sine', 0.16); },
      no() { tone(330, 0.06, 0.17, 'triangle', 0.14, 220); },
      win() {
        [523, 659, 784, 1047].forEach((f, i) => {
          tone(f, 0.06 + i * 0.095, 0.24, 'sine', 0.22);
          tone(f * 2, 0.06 + i * 0.095, 0.16, 'sine', 0.05);
        });
      }
    };
  })();
  Sound.config({ on: db.settings.sound !== false, vol: db.settings.soundVolume == null ? 0.5 : db.settings.soundVolume });

  /* ---------------- 固定 iPad 画布 ---------------- */
  /* 横屏 / 竖屏两套尺寸：竖屏不再是「把横屏挤扁」，而是真的换一套布局 */
  const CANVAS = {
    follow: { h: [1180, 820], v: [834, 1194] },   // 跟随 iPad 方向（推荐）
    ipad11: { h: [1180, 820], v: [834, 1194] },
    ipad: { h: [1024, 768], v: [768, 1024] },
    ipadpro: { h: [1366, 1024], v: [1024, 1366] },
    ipad_h: { h: [1180, 820], v: [1180, 820] },   // 只锁横屏：竖过来也不换尺寸
    ipadv: { h: [834, 1194], v: [834, 1194] },    // 只锁竖屏
    auto: null
  };
  /* 判断当前是不是竖屏。iPad 上 innerHeight/innerWidth 最可靠，
     软件盘弹出时宽度不变，所以不会误判。 */
  function isPortrait() {
    const w = window.innerWidth || document.documentElement.clientWidth || 0;
    const h = window.innerHeight || document.documentElement.clientHeight || 0;
    if (!w || !h) return false;
    return h > w * 1.02;
  }
  function canvasSize() {
    const mode = CANVAS[db.settings.canvas] !== undefined ? db.settings.canvas : 'follow';
    const def = CANVAS[mode];
    if (!def) return null;
    const portrait = isPortrait();
    return { size: portrait ? def.v : def.h, portrait: portrait, mode: mode };
  }
  function applyCanvas() {
    const got = canvasSize(), root = document.documentElement;
    root.setAttribute('data-canvas', got ? got.mode : 'auto');
    root.setAttribute('data-orient', got && got.portrait ? 'portrait' : 'landscape');
    if (!got) { root.style.setProperty('--canvas-w', '100%'); root.style.setProperty('--canvas-h', '100vh'); }
    else { root.style.setProperty('--canvas-w', got.size[0] + 'px'); root.style.setProperty('--canvas-h', got.size[1] + 'px'); }
  }

  /* 旋转 iPad / 改窗口大小时重新套用画布；只有「横竖真的变了」才重绘，避免抖动 */
  let __lastOrient = null;
  function onViewportChange() {
    const p = isPortrait();
    applyCanvas();
    if (__lastOrient === null) { __lastOrient = p; return; }
    if (__lastOrient !== p) { __lastOrient = p; render(); }
  }
  window.addEventListener('resize', onViewportChange);
  window.addEventListener('orientationchange', () => setTimeout(onViewportChange, 120));

  /* ---------------- 导航 ---------------- */
  const NAV = [
    { id: 'home', name: '今日作业', icon: 'list' },
    { id: 'dict', name: '英语听写', icon: 'headphones' },
    { id: 'math', name: '作业检查', icon: 'camera' },
    { id: 'oral', name: '口算计时', icon: 'clock' },
    { id: 'mistakes', name: '错题本', icon: 'book' },
    { id: 'pet', name: '天禄小窝', icon: 'sparkles' }
  ];
  function renderNav() {
    const badge = db.mistakes.filter(m => !m.mastered).length;
    const petHungry = satietyNow() < 30;
    const html = NAV.map(n => '<button class="nav-item ' + (S.tab === n.id ? 'active' : '') + '" data-action="nav" data-tab="' + n.id + '">' +
      ic(n.icon) + '<span>' + n.name + '</span>' +
      (n.id === 'mistakes' && badge ? '<span class="dot">' + badge + '</span>' : '') +
      (n.id === 'pet' && petHungry ? '<span class="dot hg-dot"></span>' : '') + '</button>').join('');
    $('#nav').innerHTML = html;
    /* 手机底部导航多一个「设置」：手机上侧栏是隐藏的，顶栏统计条塞不下齿轮，
       直接做成常驻 tab 最稳，任何屏幕宽度都能点到 */
    $('#mobileNav').innerHTML = html +
      '<button class="nav-item" data-action="open-settings">' + ic('settings') + '<span>设置</span></button>';
  }
  function renderTop() {
    const h = new Date().getHours();
    const greet = h < 11 ? '早上好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好';
    const name = db.settings.name || '小朋友';
    const d = new Date();
    const st = stats();
    $('#topbar').innerHTML =
      '<div class="greet"><h1>' + greet + '，' + esc(name) + '</h1>' +
      '<p>' + d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 · 星期' + weekNames[d.getDay()] + ' · 今天也一起稳稳地往前走一小步</p></div>' +
      '<div class="stats">' +
      '<div class="stat sun">' + ic('star') + '<span>星星</span><b>' + st.totalStars + '</b></div>' +
      '<div class="stat flame">' + ic('flame') + '<span>连续</span><b>' + streak() + ' 天</b></div>' +
      '<div class="stat cal hide-sm">' + ic('calendar') + '<span>已打卡</span><b>' + st.totalCheckins + ' 天</b></div>' +
      '</div>';
  }
  function renderSide() {
    const list = tasks(today());
    const done = list.filter(t => t.done).length;
    const pct = list.length ? Math.round(done / list.length * 100) : 0;
    const goal = db.settings.goal || 5;
    const got = db.checkins[today()] ? db.checkins[today()].stars : 0;
    $('#sideProgress').innerHTML =
      '<div class="sc-title">' + ic('target', 'sm') + ' 今日完成度</div>' +
      '<div class="sc-num">' + pct + '<small>%</small></div>' +
      '<div class="sc-bar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="sc-hint">今日星星 ' + got + ' / 目标 ' + goal + ' 颗</div>';
  }

  /* ---------------- 视图 1：今日作业 ---------------- */
  function calendarHtml() {
    const { y, m } = S.cal;
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    let cells = ['日', '一', '二', '三', '四', '五', '六'].map(w => '<div class="cal-head">' + w + '</div>').join('');
    for (let i = 0; i < first; i++) cells += '<div class="cal-cell blank"></div>';
    for (let d = 1; d <= days; d++) {
      const key = y + '-' + pad(m + 1) + '-' + pad(d);
      const c = db.checkins[key];
      let cls = 'cal-cell';
      if (c) cls += c.rate >= 1 ? ' full' : c.rate >= 0.5 ? ' has' : ' partial';
      if (key === today()) cls += ' today';
      cells += '<div class="' + cls + '" title="' + key + (c ? '：完成 ' + Math.round(c.rate * 100) + '%' : '') + '">' + d + '</div>';
    }
    return cells;
  }
  /* v50：编辑「每日基础任务」的弹窗。v51 起入口移到设置弹窗里。
     只有点保存才写进 db。星期按钮的显示顺序是 一 二 三 四 五 六 日。 */
  const WD_ORDER = [1, 2, 3, 4, 5, 6, 0];
  function baseEditToHtml() {
    const rows = S.baseEdit.map((b, i) => {
      const days = Array.isArray(b.days) && b.days.length ? b.days : [0, 1, 2, 3, 4, 5, 6];
      const every = days.length === 7;
      return '<div class="ba-row" data-row="' + i + '">' +
        '<div class="ba-line1">' +
        '<select class="input ba-sub" data-ba="subject" data-i="' + i + '">' +
        ['语文', '数学', '英语', '其他'].map(s => '<option' + ((b.subject || '语文') === s ? ' selected' : '') + '>' + s + '</option>').join('') +
        '</select>' +
        '<input class="input ba-con" data-ba="content" data-i="' + i + '" value="' + esc(b.content || '') + '" placeholder="例：朗读课文 15 分钟" maxlength="60">' +
        '<input class="input ba-min" type="number" min="1" max="180" data-ba="minutes" data-i="' + i + '" value="' + (b.minutes || 20) + '">' +
        '<button class="btn ghost sm ba-del" data-action="base-del" data-i="' + i + '" aria-label="删除这一项">' + ic('trash', 'sm') + '</button>' +
        '</div>' +
        '<div class="ba-days">' + WD_ORDER.map(d =>
          '<button class="ba-day' + (days.indexOf(d) >= 0 ? ' on' : '') + '" data-action="base-day" data-i="' + i + '" data-d="' + d + '">' + WD_NAMES[d] + '</button>').join('') +
          '<span class="ba-hint">' + (every ? '每天' : '点亮的星期才加') + '</span>' +
          '</div></div>';
    }).join('');
    return '<div class="modal wide">' + modalHead('每日基础任务') +
      '<div class="tiny muted" style="line-height:1.8;margin-bottom:12px">把每天都要做的事设在这里（朗读、口算、整理书包……）。' +
      '每天第一次打开「今日作业」时自动加进清单，<b>已经打过的钩不会丢</b>；某项只在部分星期做，就点亮对应的星期。</div>' +
      '<div class="ba-quick"><span>全部设为</span>' +
      '<button class="btn ghost sm" data-action="base-all" data-days="0,1,2,3,4,5,6">每天</button>' +
      '<button class="btn ghost sm" data-action="base-all" data-days="1,2,3,4,5">周一到周五</button>' +
      '<button class="btn ghost sm" data-action="base-all" data-days="0,6">只周末</button></div>' +
      (S.baseEdit.length ? rows : '<div class="ba-empty">还没有基础任务，点下面的「添加一项」开始设置</div>') +
      '<div class="btn-row" style="margin-top:14px"><button class="btn ghost sm" data-action="base-add">' + ic('plus', 'sm') + '添加一项</button></div>' +
      '<div class="modal-foot"><button class="btn ghost" data-action="base-close">取消</button>' +
      '<button class="btn" data-action="base-save">' + ic('check', 'sm') + '保存</button></div></div>';
  }
  function openBaseEdit() {
    S.baseEdit = baseTasksOf().map(b => ({
      subject: b.subject || '语文', content: b.content || '',
      minutes: b.minutes || 20,
      days: Array.isArray(b.days) && b.days.length ? b.days.slice() : [0, 1, 2, 3, 4, 5, 6]
    }));
    if (!S.baseEdit.length) S.baseEdit = [{ subject: '语文', content: '', minutes: 20, days: [0, 1, 2, 3, 4, 5, 6] }];
    openModal(baseEditToHtml());
  }
  /* v51：关掉基础任务编辑弹窗。从设置进来的（S.baseBack）就回到设置页，
     并且保留设置里已输入、还没保存的内容；否则像普通弹窗一样直接关 */
  function closeBaseModal() {
    S.baseEdit = null;
    if (S.baseBack) { S.baseBack = false; S.keepDraft = true; H['open-settings'](); }
    else closeModal();
  }
  /* 把弹窗里正在编辑的内容收回 S.baseEdit（输入框可能还没触发过 input） */
  function collectBaseEdit() {
    if (!S.baseEdit) S.baseEdit = [];
    document.querySelectorAll('.ba-row').forEach(row => {
      const i = +row.dataset.row;
      const cur = S.baseEdit[i];
      if (!cur) return;
      const sub = row.querySelector('[data-ba="subject"]');
      const con = row.querySelector('[data-ba="content"]');
      const min = row.querySelector('[data-ba="minutes"]');
      if (sub) cur.subject = sub.value;
      if (con) cur.content = con.value;
      if (min) cur.minutes = Math.min(180, Math.max(1, parseInt(min.value, 10) || 20));
    });
  }
  function refreshBaseDays(i) {
    const row = document.querySelector('.ba-row[data-row="' + i + '"]');
    if (!row) return;
    const cur = S.baseEdit[i];
    if (!cur) return;
    const days = Array.isArray(cur.days) && cur.days.length ? cur.days : [0, 1, 2, 3, 4, 5, 6];
    row.querySelectorAll('.ba-day').forEach(btn => {
      btn.classList.toggle('on', days.indexOf(+btn.dataset.d) >= 0);
    });
    const hint = row.querySelector('.ba-hint');
    if (hint) hint.textContent = days.length === 7 ? '每天' : '点亮的星期才加';
  }

  function renderHome() {
    const list = tasks(today());
    const done = list.filter(t => t.done).length;
    const pct = list.length ? Math.round(done / list.length * 100) : 0;
    const checked = !!db.checkins[today()];
    const st = stats();
    const badgesHtml = D.badges.map(b => {
      const got = b.test(st);
      return '<div class="badge ' + (got ? 'got' : 'off') + '" title="' + esc(b.desc) + '">' +
        '<div class="b-ico">' + ic(got ? 'star' : 'target') + '</div><b>' + b.name + '</b><span>' + b.desc + '</span></div>';
    }).join('');

    const taskHtml = list.length ? list.map(t =>
      '<div class="task ' + (t.done ? 'done' : '') + '">' +
      '<button class="tick" data-action="toggle-task" data-id="' + t.id + '" aria-label="完成">' + ic('check') + '</button>' +
      '<div class="t-body"><div class="t-content">' + esc(t.content) + '</div>' +
      '<div class="t-meta"><span class="chip ' + subjectChip(t.subject) + '">' + esc(t.subject) + '</span><span>约 ' + t.minutes + ' 分钟</span></div></div>' +
      '<button class="t-del" data-action="del-task" data-id="' + t.id + '" aria-label="删除">' + ic('trash', 'sm') + '</button></div>'
    ).join('') : empty('今天还没有作业，从下面添加一条，或从常用作业里挑几项', 'list');

    const tmplHtml = D.taskTemplates.map((t, i) =>
      '<button class="tmpl" data-action="add-tmpl" data-i="' + i + '">+ ' + esc(t.subject + '：' + t.content) + '</button>').join('');

    return '' +
      '<div class="hero">' +
      '<div class="hero-txt"><div class="k">TODAY · 今日进度</div>' +
      '<h2>' + (checked ? '今天已经打卡啦，真棒' : done === list.length && list.length ? '全部完成，可以打卡了' : '把今天的小任务一件件完成') + '</h2>' +
      '<p>已完成 ' + done + ' / ' + list.length + ' 项 · ' + (checked ? '获得 ' + db.checkins[today()].stars + ' 颗星星' : '全部完成可拿 3 颗星星') + '</p></div>' +
      '<div class="hero-ring"><div class="ring" style="--p:' + pct + '%"><div class="ring-in"><b>' + pct + '%</b><span>完成度</span></div></div>' +
      '<button class="btn lg ' + (checked ? 'soft' : '') + '" data-action="checkin" ' + (checked ? 'disabled' : '') + '>' +
      ic(checked ? 'check' : 'star') + (checked ? '已打卡' : '完成打卡') + '</button></div></div>' +

      petCardHtml() +

      '<div class="grid home-grid" style="margin-top:18px">' +
      '<div class="card">' +
      '<div class="card-h">' + ic('list') + '<h2>今日作业清单</h2><span class="sub">' + (dstrLabel(today())) + '</span></div>' +
      '<div class="progress" style="margin-bottom:16px"><i style="width:' + pct + '%"></i></div>' +
      '<div class="task-list">' + taskHtml + '</div>' +
      '<div class="divider"></div>' +
      '<div class="section-title" style="margin-top:16px">添加一项作业</div>' +
      '<div class="form-row">' +
      '<div class="field narrow"><label>科目</label><select class="input" id="taskSubject"><option>语文</option><option>数学</option><option>英语</option><option>其他</option></select></div>' +
      '<div class="field"><label>作业内容</label><input class="input" id="taskContent" placeholder="例：完成练习册第 12 页" maxlength="60"></div>' +
      '<div class="field narrow"><label>分钟</label><input class="input" id="taskMinutes" type="number" min="1" max="180" value="20"></div>' +
      '<button class="btn" data-action="add-task">' + ic('plus', 'sm') + '添加</button></div>' +
      '<div class="section-title" style="margin-top:18px">常用作业 · 点一下就添加</div>' +
      '<div class="tmpl-list">' + tmplHtml + '</div>' +
      '</div>' +

      '<div style="display:flex;flex-direction:column;gap:18px">' +
      '<div class="card tight"><div class="card-h">' + ic('arrow') + '<h2>快速开始</h2></div><div class="quick">' +
      '<button class="quick-item" data-action="nav" data-tab="dict"><span class="q-ico p">' + ic('headphones') + '</span><span><b>英语听写</b><span>听发音、写单词，自动批改</span></span>' + ic('chev', 'sm') + '</button>' +
      '<button class="quick-item" data-action="nav" data-tab="math"><span class="q-ico m">' + ic('camera') + '</span><span><b>作业拍照检查</b><span>数学 / 语文 / 英语，拍一拍找错题</span></span>' + ic('chev', 'sm') + '</button>' +
      '<button class="quick-item" data-action="nav" data-tab="mistakes"><span class="q-ico c">' + ic('bulb') + '</span><span><b>错题讲解</b><span>' + db.mistakes.filter(m => !m.mastered).length + ' 道题等着一起弄懂</span></span>' + ic('chev', 'sm') + '</button>' +
      '<button class="quick-item" data-action="nav" data-tab="oral"><span class="q-ico b">' + ic('clock') + '</span><span><b>口算计时</b><span>每天 ' + (db.settings.oralCount || 5) + ' 道 · ' + (db.settings.oralMinutes || 8) + ' 分钟倒计时</span></span>' + ic('chev', 'sm') + '</button>' +
      '<button class="quick-item" data-action="open-install"><span class="q-ico p">' + ic('download') + '</span><span><b>' + (isStandalone() ? '已装到主屏幕' : '装到 iPad 主屏幕') + '</b><span>' + (isStandalone() ? '正在以独立应用模式运行' : '有图标、全屏、可离线，像真 App 一样') + '</span></span>' + ic('chev', 'sm') + '</button>' +
      '</div></div>' +

      '<div class="card tight"><div class="card-h">' + ic('calendar') + '<h2>打卡日历</h2>' +
      '<button class="btn ghost sm" data-action="cal-prev">上月</button><button class="btn ghost sm" data-action="cal-next">下月</button></div>' +
      '<div class="section-title">' + S.cal.y + ' 年 ' + (S.cal.m + 1) + ' 月</div>' +
      '<div class="calendar">' + calendarHtml() + '</div>' +
      '<div class="legend"><span><i style="background:var(--mint)"></i>全部完成</span><span><i style="background:var(--mint-soft)"></i>大部分完成</span><span><i style="background:var(--sun-soft)"></i>部分完成</span></div>' +
      '</div>' +

      '<div class="card tight"><div class="card-h">' + ic('star') + '<h2>成就徽章</h2><span class="sub">' + D.badges.filter(b => b.test(st)).length + ' / ' + D.badges.length + '</span></div>' +
      '<div class="badge-grid">' + badgesHtml + '</div></div>' +
      '</div></div>';
  }
  function subjectChip(s) { return { '语文': 'c', '数学': 'b', '英语': 'p', '其他': 'm' }[s] || ''; }
  function dstrLabel(s) { const d = new Date(s + 'T12:00:00'); return (d.getMonth() + 1) + '月' + d.getDate() + '日 星期' + weekNames[d.getDay()]; }

  /* ---------------- 辟邪宠物 ---------------- */
  const PET_CLICKS = [
    '啾！我最喜欢看你认真写字的样子～',
    '写累了就伸个懒腰，我在这儿等你～',
    '每天一小步，攒起来就是一大步！',
    '错题不可怕，弄懂它就变厉害啦～',
    '今天的星星，我帮你一颗颗数着呢！',
    '慢慢来，写得稳比写得快更厉害～'
  ];
  function petLine() {
    const list = tasks(today());
    const done = list.filter(t => t.done).length;
    const got = db.checkins[today()] ? db.checkins[today()].stars : 0;
    if (db.checkins[today()]) return '今天收了 <b>' + got + '</b> 颗星星，天禄开心得转圈圈！明天也一起加油～';
    if (!list.length) return '今天还没安排作业呢，点下面加一条，我陪你一件件做完～';
    if (done === list.length) return '全部完成啦！快去点「完成打卡」，我们一起收星星～';
    return '已完成 <b>' + done + ' / ' + list.length + '</b> 项，还剩 ' + (list.length - done) + ' 项，我在旁边给你加油！';
  }
  /* 点辟邪时说的「可爱语音」。文字和语音一对一定义，保证听到的和看到的一致。
     用轻声词、语气词和叠词，配合 webkit 的高音调，听起来像小朋友撒娇。 */
  /* 天禄的鼓励语：与 audio/pet/ 下预录的 12 句一一对应（三种可爱声线）。
     text 是气泡里显示的文字，say 是音频加载失败时给系统朗读用的纯文本。 */
  const PET_VOICES = [
    { text: '啾～我最喜欢看你认真写字的样子啦', say: '啾，我最喜欢看你认真写字的样子啦' },
    { text: '写累了就伸个懒腰吧，我在这儿等你哟', say: '写累了就伸个懒腰吧，我在这儿等你哟' },
    { text: '每天一小步，攒起来就是一大步呀', say: '每天一小步，攒起来就是一大步呀' },
    { text: '错题一点都不可怕，弄懂它就更厉害啦', say: '错题一点都不可怕，弄懂它就更厉害啦' },
    { text: '今天的星星，我一颗一颗帮你数着呢', say: '今天的星星，我一颗一颗帮你数着呢' },
    { text: '慢慢来，写得稳比写得快更厉害哟', say: '慢慢来，写得稳比写得快更厉害哟' },
    { text: '你写字的时候，我一直在旁边悄悄给你加油', say: '你写字的时候，我一直在旁边悄悄给你加油' },
    { text: '啾啾～休息一下，喝口水再继续吧', say: '啾啾，休息一下，喝口水再继续吧' },
    { text: '写完这一项，我们就一起数星星，好不好', say: '写完这一项，我们就一起数星星，好不好' },
    { text: '你今天也很努力，天禄都看见啦', say: '你今天也很努力，天禄都看见啦' },
    { text: '哇～这道题你写得又快又稳，好厉害呀', say: '哇，这道题你写得又快又稳，好厉害呀' },
    { text: '啾啾～伸个大懒腰，我们再出发', say: '啾啾，把手举高伸个大懒腰，我们再出发' }
  ];
  const PET_STYLES = [
    { id: 'sweet', name: '甜甜', desc: '温柔小姐姐' },
    { id: 'soft', name: '软软', desc: '轻声慢语' },
    { id: 'boy', name: '少年', desc: '活泼小男孩' },
    { id: 'nai', name: '奶糖', desc: '俏皮小奶音' },
    { id: 'sun', name: '阳光', desc: '清朗大哥哥' },
    { id: 'story', name: '故事', desc: '睡前讲故事' }
  ];
  /* 预录人声播放引擎：和单词发音一样走 Web Audio 解码，
     iPad 上不受系统朗读音色影响，断网也能播。 */
  const PetVoice = (function () {
    const buffers = {}, pending = {};
    let cur = null;
    function load(key) {
      if (buffers[key]) return Promise.resolve(buffers[key]);
      if (pending[key]) return pending[key];
      const c = AudioSys.get();
      if (!c) return Promise.reject(new Error('no-audiocontext'));
      pending[key] = fetch('audio/pet/' + key + '.mp3')
        .then(r => { if (!r.ok) throw new Error('http-' + r.status); return r.arrayBuffer(); })
        .then(ab => new Promise((resolve, reject) => {
          let settled = false;
          const done = buf => { if (settled) return; settled = true; buffers[key] = buf; delete pending[key]; resolve(buf); };
          const fail = err => { if (settled) return; settled = true; delete pending[key]; reject(err); };
          try {
            const ret = c.decodeAudioData(ab, done, fail);
            if (ret && ret.then) ret.then(done, fail);
          } catch (e) { fail(e); }
        }))
        .catch(e => { delete pending[key]; throw e; });
      return pending[key];
    }
    function stop() {
      if (cur) { try { cur.onended = null; cur.stop(); } catch (e) { } cur = null; }
    }
    function play(style, idx) {
      const c = AudioSys.get();
      if (!c) return Promise.reject(new Error('no-audiocontext'));
      stop();
      const key = style + '_' + String(idx).padStart(2, '0');
      return load(key).then(buf => new Promise((resolve, reject) => {
        try {
          const src = c.createBufferSource(), g = c.createGain();
          g.gain.value = 1; src.buffer = buf;
          src.connect(g); g.connect(c.destination);
          src.onended = () => { if (cur === src) cur = null; resolve(); };
          cur = src;
          src.start(0);
        } catch (e) { reject(e); }
      }));
    }
    return { play: play, stop: stop };
  })();
  function petStyle() {
    const v = db.settings.petVoiceStyle;
    return PET_STYLES.some(x => x.id === v) ? v : 'sweet';
  }

  /* 天禄说话：优先播预录的可爱人声，加载不到才回退系统朗读 */
  let petSpeaking = false;
  function fallbackPetTTS(text, onDone) {
    if (!('speechSynthesis' in window)) return false;
    try {
      const v = pickMandarinVoice();
      const u = new SpeechSynthesisUtterance(speakableText(text));
      u.lang = 'zh-CN'; u.rate = 0.94; u.pitch = 1.35; u.volume = 1;
      if (v) { try { u.voice = v; } catch (e) { } }
      u.onend = () => { petSpeaking = false; if (onDone) { try { onDone(); } catch (e) { } } };
      u.onerror = () => { petSpeaking = false; if (onDone) { try { onDone(); } catch (e) { } } };
      window.speechSynthesis.speak(u);
      return true;
    } catch (e) { petSpeaking = false; return false; }
  }
  function speakPet(idx, text, onDone) {
    // 先掐断正在播的其它语音（讲解 / 上一句鼓励），并清掉它留下的按钮状态
    stopChinese();
    PetVoice.stop();
    S.mk.speakingId = null;
    clearTimeout(zhGapTimer);
    petSpeaking = true;
    AudioSys.wake();
    const finish = () => { petSpeaking = false; if (onDone) { try { onDone(); } catch (e) { } } };
    PetVoice.play(petStyle(), idx).then(finish).catch(() => {
      try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { }
      if (!fallbackPetTTS(text, onDone)) finish();
    });
    return true;
  }
  /* v26：宠物形象可自定义。首页用小图（avatar），小窝用大图（pic），
     只传了一张就两张都用它；都没传就用内置的天禄。 */
  function petPic() { return db.pet.pic || db.pet.avatar || 'icons/pipi-lg.png?v=35'; }
  /* v15：天禄改为静态头像（pipi-lg.png），点击仍会说话 */
  function petCardHtml() {
    return '<div class="pet-card" data-action="pet-pat" role="button" aria-label="点一点天禄，听它给你加油">' +
      '<div class="pet-avatar"><img class="' + (db.pet.avatar ? 'custom' : '') + '" src="' +
      esc(db.pet.avatar || 'icons/pipi-lg.png?v=35') + '" alt="天禄"></div>' +
      '<div class="pet-bubble"><div class="pet-name">' + ic('sparkles', 'sm') + ' 天禄 · 你的学习搭子' +
      '<span class="pet-hint">点我说话</span></div>' +
      '<div id="petLine">' + petLine() + '</div></div></div>';
  }
/* ---------------- 视图 2：英语听写 ---------------- */
  function bookUnits() {
    const g = gradeNo(), t = termNo(), b = db.settings.book || 'wy2024';
    return D.wordUnits.filter(u => (u.book || 'wy2024') === b && (u.grade || 5) === g && (u.term || 1) === t);
  }
  function allUnits() {
    const custom = db.customWords.length ? [{ id: 'custom', name: '我的词库', words: db.customWords }] : [];
    return bookUnits().concat(custom);
  }
  /* v43：听写自带的字母键盘。iPad 上不弹系统键盘，题目和输入框不会被顶出屏幕。
     不想要的话底下有「换成系统键盘」，随时可以换回来。 */
  const KB_ROWS = [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm']
  ];
  function dictKeyboardHtml() {
    return '<div class="kb">' +
      KB_ROWS.map((row, i) =>
        '<div class="kb-row' + (i === 1 ? ' kb-indent' : '') + '">' +
        (i === 2 ? '<button class="kb-key kb-del" data-action="dict-key" data-k="del" aria-label="删除一个字母">⌫</button>' : '') +
        row.map(k => '<button class="kb-key" data-action="dict-key" data-k="' + k + '">' + k + '</button>').join('') +
        (i === 2 ? '<button class="kb-key kb-del" data-action="dict-key" data-k="clear" aria-label="全部清空">清空</button>' : '') +
        '</div>').join('') +
      '<div class="kb-row"><button class="kb-key kb-space" data-action="dict-key" data-k="space">空格</button>' +
      '<button class="kb-key kb-go" data-action="dict-submit">提交</button></div>' +
      '</div>';
  }
  function renderDict() {
    const D2 = S.dict;
    let body = '';
    if (D2.stage === 'setup') {
      const units = allUnits().map(u =>
        '<button class="unit-card ' + (D2.units.indexOf(u.id) >= 0 ? 'sel' : '') + '" data-action="dict-unit" data-id="' + u.id + '">' +
        '<b>' + esc(u.name) + '</b><span>' + esc(u.words.slice(0, 3).map(w => w.w).join(' / ')) + ' …</span>' +
        '<span class="wc">' + u.words.length + ' 个单词</span></button>').join('');
      const count = allUnits().filter(u => D2.units.indexOf(u.id) >= 0).reduce((n, u) => n + u.words.length, 0);
      body =
        '<div class="card"><div class="card-h">' + ic('headphones') + '<h2>第一步 · 选听写范围</h2><span class="sub">' + esc(bookLabel()) + '</span></div>' +
        (bookUnits().length ? '' :
          '<div class="card tight" style="background:#fff9ec;border:1px dashed #f0dfb8;margin-bottom:14px">' +
          '<div class="tiny muted" style="line-height:1.9">「' + esc(bookLabel()) + '」的内置词库还没有。<br>点下面的「自定义词库」，把课本单词表粘进来就能听写（格式：<b>单词,中文,记忆提示</b>，每行一个）；也可以在设置里切回<b>外研社 · 五年级上册</b>用内置词库。</div></div>') +
        '<div class="unit-grid">' + units + '</div>' +
        '<div class="divider"></div>' +
        '<div class="form-row">' +
        '<div class="field"><label>朗读语速（' + D2.rate.toFixed(2) + ' 倍）· 听不清可以调慢</label>' +
        '<input type="range" min="0.5" max="1.2" step="0.05" value="' + D2.rate + '" data-model="dict.rate" style="width:100%;accent-color:var(--primary)"></div>' +
        '<div class="field narrow"><label>显示中文提示</label><select class="input" data-model="dict.showZh"><option value="1"' + (D2.showZh ? ' selected' : '') + '>显示</option><option value="0"' + (!D2.showZh ? ' selected' : '') + '>不显示（挑战）</option></select></div>' +
        '</div>' +
        '<div class="btn-row" style="margin-top:18px;justify-content:space-between;flex-wrap:wrap;gap:8px">' +
        '<div class="btn-row" style="gap:8px;flex-wrap:wrap">' +
        '<button class="btn ghost" data-action="open-custom-words">' + ic('edit', 'sm') + '自定义词库</button>' +
        '<button class="btn ghost" data-action="dict-photo">' + ic('camera', 'sm') + '拍照导入单词表</button>' +
        '</div>' +
        '<button class="btn lg" data-action="dict-start" ' + (count ? '' : 'disabled') + '>' + ic('play', 'sm') + '开始听写（' + count + ' 词）</button>' +
        '</div></div>' +
        '<div class="card tight" style="margin-top:18px"><div class="card-h">' + ic('bulb') + '<h2>怎么使用</h2>' +
        voiceChipHtml() + '</div>' +
        '<div class="tiny muted">家长不用在旁边念：点播放会朗读英文单词，孩子把听到的单词拼写在输入框里，提交后自动批改。写错的词会自动收进错题本，并给出拼写拆解和记忆小窍门。支持重听、跳过、首字母提示、每个词读两遍。</div></div>';
    } else if (D2.stage === 'run') {
      const cur = D2.queue[D2.idx];
      const hintHtml = D2.hint ? '<div class="hint-box">' + esc(cur.w[0]) + ' _ '.repeat(Math.max(0, cur.w.replace(/ /g, '').length - 1)) + '（' + cur.w.replace(/ /g, '').length + ' 个字母）</div>' +
        '<div class="tiny muted">' + esc(cur.tip || '') + '</div>' : '';
      const fb = D2.checked ?
        (D2.lastOK ? '<div class="fb-ok">写对了，很棒</div>' :
          '<div class="fb-no">差一点点</div><div class="fb-answer">正确拼写：<b>' + esc(cur.w) + '</b> · ' + esc(cur.zh) + '<br><span class="muted tiny">' + esc(cur.tip || '') + '</span></div>') : '';
      const kbOn = db.settings.dictKeyboard !== false;
      const kbHtml = D2.checked ? '' :
        (kbOn ? dictKeyboardHtml() : '') +
        '<div class="kb-switch"><button data-action="dict-kb-toggle">' +
        (kbOn ? '换成系统键盘' : '换成字母键盘') + '</button></div>';
      body =
        '<div class="card"><div class="card-h">' + ic('volume') + '<h2>听写进行中</h2><span class="sub">第 ' + (D2.idx + 1) + ' / ' + D2.queue.length + ' 个</span>' +
        '<button class="btn ghost sm" data-action="dict-back">结束</button></div>' +
        '<div class="progress mint" style="margin-bottom:6px"><i style="width:' + Math.round(D2.idx / D2.queue.length * 100) + '%"></i></div>' +
        '<div class="dict-stage"><div class="dict-count">WORD ' + (D2.idx + 1) + ' / ' + D2.queue.length + '</div>' +
        '<div class="dict-zh">' + (D2.showZh ? esc(cur.zh) : '<span class="muted" style="font-size:16px">仔细听发音</span>') + '</div>' +
        '<div class="dict-tip">' + (D2.showZh ? '听发音，写出英文单词' : '') + '</div>' +
        '<button class="play-btn" data-action="dict-play" aria-label="播放读音">' + ic('play') + '</button>' +
        '<div style="margin:6px 0 10px">' + voiceChipHtml() + '</div>' +
        '<div class="tiny muted">点喇叭可以反复听</div>' + hintHtml +
        '<input class="spell-input ' + (D2.checked ? (D2.lastOK ? 'right' : 'wrong') : '') + '" data-model="dict.input" ' +
        'value="' + esc(D2.input) + '" placeholder="在这里拼写" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" ' +
        (D2.checked ? 'disabled' : (kbOn ? 'readonly inputmode="none"' : '')) + '>' +
        '<div class="dict-feedback">' + fb + '</div>' +
        kbHtml +
        '<div class="dict-actions">' +
        (D2.checked
          ? '<button class="btn lg mint" data-action="dict-next">' + (D2.idx + 1 >= D2.queue.length ? '查看结果' : '下一个') + ic('arrow', 'sm') + '</button>'
          : '<button class="btn" data-action="dict-submit">' + ic('check', 'sm') + '提交</button>' +
            '<button class="btn ghost" data-action="dict-hint">' + ic('bulb', 'sm') + '提示</button>' +
            '<button class="btn ghost" data-action="dict-skip">跳过</button>') +
        '</div></div></div>';
    } else {
      const right = D2.answers.filter(a => a.ok).length;
      const pct = D2.answers.length ? Math.round(right / D2.answers.length * 100) : 0;
      const rows = D2.answers.map(a =>
        '<div class="result-item ' + (a.ok ? 'ok' : 'no') + '">' + ic(a.ok ? 'check' : 'x') +
        '<span><b>' + esc(a.w) + '</b> · ' + esc(a.zh) + '</span><em>' + (a.ok ? '正确' : '写成 ' + (esc(a.mine) || '（跳过）')) + '</em></div>').join('');
      body = '<div class="card" style="text-align:center">' +
        '<div class="card-h" style="justify-content:center">' + ic('chart') + '<h2>听写完成</h2></div>' +
        '<div class="result-ring" style="--p:' + pct + '%"><div class="in"><div><b>' + pct + '%</b><span>' + right + ' / ' + D2.answers.length + ' 正确</span></div></div></div>' +
        '<div class="btn-row" style="justify-content:center">' +
        '<button class="btn" data-action="dict-restart">' + ic('refresh', 'sm') + '再听写一次</button>' +
        '<button class="btn ghost" data-action="dict-back">换个单元</button>' +
        (D2.answers.some(a => !a.ok) ? '<button class="btn coral" data-action="nav" data-tab="mistakes">' + ic('bulb', 'sm') + '去看错词讲解</button>' : '') +
        '</div><div class="result-list">' + rows + '</div></div>';
    }
    return '<div class="tabs"><button class="tab active">' + (S.dict.stage === 'setup' ? '选择范围' : S.dict.stage === 'run' ? '正在听写' : '本次结果') + '</button></div>' + body;
  }

  /* ---------------- 视图 3：数学检查 ---------------- */
  const SUBJECTS = ['数学', '语文', '英语'];
  function subjectChips(action, cur) {
    return '<div class="subject-row">' + SUBJECTS.map(s =>
      '<button class="subject-chip ' + (cur === s ? 'active' : '') + '" data-action="' + action + '" data-s="' + s + '">' + s + '</button>').join('') + '</div>';
  }
  function subjectTip(s) {
    if (s === '数学') return '算式会自动算出正确答案；应用题、单位、分数也能判。识别错的数字可以直接改。';
    if (s === '语文') return '字词、造句、默写都能检查。认出来的每一行是一道，请补上「我的答案」和「正确答案」，错的字会进错题本，用普通话讲给你听。';
    return '单词、短语、句子都能检查。补上「我的答案」和「正确答案」，错题会进错题本，还能点「听读音」跟读真人发音。';
  }
  function renderMath() {
    const M = S.math;
    const tabs = '<div class="tabs">' +
      '<button class="tab ' + (M.tab === 'photo' ? 'active' : '') + '" data-action="math-tab" data-tab="photo">拍照检查</button>' +
      '<button class="tab ' + (M.tab === 'check' ? 'active' : '') + '" data-action="math-tab" data-tab="check">手动录入批改</button>' +
      '<button class="tab ' + (M.tab === 'practice' ? 'active' : '') + '" data-action="math-tab" data-tab="practice">知识点练习</button></div>';
    return tabs + (M.tab === 'photo' ? photoCheckHtml() : M.tab === 'check' ? mathCheckHtml() : mathPracticeHtml());
  }
  function photoCheckHtml() {
    const s = S.math.subject || '数学';
    return '<div class="card"><div class="card-h">' + ic('camera') + '<h2>作业拍照检查</h2><span class="sub">数学 / 语文 / 英语，三科都能拍</span></div>' +
      '<div class="section-title">先选今天要检查的科目</div>' + subjectChips('math-subject', s) +
      '<div class="subject-tip">' + subjectTip(s) + '</div>' +
      '<div class="photo-steps">' +
      '<div class="photo-step"><b>1</b><span>拍下写好的作业，或从相册选一张照片</span></div>' +
      '<div class="photo-step"><b>2</b><span>自动识别成一行一道题，认错的字直接改</span></div>' +
      '<div class="photo-step"><b>3</b><span>核对答案 → 一键批改 → 错题自动进错题本并讲一讲</span></div></div>' +
      '<div class="btn-row" style="margin-top:18px">' +
      '<button class="btn lg" data-action="photo-open">' + ic('camera', 'sm') + '拍照 / 选择照片</button>' +
      '<button class="btn ghost" data-action="math-tab" data-tab="check">' + ic('edit', 'sm') + '不想拍照？手动录入</button></div>' +
      '<div class="tiny muted" style="margin-top:16px;line-height:1.9">识别需要联网，作业照片会发送到免费 OCR 服务（ocr.space）读取文字，<b>本应用不保存照片</b>。不想上传照片就点「手动录入」，批改和讲解效果一样。语文、英语靠家长核对正确答案，数学算式会自动算答案。</div></div>';
  }
  function mathCheckHtml() {
    const M = S.math;
    const sub = M.subject || '数学';
    if (M.judge) {
      const right = M.judge.filter(r => r.ok).length;
      const rows = M.judge.map(r =>
        '<div class="judge-item"><div class="judge-mark ' + (r.ok ? 'ok' : 'no') + '">' + ic(r.ok ? 'check' : 'x') + '</div>' +
        '<div class="judge-body"><div class="q">' + esc(r.q) + '</div>' +
        '<div class="ans">你的答案 <b>' + (esc(r.mine) || '（空）') + '</b> · 正确答案 <b>' + esc(r.correct) + '</b>' +
        (r.ok ? '' : ' · 已加入错题本') + '</div></div></div>').join('');
      return '<div class="card"><div class="card-h">' + ic('check') + '<h2>批改结果</h2><span class="sub">' + esc(sub) + ' · ' + right + ' / ' + M.judge.length + ' 正确</span></div>' +
        '<div class="progress mint" style="margin-bottom:16px"><i style="width:' + (M.judge.length ? Math.round(right / M.judge.length * 100) : 0) + '%"></i></div>' +
        rows + '<div class="btn-row" style="margin-top:18px">' +
        '<button class="btn" data-action="math-judge-back">' + ic('edit', 'sm') + '返回修改</button>' +
        (M.judge.some(r => !r.ok) ? '<button class="btn coral" data-action="nav" data-tab="mistakes">' + ic('bulb', 'sm') + '看错题讲解</button>' : '') +
        '</div></div>';
    }
    const rows = M.rows.map((r, i) =>
      '<div class="check-row">' +
      '<input class="input" data-row="' + i + '" data-field="q" value="' + esc(r.q) + '" placeholder="题目，如 0.8 × 0.7 = ?">' +
      '<input class="input" data-row="' + i + '" data-field="mine" value="' + esc(r.mine) + '" placeholder="我的答案">' +
      '<input class="input correct-in" data-row="' + i + '" data-field="correct" value="' + esc(r.correct) + '" placeholder="正确答案">' +
      '<button class="del" data-action="math-del-row" data-i="' + i + '" aria-label="删除">' + ic('trash', 'sm') + '</button></div>').join('');
    return '<div class="card"><div class="card-h">' + ic('edit') + '<h2>核对答案并批改</h2><span class="sub">' + esc(sub) + ' · 逐题判断对错</span></div>' +
      '<div class="section-title">科目</div>' + subjectChips('math-subject', sub) +
      '<div class="subject-tip">' + subjectTip(sub) + '</div>' +
      '<div class="tiny muted" style="margin-bottom:14px">每行一道：填「题目 / 我的答案 / 正确答案」。支持小数、分数（如 5/6）、带单位数字（如 24cm²）和文字答案。判错的题会自动进错题本，并按科目给出讲解。</div>' +
      '<div class="check-head"><span>题目</span><span>我的答案</span><span class="correct-col">正确答案</span><span></span></div>' +
      (M.rows.length ? rows : empty('还没有录入题目，可以「载入示例」、批量粘贴，或拍照识别', 'camera')) +
      '<div class="btn-row" style="margin-top:14px">' +
      '<button class="btn ghost sm" data-action="math-add-row">' + ic('plus', 'sm') + '加一行</button>' +
      '<button class="btn ghost sm" data-action="math-load-sample">载入示例</button>' +
      '<button class="btn ghost sm" data-action="math-batch">' + ic('edit', 'sm') + '批量粘贴</button>' +
      '<button class="btn ghost sm" data-action="photo-open">' + ic('camera', 'sm') + '拍照检查</button>' +
      '<button class="btn mint" data-action="math-judge" ' + (M.rows.length ? '' : 'disabled') + '>' + ic('check', 'sm') + '开始检查</button>' +
      '</div></div>';
  }
  function mathPracticeHtml() {
    const Q = S.math.quiz;
    const tagBtns = '<button class="tag-btn ' + (S.math.tag === 'all' ? 'active' : '') + '" data-action="math-tag" data-tag="all">全部知识点</button>' +
      Object.keys(D.tagNames).map(k => '<button class="tag-btn ' + (S.math.tag === k ? 'active' : '') + '" data-action="math-tag" data-tag="' + k + '">' + D.tagNames[k] + '</button>').join('');
    if (!Q.ids.length) {
      const pool = mathPool();
      return '<div class="card"><div class="card-h">' + ic('target') + '<h2>知识点练习</h2><span class="sub">从题库抽题，做完立刻批改</span></div>' +
        '<div class="section-title">选一个知识点（不选就是综合练习）</div><div class="tag-row">' + tagBtns + '</div>' +
        '<div class="divider"></div>' +
        '<div class="tiny muted">' + (mathGrade() === 5
          ? '题库共 ' + D.mathBank.length + ' 道五年级典型题，当前可练 ' + pool.length + ' 道。'
          : '内置精讲题库以五年级为主；当前按 <b>' + gradeName(mathGrade()) + '</b> 出计算专项，练的是本年级该会的运算。') +
          '每次 5 题，答完自动批改，错题会带着分步讲解进错题本。</div>' +
        '<div style="margin-top:16px"><button class="btn lg" data-action="math-quiz-start">' + ic('play', 'sm') + '开始练习（5 题）</button></div></div>';
    }
    if (Q.idx >= Q.ids.length) {
      const right = Q.answers.filter(a => a.ok).length;
      const pct = Math.round(right / Q.answers.length * 100);
      const rows = Q.answers.map(a =>
        '<div class="result-item ' + (a.ok ? 'ok' : 'no') + '">' + ic(a.ok ? 'check' : 'x') +
        '<span>' + esc(a.q) + '</span><em>' + (a.ok ? '正确' : '正确答案 ' + esc(a.correct)) + '</em></div>').join('');
      return '<div class="card" style="text-align:center"><div class="card-h" style="justify-content:center">' + ic('chart') + '<h2>练习完成</h2></div>' +
        '<div class="result-ring" style="--p:' + pct + '%"><div class="in"><div><b>' + pct + '%</b><span>' + right + ' / ' + Q.answers.length + ' 正确</span></div></div></div>' +
        '<div class="btn-row" style="justify-content:center">' +
        '<button class="btn" data-action="math-quiz-restart">' + ic('refresh', 'sm') + '再来一组</button>' +
        '<button class="btn ghost" data-action="math-quiz-back">换知识点</button>' +
        (Q.answers.some(a => !a.ok) ? '<button class="btn coral" data-action="nav" data-tab="mistakes">' + ic('bulb', 'sm') + '看错题讲解</button>' : '') +
        '</div><div class="result-list">' + rows + '</div></div>';
    }
    const item = quizFind(Q.ids[Q.idx]);
    const fb = Q.checked ? (Q.lastOK ? '<div class="fb-ok" style="margin-top:10px">答对了，继续保持</div>' :
      '<div class="fb-no" style="margin-top:10px">再看看思路</div><div class="fb-answer">正确答案：<b>' + esc(item.a) + '</b>' +
      (item.solution ? '<br>' + esc(item.solution.join(' → ')) : '') + '</div>') : '';
    return '<div class="card"><div class="card-h">' + ic('calc') + '<h2>第 ' + (Q.idx + 1) + ' / ' + Q.ids.length + ' 题</h2>' +
      '<span class="chip p">' + (D.tagNames[item.tag] || '计算专项') + '</span><button class="btn ghost sm" data-action="math-quiz-back" style="margin-left:auto">结束</button></div>' +
      '<div class="progress" style="margin-bottom:20px"><i style="width:' + Math.round(Q.idx / Q.ids.length * 100) + '%"></i></div>' +
      '<div class="quiz-q">' + esc(item.q) + '</div>' +
      '<div class="opt-input"><input class="input ' + (Q.checked ? (Q.lastOK ? 'right' : 'wrong') : '') + '" data-model="quiz.input" value="' + esc(Q.input) + '" placeholder="填写答案" ' + (Q.checked ? 'disabled' : '') + ' autocomplete="off">' +
      (Q.checked
        ? '<button class="btn lg mint" data-action="math-quiz-next">' + (Q.idx + 1 >= Q.ids.length ? '查看结果' : '下一题') + ic('arrow', 'sm') + '</button>'
        : '<button class="btn lg" data-action="math-quiz-submit">' + ic('check', 'sm') + '提交</button>') +
      '</div>' + fb + '</div>';
  }

  /* 数学练习：按年级取题库；该年级题不够时用计算专项补齐 */
  function mathPool() {
    const g = mathGrade();
    let pool = D.mathBank.filter(x => (x.grade || 5) === g);
    if (S.math.tag !== 'all') pool = pool.filter(x => x.tag === S.math.tag);
    return pool;
  }
  function genMath(n, g) {
    return makeOral(n, g).map((x, i) => ({
      id: 'gen-' + Date.now().toString(36) + '-' + i,
      grade: g, tag: 'calc', q: x.q, a: x.a, type: x.type,
      solution: x.type === 'frac'
        ? ['分母不变，只把分子相加减', '结果能约分要约成最简分数', '代回原式检查一遍']
        : ['先看清运算顺序，有括号先算括号里的', '按顺序一步一步算，注意进位、退位和小数点', '算完代回原式验算一次']
    }));
  }
  function quizFind(id) {
    return D.mathBank.find(x => x.id === id) || (S.math.gen || []).find(x => x.id === id);
  }

  /* ---------------- 视图 4：口算计时练习 ---------------- */
  function calcExpr(s) {
    const t = String(s).replace(/×|x|X/g, '*').replace(/÷/g, '/').replace(/−|—/g, '-').replace(/\s/g, '');
    if (!t || !/^[\d.+\-*/()]+$/.test(t)) return null;
    try { const v = Function('"use strict";return (' + t + ')')(); return isFinite(v) ? Math.round(v * 1000) / 1000 : null; }
    catch (e) { return null; }
  }
  const fmtNum = v => String(Number(v.toFixed(2)));
  function fmtTime(ms) { const s = Math.max(0, Math.floor(ms / 1000)); return pad(Math.floor(s / 60)) + ':' + pad(s % 60); }
  function oralCount() { return Math.min(30, Math.max(1, parseInt(db.settings.oralCount, 10) || 5)); }
  function oralMinutes() { return Math.min(60, Math.max(1, parseInt(db.settings.oralMinutes, 10) || 8)); }
  function oralLimitMs() { return oralMinutes() * 60000; }
  /* 按年级出题（g = 1..6，由「设置 → 学习难度」决定） */
  function makeOral(n, g) {
    const r = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
    g = Math.min(6, Math.max(1, g || mathGrade()));
    const list = [];
    for (let i = 0; i < n; i++) {
      const t = r(1, 10);
      let q, a, type = 'num';
      if (g === 1) {                       /* 一年级：20 以内加减 */
        if (t <= 6) { const x = r(1, 9), y = r(1, 9); q = x + ' + ' + y + ' ='; a = x + y; }
        else { const x = r(6, 20), y = r(1, 5); q = x + ' - ' + y + ' ='; a = x - y; }
      } else if (g === 2) {                /* 二年级：100 以内加减 + 乘法口诀 */
        if (t <= 4) { const x = r(10, 80), y = r(5, 19); q = x + ' + ' + y + ' ='; a = x + y; }
        else if (t <= 7) { const x = r(20, 99), y = r(5, 19); q = x + ' - ' + y + ' ='; a = x - y; }
        else { const x = r(2, 9), y = r(2, 9); q = x + ' × ' + y + ' ='; a = x * y; }
      } else if (g === 3) {                /* 三年级：三位数加减、两位数乘一位、整除 */
        if (t <= 3) { const x = r(120, 900), y = r(20, 99); q = x + ' + ' + y + ' ='; a = x + y; }
        else if (t <= 5) { const x = r(200, 900), y = r(20, 99); q = x + ' - ' + y + ' ='; a = x - y; }
        else if (t <= 8) { const x = r(12, 99), y = r(2, 9); q = x + ' × ' + y + ' ='; a = x * y; }
        else { const y = r(2, 9), z = r(11, 90); q = (y * z) + ' ÷ ' + y + ' ='; a = z; }
      } else if (g === 4) {                /* 四年级：四位数加减、两位数乘两位数、小数加减 */
        if (t <= 2) { const x = r(1000, 8000), y = r(100, 900); q = x + ' + ' + y + ' ='; a = x + y; }
        else if (t <= 4) { const x = r(11, 99), y = r(11, 99); q = x + ' × ' + y + ' ='; a = x * y; }
        else if (t <= 6) { const y = r(12, 25), z = r(3, 30); q = (y * z) + ' ÷ ' + y + ' ='; a = z; }
        else if (t <= 8) { const x = r(15, 89) / 10, y = r(11, 89) / 10; q = fmtNum(x) + ' + ' + fmtNum(y) + ' ='; a = fmtNum(x + y); }
        else { const x = r(45, 99) / 10, y = r(11, 44) / 10; q = fmtNum(x) + ' - ' + fmtNum(y) + ' ='; a = fmtNum(x - y); }
      } else if (g === 5) {                /* 五年级：小数乘除、简易方程、同分母分数 */
        if (t === 1) { const x = r(120, 900), y = r(20, 300); q = Math.random() < .5 ? x + ' + ' + y + ' =' : x + ' - ' + y + ' ='; a = calcExpr(q.slice(0, -1)); }
        else if (t === 2) { const x = r(12, 99), y = r(2, 9); q = x + ' × ' + y + ' ='; a = x * y; }
        else if (t === 3) { const y = r(2, 9), z = r(8, 60); q = (y * z) + ' ÷ ' + y + ' ='; a = z; }
        else if (t === 4) { const x = r(11, 89) / 10, y = r(11, 89) / 10; q = fmtNum(x) + ' + ' + fmtNum(y) + ' ='; a = fmtNum(x + y); }
        else if (t === 5) { const x = r(45, 99) / 10, y = r(11, 44) / 10; q = fmtNum(x) + ' - ' + fmtNum(y) + ' ='; a = fmtNum(x - y); }
        else if (t === 6) { const x = r(11, 49) / 10, y = r(2, 9); q = fmtNum(x) + ' × ' + y + ' ='; a = fmtNum(x * y); }
        else if (t === 7) {
          const x = r(6, 60), b = r(10, 90);
          if (Math.random() < .5) { q = 'x + ' + x + ' = ' + (x + b) + '，x ='; a = b; }
          else { q = 'x - ' + x + ' = ' + b + '，x ='; a = x + b; }
        } else {
          const d = r(5, 12), p = r(1, d - 1);
          if (Math.random() < .5) { const q2 = r(1, Math.max(1, d - p - 1)); q = p + '/' + d + ' + ' + q2 + '/' + d + ' ='; a = (p + q2) + '/' + d; }
          else if (p > 1) { const s2 = r(1, p - 1); q = p + '/' + d + ' - ' + s2 + '/' + d + ' ='; a = (p - s2) + '/' + d; }
          else { q = '1/' + d + ' + 1/' + d + ' ='; a = '2/' + d; }
          type = 'frac';
        }
      } else {                             /* 六年级：小数乘、百分数、分数乘整数 */
        if (t <= 3) { const x = r(11, 89) / 10, y = r(2, 9); q = fmtNum(x) + ' × ' + y + ' ='; a = fmtNum(x * y); }
        else if (t <= 5) { const y = r(2, 9), z = r(11, 60); q = (y * z) + ' ÷ ' + y + ' ='; a = z; }
        else if (t <= 7) { const k = r(1, 9) * 5; q = '0.' + (k < 10 ? '0' + k : k) + ' = ?%（只填数字）'; a = k; }
        else { const d = r(2, 6), k = r(2, 6), p = r(1, d - 1); q = p + '/' + d + ' × ' + (d * k) + ' =（只填整数）'; a = p * k; }
      }
      list.push({ q: q, a: String(a), type: type });
    }
    return list;
  }
  function stopOralTimer() { if (S.oral.timer) { clearInterval(S.oral.timer); S.oral.timer = null; } }
  function ensureOralTimer() {
    if (S.tab !== 'oral' || !S.oral.running) { stopOralTimer(); return; }
    if (S.oral.timer) return;
    const tick = () => {
      const left = S.oral.endAt - Date.now();
      const el = $('#oralTimer');
      if (el) {
        el.textContent = fmtTime(left);
        const box = el.closest('.oral-timer');
        if (box) box.classList.toggle('urgent', left <= 60000);
      }
      if (left <= 0) {
        stopOralTimer();
        S.oral.timedOut = true;   // 时间到：空题算错，强制交卷
        H['oral-submit']();
      }
    };
    S.oral.timer = setInterval(tick, 250);
    tick();
  }
  /* 只把「当前题」的高亮和值同步到页面，避免整页重绘丢焦点、打断计时 */
  function syncOralInput(i) {
    const O = S.oral, n = O.list.length;
    if (!n) return;
    const ix = Math.min(Math.max(i || 0, 0), n - 1);
    const box = $('#view');
    if (!box) return;
    box.querySelectorAll('.oral-item').forEach((el, k) => {
      el.classList.toggle('active', k === ix);
      const inp = el.querySelector('.oral-inp');
      if (inp && inp.value !== String(O.answers[k] || '')) inp.value = O.answers[k] || '';
    });
    const tip = box.querySelector('.oral-pad-t b');
    if (tip) tip.textContent = ix + 1;
  }
  function renderOral() {
    const O = S.oral, n = oralCount(), best = db.oral.best[today()];
    const head = '<div class="card tight"><div class="card-h">' + ic('clock') + '<h2>每日口算 · 计时练习</h2>' +
      '<span class="sub">' + (best ? '今日最好 ' + fmtTime(best.ms) + ' · ' + best.right + '/' + best.total + ' 对' : '今天还没成绩，来挑战一下') + '</span></div>' +
      '<div class="tiny muted">每天 ' + n + ' 道' + gradeName(mathGrade()) + '口算，' + oralMinutes() + ' 分钟倒计时，时间到自动交卷；错题自动进错题本。题数和时间都能在「设置」里改。</div></div>';
    if (!O.list.length) {
      return head + '<div class="card" style="margin-top:16px;text-align:center">' +
        '<div class="card-h" style="justify-content:center">' + ic('sparkles') + '<h2>准备好了吗？</h2></div>' +
        '<div class="tiny muted" style="margin:8px 0 18px">点开始后进入 <b>' + oralMinutes() + ' 分钟倒计时</b>，时间到会自动交卷（没写完的算错）。写错了没关系，辟邪陪你一起看讲解。</div>' +
        '<button class="btn lg" data-action="oral-start">' + ic('play', 'sm') + '开始 ' + n + ' 道 · ' + oralMinutes() + ' 分钟</button></div>';
    }
    const right = O.list.filter(x => x.result).length;
    const cur = Math.min(Math.max(O.cur || 0, 0), O.list.length - 1);
    const items = O.list.map((it, i) =>
      '<div class="oral-item ' + (O.done ? (it.result ? 'ok' : 'no') : (i === cur ? 'active' : '')) + '">' +
      '<span class="oral-no">' + (i + 1) + '</span>' +
      '<span class="oral-q">' + esc(it.q) + '</span>' +
      (O.done
        // 批改后：纯展示，没有任何输入框，不会误触弹出键盘
        ? '<span class="oral-show">' + esc(O.answers[i] || '空') + '</span>'
        // 答题中：readonly 输入框，点它只切换当前题，不弹 iPad 系统键盘
        : '<input class="input oral-inp" readonly inputmode="none" data-oral-focus="' + i + '" value="' + esc(O.answers[i] || '') + '" placeholder="?" autocomplete="off" autocorrect="off" spellcheck="false">') +
      (O.done ? '<span class="oral-mark">' + ic(it.result ? 'check' : 'x') + '</span>' : '') + '</div>').join('');
    // 内置数字小键盘：iPad 上不弹系统大键盘，也不遮挡右边一列题目
    const padKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '/'];
    const pad = '<div class="oral-pad">' +
      '<div class="oral-pad-t">正在填第 <b>' + (cur + 1) + '</b> 题 · 点题号可换题</div>' +
      '<div class="oral-keys">' +
      padKeys.map(k => '<button class="oral-key" data-action="oral-key" data-k="' + k + '">' + k + '</button>').join('') +
      '<button class="oral-key fn" data-action="oral-key" data-k="del" aria-label="删除">⌫</button>' +
      '<button class="oral-key fn" data-action="oral-jump" data-d="-1" aria-label="上一题">↑</button>' +
      '<button class="oral-key fn" data-action="oral-jump" data-d="1" aria-label="下一题">↓</button>' +
      '</div>' +
      '<button class="btn mint oral-submit-btn" data-action="oral-next">填好了，下一题' + ic('arrow', 'sm') + '</button>' +
      '<button class="btn ghost sm oral-giveup" data-action="oral-back">放弃这组</button></div>';
    if (O.done) {
      return head + '<div class="card" style="margin-top:16px"><div class="card-h">' + ic('chart') + '<h2>这一组完成啦</h2>' +
        '<span class="sub">' + right + ' / ' + O.list.length + ' 正确</span></div>' +
        '<div class="oral-top"><div class="oral-timer">' + ic('clock') + fmtTime(O.elapsed) + '</div>' +
        '<span class="oral-hint">用时 · ' + oralMinutes() + ' 分钟倒计时' + (O.timedOut ? ' · 时间到自动交卷' : '') + '</span>' +
        '<span class="oral-hint">' + (right === O.list.length ? '全对！额外奖励 2 颗星星' : '错的题已经放进错题本，去听 AI 讲一讲吧') + '</span></div>' +
        '<div class="oral-grid">' + items + '</div>' +
        '<div class="btn-row" style="margin-top:18px">' +
        '<button class="btn" data-action="oral-restart">' + ic('refresh', 'sm') + '再来一组</button>' +
        (right < O.list.length ? '<button class="btn coral" data-action="nav" data-tab="mistakes">' + ic('bulb', 'sm') + '看错题讲解</button>' : '') +
        '<button class="btn ghost" data-action="oral-back">结束</button></div></div>';
    }
    return head + '<div class="card" style="margin-top:16px"><div class="card-h">' + ic('play') + '<h2>口算进行中</h2>' +
      '<span class="sub">共 ' + O.list.length + ' 题</span></div>' +
      '<div class="oral-top"><div class="oral-timer">' + ic('clock') + '<span id="oralTimer">' + fmtTime(Math.max(0, O.endAt - Date.now())) + '</span></div>' +
      '<span class="oral-hint">剩余时间 · 用右边的数字键盘填答案，时间到自动交卷</span></div>' +
      '<div class="oral-body"><div class="oral-main"><div class="oral-grid">' + items + '</div>' +
      '<div class="btn-row" style="margin-top:18px">' +
      '<button class="btn lg mint" data-action="oral-submit">' + ic('check', 'sm') + '交卷批改</button></div></div>' +
      pad + '</div></div>';
  }

  /* ---------------- 视图 5：错题本与讲解 ---------------- */
  function renderMistakes() {
    let list = db.mistakes.slice();
    if (S.mk.filter === 'english') list = list.filter(m => m.subject === '英语');
    else if (S.mk.filter === 'chinese') list = list.filter(m => m.subject === '语文');
    else if (S.mk.filter === 'math') list = list.filter(m => m.subject === '数学');
    else if (S.mk.filter === 'todo') list = list.filter(m => !m.mastered);
    else if (S.mk.filter === 'mastered') list = list.filter(m => m.mastered);
    const filters = [['all', '全部 ' + db.mistakes.length], ['todo', '待弄懂 ' + db.mistakes.filter(m => !m.mastered).length],
    ['english', '英语'], ['math', '数学'], ['chinese', '语文'], ['mastered', '已掌握']];
    const tabs = '<div class="tabs">' + filters.map(f =>
      '<button class="tab ' + (S.mk.filter === f[0] ? 'active' : '') + '" data-action="mk-filter" data-f="' + f[0] + '">' + f[1] + '</button>').join('') + '</div>';
    const cards = list.length ? list.map(m => mistakeCard(m)).join('') : empty('这里还没有错题。听写或数学练习里做错的题会自动收进来', 'book');
    return tabs + '<div class="card-h" style="margin-bottom:12px">' + ic('book') + '<h2>我的错题本</h2>' +
      (db.mistakes.some(m => m.mastered) ? '<button class="btn ghost sm" data-action="mk-clear">清理已掌握</button>' : '') +
      '<span class="sub">点题目可展开分步讲解</span></div>' + cards;
  }
  function mistakeCard(m) {
    const open = S.mk.open === m.id;
    const tagName = m.kind === 'general' ? '字词对照' : (m.tag && D.tagNames[m.tag] ? D.tagNames[m.tag] : (m.subject === '英语' ? '单词拼写' : '综合'));
    return '<div class="mistake ' + (m.mastered ? 'mastered' : '') + '">' +
      '<div class="mk-top"><button style="flex:1;text-align:left;min-width:180px" data-action="mk-toggle" data-id="' + m.id + '">' +
      '<div class="q">' + esc(m.q) + '</div></button>' +
      '<span class="chip ' + (m.subject === '英语' ? 'p' : m.subject === '语文' ? 'm' : 'b') + '">' + esc(m.subject || '数学') + '</span>' +
      '<span class="chip">' + esc(tagName) + '</span>' +
      (m.mastered ? '<span class="chip m">已掌握</span>' : '') + '</div>' +
      '<div class="mk-answers"><div class="box mine"><span>我的答案</span><b>' + (esc(m.mine) || '（空 / 跳过）') + '</b></div>' +
      '<div class="box right"><span>正确答案</span><b>' + esc(m.correct) + '</b></div></div>' +
      '<div class="mk-meta">' + ic('calendar', 'sm') + ' ' + esc(m.date) + ' · 一起弄懂它，比记住答案更重要</div>' +
      (open ? lessonHtml(m) : '') +
      '<div class="mk-actions">' +
      '<button class="btn ghost sm" data-action="mk-toggle" data-id="' + m.id + '">' + ic('bulb', 'sm') + (open ? '收起讲解' : '看讲解') + '</button>' +
      '<button class="btn ghost sm" data-action="mk-ai-speak" data-id="' + m.id + '">' + ic(S.mk.speakingId === m.id ? 'stop' : 'sparkles', 'sm') + (S.mk.speakingId === m.id ? '停止讲解' : 'AI 讲一讲') + '</button>' +
      (m.subject === '英语' || m.subject === '语文'
        ? '<button class="btn ghost sm" data-action="mk-speak" data-id="' + m.id + '">' + ic('volume', 'sm') + (m.subject === '语文' ? '普通话朗读' : '听读音') + '</button>' :
        '<button class="btn ghost sm" data-action="mk-practice" data-id="' + m.id + '">' + ic('refresh', 'sm') + '再练一次</button>') +
      '<button class="btn ' + (m.mastered ? 'ghost' : 'mint') + ' sm" data-action="mk-master" data-id="' + m.id + '">' + ic('check', 'sm') + (m.mastered ? '设为未掌握' : '标记已掌握') + '</button>' +
      '<button class="btn ghost sm" data-action="mk-note" data-id="' + m.id + '">' + ic('edit', 'sm') + '家长笔记</button>' +
      '<button class="btn ghost sm" data-action="mk-del" data-id="' + m.id + '">' + ic('trash', 'sm') + '</button>' +
      '</div></div>';
  }
  function generalLessonHtml(m) {
    const right = String(m.correct || '');
    const mine = String(m.mine || '');
    const isZh = m.subject === '语文';
    const chars = right.split('').map((c, i) =>
      '<span class="gc ' + (mine[i] && mine[i] === c ? 'same' : 'diff') + '">' + esc(c) + '</span>').join('');
    return '<div class="lesson"><h4>' + ic('bulb') + '一个字一个字对清楚：' + esc(right) + '</h4>' +
      '<div class="lbl">正确答案逐' + (isZh ? '字' : '字母') + '看（标红的是和你写的不一样的位置）</div>' +
      '<div class="sim" style="font-size:18px;letter-spacing:2px;font-weight:700">' + chars + '</div>' +
      '<div class="lbl">你写的是</div><div class="pit">' + esc(mine || '（这次空着没写）') + '</div>' +
      '<div class="lbl">' + (isZh ? '容易错在哪' : '容易拼错在哪') + '</div><ul>' +
      '<li>' + (isZh ? '先数一数字数，看看有没有多字、漏字，或写错偏旁' : '先数一数字母个数，看看有没有漏字母、双写字母或顺序颠倒') + '</li>' +
      '<li>' + (isZh ? '注意同音字、形近字，把词放进句子里读一遍' : '注意不发音的字母和大小写，边读边跟着拼') + '</li>' +
      '<li>对照上面的正确答案，找出第一个不一样的位置，从那里重写</li></ul>' +
      '<div class="lbl">三步复习法</div><ol>' +
      '<li>点「' + (isZh ? '普通话朗读' : '听读音') + '」听一遍，边听边看字形</li>' +
      '<li>遮住答案默写 3 遍，每遍都对一遍字形</li>' +
      '<li>明天再默写一次，写对了就点「标记已掌握」</li></ol>' +
      (m.note ? '<div class="note-box"><b>家长笔记：</b>' + esc(m.note) + '</div>' : '') + '</div>';
  }
  function lessonHtml(m) {
    if (m.kind === 'general') return generalLessonHtml(m);
    if (m.subject === '英语') {
      const letters = String(m.correct).split('').map(c => c === ' ' ? ' / ' : c).join(' · ');
      return '<div class="lesson"><h4>' + ic('bulb') + '这个词怎么记：' + esc(m.correct) + '</h4>' +
        '<div class="lbl">逐字母拆开看</div><div class="sim" style="font-size:17px;letter-spacing:2px;font-weight:700">' + esc(letters) + '</div>' +
        '<div class="lbl">词义与记忆窍门</div><ul><li>中文意思：' + esc(m.zh || '—') + '</li>' +
        (m.tip ? '<li>' + esc(m.tip) + '</li>' : '') +
        '<li>共 ' + String(m.correct).replace(/ /g, '').length + ' 个字母，先按读音分小段记住，再连起来写</li></ul>' +
        '<div class="lbl">容易写错的地方</div><div class="pit">' + esc(m.mine ? '你写成了「' + m.mine + '」，对照上面的字母顺序，找出是哪一位不一样。' : '这次没有写出来，先听一遍读音，再看着字母表拼一次。') + '</div>' +
        '<div class="lbl">三步复习法</div><ol><li>点「听读音」再听一次，边听边跟着拼</li><li>在纸上默写 3 遍，每遍都遮住答案</li><li>明天再做一次听写，写对了就点「标记已掌握」</li></ol>' +
        (m.note ? '<div class="note-box"><b>家长笔记：</b>' + esc(m.note) + '</div>' : '') + '</div>';
    }
    const L = D.lessons[m.tag] || D.lessons[inferTag(m.q)];
    const sol = m.solution && m.solution.length ? '<div class="lbl">这道题的分步解法</div><ol>' + m.solution.map(s => '<li>' + esc(s) + '</li>').join('') + '</ol>' : '';
    const sim = L.similar.map((s, i) => '<div style="margin:5px 0">' + (i + 1) + '. ' + esc(s.q) +
      ' <button class="btn ghost sm" data-action="reveal-sim" data-a="' + esc(s.a) + '">看答案</button></div>').join('');
    return '<div class="lesson"><h4>' + ic('bulb') + '知识点：' + esc(L.title) + '</h4>' +
      sol +
      '<div class="lbl">先记住这三句话</div><ul>' + L.points.map(p => '<li>' + esc(p) + '</li>').join('') + '</ul>' +
      '<div class="lbl">以后遇到同类题，按这个顺序做</div><ol>' + L.steps.map(s => '<li>' + esc(s) + '</li>').join('') + '</ol>' +
      '<div class="lbl">最容易踩的坑</div><div class="pit">' + L.pitfalls.map(esc).join('；') + '</div>' +
      '<div class="lbl">举一反三 · 先自己算，再看答案</div><div class="sim">' + sim + '</div>' +
      (m.note ? '<div class="note-box"><b>家长笔记：</b>' + esc(m.note) + '</div>' : '') + '</div>';
  }

  /* ---------------- AI 语音讲错题：设备中文语音合成，离线可用 ---------------- */
  function aiLessonText(m) {
    if (m.kind === 'general') {
      return '我们一起来看看这一题。题目是：' + m.q + '。' +
        '正确答案是 ' + m.correct + '，你写的是 ' + (m.mine || '空') + '。' +
        (m.subject === '语文' ? '语文题要一个字一个字对清楚，看看是写错字、多字漏字，还是顺序颠倒了。' :
          '英文要一个字母一个字母对清楚，看看是少了字母、拼错，还是大小写的问题。') +
        '建议先把正确答案认真读一遍，再遮住答案默写两遍，最后自己检查一遍。' +
        '明天再复习一次，写对了就可以标记已掌握啦。';
    }
    if (m.subject === '英语') {
      const letters = String(m.correct).split('').filter(c => c !== ' ').join('、');
      return '我们一起来看看这个单词。题目是，' + (m.q || '听写') + '。' +
        '正确答案是 ' + m.correct + '，意思是' + (m.zh || '这个英文单词') + '。' +
        (m.mine ? '你刚才写成了 ' + m.mine + '，我们对照一下字母。' : '这次没有写出来，别着急。') +
        '这个单词的字母依次是：' + letters + '。' +
        (m.tip ? '记忆小窍门：' + m.tip + '。' : '') +
        '建议你先听一遍读音，边听边跟着拼，然后遮住答案默写三遍。明天再听写一次，写对了就可以标记已掌握啦。';
    }
    const L = D.lessons[m.tag] || D.lessons[inferTag(m.q)];
    const steps = (m.solution && m.solution.length) ? m.solution : L.steps;
    return '我们一起来看看这道题。题目是：' + m.q + '。' +
      '正确答案是 ' + m.correct + '，你写的是 ' + (m.mine || '空') + '。' +
      '这道题考的知识点是' + L.title + '。' +
      '先记住这几句话：' + L.points.join('；') + '。' +
      '解题可以按这个顺序来：' + steps.join('；') + '。' +
      '最容易出错的地方是：' + L.pitfalls.join('；') + '。' +
      (L.similar && L.similar.length ? '再自己试一道类似的题：' + L.similar[0].q + '。答案是 ' + L.similar[0].a + '。' : '') +
      '把思路说出来，再在本子上重新算一遍，就真正弄懂啦。';
  }
  /* iPad 的「zh」声线里混着粤语（zh-HK / Sin-ji），必须明确排除，
     否则 AI 讲错题会读成粤语。这里只挑普通话（zh-CN / zh-Hans / cmn）。 */
  function isCantonese(v) {
    const s = ((v.lang || '') + ' ' + (v.name || '') + ' ' + (v.voiceURI || '')).toLowerCase();
    return /zh[-_]hk|yue|cantonese|粵|粤|sin[-_]?ji|廣東|广东/.test(s);
  }
  function chineseVoices() {
    loadVoices();
    return voicesReady.filter(v => /^(zh|cmn)/i.test(v.lang || '') && !isCantonese(v));
  }
  function pickMandarinVoice() {
    const saved = db.settings.zhVoiceURI;
    const list = chineseVoices();
    if (saved) { const hit = list.find(v => v.voiceURI === saved); if (hit) return hit; }
    const score = v => {
      let s = 0;
      const n = ((v.name || '') + ' ' + (v.voiceURI || '') + ' ' + (v.lang || '')).toLowerCase();
      if (/zh[-_]?cn|zh[-_]hans|cmn[-_]hans/i.test(n)) s += 100;
      if (/mandarin|putonghua|普通话|国语|ting[-_]?ting|mei[-_]?jia|yu[-_]?shu|xiaoxiao|yunxi|google 普通话/i.test(n)) s += 40;
      if (/zh[-_]tw|zh[-_]hant/i.test(n)) s += 10;   // 国语也听得懂，但排在普通话之后
      if (v.localService) s += 5;
      return s;
    };
    list.sort((a, b) => score(b) - score(a));
    return list[0] || null;
  }
  /* 讲解语音的「打断令牌」：点别的按钮 / 点辟邪时，排队中的后半句不能再念出来 */
  let zhToken = 0;
  let zhGapTimer = null;
  /* 朗读前把表情符号、装饰符号清掉：语音合成会把它们念成「笑脸」「星星」，很出戏。
     同时把连续标点收干净，避免停顿忽长忽短，听起来更像人在说话。 */
  function speakableText(text) {
    let s = String(text == null ? '' : text);
    // 1) emoji 与杂符号（含变体选择符、零宽连接符、肤色修饰）
    s = s.replace(/[\uFE00-\uFE0F\u200D\u20E3]/g, '');
    s = s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}]/gu, '');
    // 2) 其它会被念出来的图形符号
    s = s.replace(/[★☆♥♡♪♫✓✔✗✘❤✨☀☁☺☻→←↑↓⇒]/g, '');
    // 3) 连续标点 / 空白收敛，句读更自然
    s = s.replace(/[ \t\u3000]+/g, ' ');
    s = s.replace(/([，、。！？；：])\1+/g, '$1');
    s = s.replace(/([，、；：])\s*([。！？])/g, '$2');
    s = s.replace(/^[，、。；：\s]+/, '');
    s = s.replace(/([，、；：])\s*$/g, '。');
    // 4) 数学符号翻译成读法：合成引擎直接读"+""="会跳过或念错
    s = s.replace(/＝/g, '等于').replace(/=/g, '等于');
    s = s.replace(/＋/g, '加').replace(/\+/g, '加');
    s = s.replace(/×/g, '乘以').replace(/[*✕✖]/g, '乘以');
    s = s.replace(/÷/g, '除以').replace(/(\d+)\s*\/\s*(\d+)/g, '$2分之$1');   // 1/2 读「二分之一」
    s = s.replace(/−|－/g, '减').replace(/(\d)\s*-\s*(\d)/g, '$1减$2');
    s = s.replace(/</g, '小于').replace(/>/g, '大于');
    s = s.replace(/(\d+)\s*%/g, '百分之$1');
    s = s.replace(/\s*&\s*/g, '和');
    // 5) 把破折号、省略号换成短停顿，语流更顺
    s = s.replace(/…+|\.{3,}/g, '，');
    s = s.replace(/—{2,}|-{2,}/g, '，');
    s = s.replace(/[（(]\s*[）)]/g, '');
    return s.trim();
  }
  /* 设备自带朗读（离线兜底）。iPad 的婷婷/美嘉比较机械，所以只在没有网络时用。 */
  function speakChineseDevice(parts, onEnd, token) {
    if (!('speechSynthesis' in window)) { toast('当前浏览器不支持语音讲解'); return false; }
    try {
      const v = pickMandarinVoice();
      let i = 0;
      const my = token || ++zhToken;
      const next = () => {
        if (my !== zhToken) return;
        if (i >= parts.length) { if (onEnd) { try { onEnd(); } catch (e) { } } return; }
        const u = new SpeechSynthesisUtterance(parts[i++]);
        u.lang = 'zh-CN';
        u.rate = 0.9;     // 稍慢一点，像耐心地慢慢讲
        u.pitch = 1.02;   // 只抬高一点点：抬太多会变成"电子娃娃音"，反而不自然
        u.volume = 1;
        if (v) { try { u.voice = v; } catch (e) { } }
        u.onend = () => { zhGapTimer = setTimeout(next, 150); };   // 句子之间留一口气，更像老师面对面讲
        u.onerror = () => { zhGapTimer = setTimeout(next, 60); };
        window.speechSynthesis.speak(u);
      };
      next();
      return true;
    } catch (e) { return false; }
  }
  function speakChinese(text, onEnd) {
    stopChinese();       // 取消上一段，并把残留的分句队列作废
    const clean = speakableText(text);
    if (!clean) { toast('这句话没有可朗读的文字'); if (onEnd) { try { onEnd(); } catch (e) { } } return false; }
    const my = ++zhToken;     // 本次讲解的令牌；被 stopChinese / 宠物打断后不再继续念
    // 长句拆成短句逐句朗读：每句之间自然换气，听感更接近老师面对面讲题
    const parts = clean.split(/(?<=[。！？])/).map(x => x.trim()).filter(Boolean);
    // 默认用在线真人语音（自然得多）；选了具体设备声线、或关掉在线发音时走设备朗读
    const zhSel = String(db.settings.zhVoiceURI || '');
    const useOnline = db.settings.onlineVoice !== false && (zhSel === '' || zhSel === 'online');
    if (useOnline) {
      let i = 0;
      const next = () => {
        if (my !== zhToken) return;
        if (i >= parts.length) { if (onEnd) { try { onEnd(); } catch (e) { } } return; }
        const t = parts[i++];
        OnlineVoice.play(t, 0.94, null, 'zh').then(() => {
          zhGapTimer = setTimeout(next, 130);
        }).catch(() => {
          // 在线没连上（断网/被拦）：从这句起整段退回设备朗读
          if (my !== zhToken) return;
          stopChinese();
          zhToken = my;
          speakChineseDevice(parts.slice(i - 1), onEnd, my);
        });
      };
      next();
      return true;
    }
    return speakChineseDevice(parts, onEnd, my);
  }
  function stopChinese() {
    zhToken++;                     // 让还在排队的分句全部作废
    clearTimeout(zhGapTimer);
    zhGapTimer = null;
    try { OnlineVoice.stop(); } catch (e) { }
    try { LessonVoice.stop(); } catch (e) { }
    try { window.speechSynthesis.cancel(); } catch (e) { }
  }

  /* ---------------- 拍照批改：OCR 文本解析 ---------------- */
  function parseOcrText(text, subject) {
    const sub = subject || '数学';
    const rows = [];
    String(text || '').split('\n').map(x => x.trim()).filter(Boolean).forEach(line => {
      if (line.indexOf('|') >= 0) {
        const p = line.split('|').map(x => x.trim());
        if (p[0]) rows.push({ q: p[0], mine: p[1] || '', correct: p[2] || '' });
        return;
      }
      if (sub === '数学') {
        // 形如 "3.6 + 2.7 = 6.3"：自动算出正确答案，OCR 出的数当作孩子写的答案
        const m = /^(.+?)\s*[=＝]\s*([\d.\/\-]+)\s*$/.exec(line);
        if (m) {
          const expr = m[1].trim(), mine = m[2].trim(), correct = calcExpr(expr);
          if (correct !== null && /[+\-×÷xX*/]/.test(expr)) {
            rows.push({ q: expr + ' =', mine: mine, correct: String(correct) });
            return;
          }
        }
        // 只有算式、还没写答案
        const bare = line.replace(/[=＝?？]\s*$/, '').trim();
        const c2 = calcExpr(bare);
        if (c2 !== null && /[+\-×÷xX*/]/.test(bare)) {
          rows.push({ q: bare + ' =', mine: '', correct: String(c2) });
          return;
        }
      }
      rows.push({ q: line, mine: '', correct: '' });
    });
    return rows;
  }

  /* 拍照检查：上传 OCR 前在本地压缩。直接产出 Blob（不用 fetch(dataURL)，
     因为 Safari 不支持对 data: 地址调用 fetch，iPad 上会直接抛错）。 */
  function shrinkPhoto(file, maxW, quality) {
    return new Promise(resolve => {
      const done = blob => resolve({
        blob: blob,
        url: URL.createObjectURL(blob)
      });
      const fail = () => done(file);          // 任何一步失败就退回原图
      try {
        const reader = new FileReader();
        reader.onerror = fail;
        reader.onload = () => {
          const img = new Image();
          img.onerror = fail;
          img.onload = () => {
            try {
              const scale = Math.min(1, maxW / Math.max(img.width, img.height));
              const w = Math.max(1, Math.round(img.width * scale));
              const h = Math.max(1, Math.round(img.height * scale));
              const cv = document.createElement('canvas');
              cv.width = w; cv.height = h;
              const cx = cv.getContext('2d');
              cx.fillStyle = '#fff';            // 透明底铺白，避免 JPEG 黑底
              cx.fillRect(0, 0, w, h);
              cx.drawImage(img, 0, 0, w, h);
              if (!cv.toBlob) return fail();
              cv.toBlob(b => (b ? done(b) : fail()), 'image/jpeg', quality || 0.85);
            } catch (e) { fail(); }
          };
          img.src = String(reader.result);
        };
        reader.readAsDataURL(file);
      } catch (e) { fail(); }
    });
  }

  /* 通用 OCR 调用（拍照批改、单词表导入共用） */
  async function ocrSpace(blob, lang) {
    const ask = () => {
      const fd = new FormData();
      fd.append('apikey', db.settings.ocrKey || 'helloworld');
      fd.append('language', lang || 'chs');
      fd.append('isOverlayRequired', 'false');
      fd.append('OCREngine', '2');
      fd.append('file', blob, 'page.jpg');
      const ctrl = ('AbortController' in window) ? new AbortController() : null;
      const timer = setTimeout(() => { if (ctrl) ctrl.abort(); }, 25000);
      return fetch('https://api.ocr.space/parse/image', {
        method: 'POST', body: fd, signal: ctrl ? ctrl.signal : undefined
      }).then(r => r.json()).finally(() => clearTimeout(timer));
    };
    let j;
    try { j = await ask(); }
    catch (e1) { await new Promise(r => setTimeout(r, 900)); j = await ask(); }
    if (j.IsErroredOnProcessing) throw new Error((j.ErrorMessage && j.ErrorMessage[0]) || '识别服务返回错误');
    return String((j.ParsedResults && j.ParsedResults[0] && j.ParsedResults[0].ParsedText) || '').trim();
  }

  /* 把 OCR 出来的单词表整理成「单词,中文」。课本单词表常见排版：
       1. apple 苹果 /ˈæpl/
       banana  香蕉
     OCR 可能把两列粘成一行，也可能带上音标和括号，这里尽量洗干净，
     剩下的交给家长在文本框里改。 */
  function parseWordSheet(text) {
    const out = [], seen = {};
    String(text || '').split('\n').forEach(raw => {
      let line = String(raw).replace(/[|｜]/g, ' ').replace(/[•·]/g, ' ').trim();
      if (!line) return;
      if (/^(unit|module|words?|vocabulary|reading|单词表|词汇表|英语|姓名|班级|class|name|date)\b/i.test(line)) return;
      if (!/[A-Za-z]{2}/.test(line)) return;
      line = line.replace(/^[\s（(]*\d+[\s.、)）:：]*/, '').replace(/^[①-⑳]\s*/, '');
      const m = line.match(/^([A-Za-z][A-Za-z'’\-]*(?:\s+[A-Za-z][A-Za-z'’\-]*){0,2})\s*(.*)$/);
      if (!m) return;
      let w = m[1].trim().replace(/\s+/g, ' ');
      if (w.length < 2) return;
      // OCR 噪声：'banana A' 这类孤立单字母尾巴直接去掉（'ice cream' 这种词组保留）
      const wp = w.split(' ');
      if (wp.length > 1 && wp.slice(1).every(x => x.length === 1)) w = wp[0];
      let rest = (m[2] || '').replace(/[\/\[][^\/\]]{1,32}[\/\]]/g, ' ');   // 去音标
      const zh = (rest.match(/[\u4e00-\u9fa5][\u4e00-\u9fa5A-Za-z，。、；：（）()·\s]*/) || [''])[0]
        .replace(/[（(].*?[)）]/g, '').replace(/\s+[A-Za-z]\s*$/, '').trim().slice(0, 20);
      const key = w.toLowerCase();
      if (seen[key]) return;
      seen[key] = 1;
      out.push({ w: w, zh: zh, tip: '' });
    });
    return out;
  }

  function dictPhotoHtml(msg, cls) {
    const P = S.dictPhoto || {};
    const lines = P.words ? P.words.map(w => w.w + (w.zh ? ',' + w.zh : '')).join('\n') : '';
    return '<div class="modal wide">' + modalHead('拍照导入单词表') +
      '<div class="tiny muted" style="margin-bottom:10px">拍下课本后面的单词表 → 自动识别 → 核对一下 → 存进「我的词库」，马上就能听写。<b>识别需要联网，照片会发到免费 OCR 服务（ocr.space）读文字，本应用不保存照片。</b></div>' +
      '<div class="btn-row" style="margin:8px 0 4px">' +
        '<button class="btn ghost" data-action="dict-photo-cam">' + ic('camera', 'sm') + (P.url ? '重拍一张' : '拍照') + '</button>' +
        '<button class="btn ghost" data-action="dict-photo-lib">' + ic('image', 'sm') + '从相册选</button>' +
      '</div>' +
      '<input type="file" id="dictCam" accept="image/*" capture="environment" data-dictphoto class="sr-file" onclick="event.stopPropagation()">' +
      '<input type="file" id="dictLib" accept="image/*" data-dictphoto class="sr-file" onclick="event.stopPropagation()">' +
      (P.url ? '<div style="margin:12px 0"><img class="photo-preview" src="' + esc(P.url) + '" alt="单词表照片"></div>' : '') +
      (P.url ? '<div class="field"><label>识别结果（每行一个：单词,中文，可直接修改）</label>' +
        '<textarea class="input ocr-area" data-model="dictPhoto.text" rows="9" placeholder="apple,苹果">' + esc(lines) + '</textarea></div>' : '') +
      '<div class="ocr-status ' + (cls || '') + '">' + esc(msg || '') + '</div>' +
      '<div class="modal-foot"><button class="btn ghost" data-action="close-modal">取消</button>' +
      (P.url ? '<button class="btn ghost" data-action="dict-photo-again">' + ic('refresh', 'sm') + '重新识别</button>' : '') +
      (P.url ? '<button class="btn" data-action="dict-photo-save">' + ic('check', 'sm') + '存进我的词库（' + ((P.words || []).length) + ' 词）</button>' : '') +
      '</div></div>';
  }

  /* 换图后只更新设置面板里的两张预览，不重绘整个弹窗，避免丢掉还没保存的设置 */
  function refreshPetLook() {
    const a = document.getElementById('plAvatar');
    const p = document.getElementById('plPic');
    if (a) { a.src = db.pet.avatar || 'icons/pipi-lg.png?v=35'; a.className = db.pet.avatar ? 'custom' : ''; }
    if (p) { p.src = petPic(); p.className = db.pet.pic ? 'custom' : ''; }
  }

  /* 头像 / 宠物图：居中裁成方形再压缩，避免变形；透明底铺白，防止存成黑图 */
  function squareDataURL(file, size, quality) {
    return new Promise(resolve => {
      const fail = () => resolve('');
      try {
        const reader = new FileReader();
        reader.onerror = fail;
        reader.onload = () => {
          const img = new Image();
          img.onerror = fail;
          img.onload = () => {
            try {
              const s = Math.min(img.width, img.height);
              const sx = (img.width - s) / 2, sy = (img.height - s) / 2;
              const cv = document.createElement('canvas');
              cv.width = size; cv.height = size;
              const cx = cv.getContext('2d');
              cx.fillStyle = '#fff';
              cx.fillRect(0, 0, size, size);
              cx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
              resolve(cv.toDataURL('image/jpeg', quality || 0.82));
            } catch (e) { fail(); }
          };
          img.src = String(reader.result);
        };
        reader.readAsDataURL(file);
      } catch (e) { fail(); }
    });
  }

  function photoModalHtml(msg, cls) {
    const P = S.photo;
    const sub = P.subject || '数学';
    return '<div class="modal wide">' + modalHead('作业拍照检查') +
      '<div class="section-title">这次检查哪一科</div>' + subjectChips('photo-subject', sub) +
      '<div class="subject-tip">' + subjectTip(sub) + '</div>' +
      '<div class="tiny muted" style="margin-bottom:12px">拍下写好的作业 → 自动识别 → 手动改正识别错的字 → 导入后自动批改。<b>识别需要联网，照片会发送到免费 OCR 服务（ocr.space）读取文字</b>，本应用不会保存照片；不想上传照片可改用「手动录入」，批改效果一样。</div>' +
      '<div class="btn-row" style="margin:10px 0 4px">' +
        '<button class="btn ghost" data-action="photo-camera">' + ic('camera', 'sm') + (P.url ? '重拍一张' : '拍照') + '</button>' +
        '<button class="btn ghost" data-action="photo-album">' + ic('image', 'sm') + '从相册选</button>' +
      '</div>' +
      /* iPad 的独立应用模式里 display:none 的文件框点不动，改用 1px 透明框 */
      '<input type="file" id="photoCam" accept="image/*" capture="environment" data-photo class="sr-file"' +
        ' onclick="event.stopPropagation()">' +
      '<input type="file" id="photoLib" accept="image/*" data-photo class="sr-file"' +
        ' onclick="event.stopPropagation()">' +
      (P.url ? '<div style="margin:14px 0"><img class="photo-preview" src="' + P.url + '" alt="作业照片"></div>' : '') +
      (P.url ? '<div class="field"><label>识别结果（可以直接修改，每行一道；也支持 题目|我的答案|正确答案）</label>' +
        '<textarea class="input ocr-area" data-model="photo.text" placeholder="3.6 + 2.7 = 6.3">' + esc(P.text) + '</textarea></div>' : '') +
      '<div class="ocr-status ' + (cls || '') + '">' + esc(msg || '') + '</div>' +
      '<div class="modal-foot"><button class="btn ghost" data-action="close-modal">取消</button>' +
      (P.url ? '<button class="btn ghost" data-action="photo-ocr" ' + (P.busy ? 'disabled' : '') + '>' + ic('refresh', 'sm') + '重新识别</button>' : '') +
      (P.url ? '<button class="btn" data-action="photo-import">' + ic('check', 'sm') + '导入并批改</button>' : '') +
      '</div></div>';
  }

  /* ==========================================================
     v21 · 天禄小窝：积分 → 商城 → 拖拽喂养
     规则：当天完成作业打卡、且错题全部弄懂后才解锁
     ========================================================== */
  /* v49：每种食物能顶多久（饱食度点数）。100 点 = 24 小时，
     水果大概顶 6～7 小时、小蛋糕顶 11 小时，一天喂两三次就不会断顿。
     对 1 点 ≈ 14.4 分钟。 */
  const SHOP = [
    { id: 'apple',  name: '红苹果', emoji: '🍎', price: 6,  energy: 28, yum: '咔嚓咔嚓，好脆好甜' },
    { id: 'banana', name: '香蕉',   emoji: '🍌', price: 5,  energy: 30, yum: '软软糯糯，最喜欢啦' },
    { id: 'strawberry', name: '草莓', emoji: '🍓', price: 8, energy: 26, yum: '酸酸甜甜，一口一个' },
    { id: 'grape',  name: '葡萄',   emoji: '🍇', price: 7,  energy: 26, yum: '噗啾，汁水好多' },
    { id: 'cookie', name: '小饼干', emoji: '🍪', price: 4,  energy: 18, yum: '咔滋咔滋，好香呀' },
    { id: 'cake',   name: '小蛋糕', emoji: '🍰', price: 10, energy: 45, yum: '唔～奶油好绵' },
    { id: 'candy',  name: '水果糖', emoji: '🍬', price: 3,  energy: 14, yum: '吧唧吧唧，甜甜的' },
    { id: 'carrot', name: '胡萝卜', emoji: '🥕', price: 3,  energy: 20, yum: '嘎嘣脆，眼睛会变亮哦' },
    { id: 'milk',   name: '牛奶',   emoji: '🥛', price: 4,  energy: 22, yum: '咕嘟咕嘟，好舒服' },
    { id: 'juice',  name: '果汁',   emoji: '🧃', price: 5,  energy: 18, yum: '咕噜～冰凉凉的' },
    { id: 'orb',    name: '彩色宝珠', emoji: '🔮', price: 14, energy: 70, rare: true,
      yum: '咕噜咕噜～肚子里在放小烟花！' }
  ];
  const SHOP_BY = {};
  SHOP.forEach(x => { SHOP_BY[x.id] = x; });

  /* ================= v48 · 饥饿值（v49 改为 24 小时） =================
   * 天禄有一个 0～100 的饱食度：满格 100，24 小时匀速掉到 0（每小时约 4.17），
   * 也就是一天要喂两三次才不会饿。
   * 不存「当前值」而存「每一次喂食」，打开时按时间推一遍：
   * 这样两台设备各自算出来的数字一定一样，同步时把喂食记录合起来就行。
   */
  const HUNGER_HOURS = 24;
  const HUNGER_PER_MS = 100 / (HUNGER_HOURS * 3600000);
  const FEED_KEEP_MS = 72 * 3600000;      // 只保留最近 3 天的喂食记录

  function feedLogOf() {
    return (db.pet && Array.isArray(db.pet.feedLog)) ? db.pet.feedLog : [];
  }
  /* 从空肚子开始，按时间把每次喂食的能量加上去，路上按小时掉，最多 100 */
  function satietyAt(ts) {
    const list = feedLogOf().slice().sort((a, b) => TS(a.t) - TS(b.t));
    let v = 0, last = 0;
    for (const f of list) {
      const t = TS(f.t);
      if (!t) continue;
      if (last && t > last) v = Math.max(0, v - (t - last) * HUNGER_PER_MS);
      v = Math.min(100, v + Math.max(0, Number(f.e) || 0));
      last = t;
    }
    if (last && ts > last) v = Math.max(0, v - (ts - last) * HUNGER_PER_MS);
    return Math.max(0, Math.min(100, v));
  }
  const satietyNow = () => satietyAt(Date.now());

  /* 饱食度 → 状态文案与颜色 */
  function hungerState(v) {
    if (v >= 80) return { key: 'full', text: '吃得饱饱的', face: '😋', color: '#35b37e' };
    if (v >= 55) return { key: 'ok', text: '肚子暖暖的', face: '🙂', color: '#5bbf8a' };
    if (v >= 30) return { key: 'peck', text: '有点想吃了', face: '😐', color: '#e8a33d' };
    if (v >= 10) return { key: 'hungry', text: '肚子咕咕叫', face: '🥺', color: '#e8794d' };
    if (v > 0.5) return { key: 'starve', text: '饿坏了，快喂我', face: '😣', color: '#d9534f' };
    return { key: 'empty', text: '饿扁啦…', face: '😵', color: '#c0392b' };
  }
  function satietyLeftText(v) {
    if (v <= 0.5) return '已经饿扁了，喂一口就活过来';
    const hours = v / (100 / HUNGER_HOURS);
    if (hours >= 1) return '还能撑大约 ' + Math.floor(hours) + ' 小时';
    return '还能撑大约 ' + Math.max(1, Math.round(hours * 60)) + ' 分钟';
  }
  /* 饿了（低于 30）就自动开小窝，别因为没打卡把孩子的心头肉饿坏了 */
  const petHungryOpen = () => satietyNow() < 30;

  function hungerHtml(compact) {
    const v = satietyNow();
    const st = hungerState(v);
    return '<div class="hunger-card' + (compact ? ' compact' : '') + '">' +
      '<div class="hg-top"><span class="hg-face">' + st.face + '</span>' +
      '<div class="hg-main"><b>' + st.text + '</b><span>' + satietyLeftText(v) + '</span></div>' +
      '<span class="hg-num">' + Math.round(v) + '<i>/100</i></span></div>' +
      '<div class="hg-bar"><i style="width:' + Math.max(2, v) + '%;background:' + st.color + '"></i></div>' +
      (compact ? '' : '<div class="hg-tip">饱食度 24 小时会慢慢掉光，每天来喂天禄两三次刚好～</div>') +
      '</div>';
  }

  /* v22 · 星星罐：1 颗星星 = 10 积分。星星是攒下来的成就，兑换后计入累计，不会掉徽章 */
  const STAR_RATE = 10;
  function starJarHtml() {
    const n = db.stars, gain = n * STAR_RATE;
    return '<div class="star-jar' + (n ? '' : ' empty') + '">' +
      '<div class="sj-ico">' + (n ? '⭐' : '☆') + '</div>' +
      '<div class="sj-main"><b>' + n + ' 颗星星</b><span>' +
      (n ? '1 颗星星 = ' + STAR_RATE + ' 积分，全部换掉能得 ' + gain + ' 分' : '还没有可兑换的星星，去完成作业打卡攒星星吧') +
      '</span></div>' +
      (n ? '<button class="btn sm" data-action="star-exchange">换 ' + gain + ' 积分</button>' : '') +
      '</div>';
  }
  function exchangeStars() {
    const n = db.stars;
    if (n <= 0) { toast('还没有星星可以换哦'); return; }
    const gain = n * STAR_RATE;
    db.stars = 0;
    db.starUsed = (db.starUsed || 0) + n;
    petDay();
    db.pet.points += gain;
    db.pet.pointsIn = (db.pet.pointsIn || 0) + gain;
    db.pet.log.unshift({ t: Date.now(), n: gain, r: '用 ' + n + ' 颗星星兑换' });
    db.pet.log = db.pet.log.slice(0, 40);
    save(); Sound.ok();
    toast('⭐ ' + n + ' 颗星星换到 ' + gain + ' 积分');
    render();
  }

  /* 每天自动重置「今日已赚」，防止反复刷分 */
  function petDay() {
    const t = today();
    if (db.pet.day !== t) {
      db.pet.day = t;
      db.pet.earned = { checkin: false, oral: 0, dict: 0, master: 0 };
      save();                              // 每日重置立即落盘，避免刷新后计数回滚
    }
    return db.pet;
  }
  function addPoints(n, reason) {
    if (!n || n <= 0) return;
    petDay();
    db.pet.points += n;
    db.pet.pointsIn = (db.pet.pointsIn || 0) + n;
    db.pet.log.unshift({ t: Date.now(), n: n, r: reason });
    db.pet.log = db.pet.log.slice(0, 40);
    save();
    toast('+' + n + ' 积分 · ' + reason);
  }
  function petLock() {
    const checked = !!db.checkins[today()];
    const todo = db.mistakes.filter(m => !m.mastered).length;
    return { checked: checked, todo: todo, ok: checked && todo === 0 };
  }

  /* 可爱的「吧唧」咀嚼声：低频下滑 + 带通噪声，纯 Web Audio 合成，不用音频文件 */
  function chewSound(times) {
    const c = AudioSys.get();
    if (!c) return;
    const n = times || 2;
    for (let i = 0; i < n; i++) {
      const t0 = c.currentTime + i * 0.17;
      try {
        // 「咕」的低频
        const o = c.createOscillator(), og = c.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(190 - i * 25, t0);
        o.frequency.exponentialRampToValueAtTime(72, t0 + 0.13);
        og.gain.setValueAtTime(0.0001, t0);
        og.gain.exponentialRampToValueAtTime(0.30, t0 + 0.02);
        og.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);
        o.connect(og); og.connect(c.destination);
        o.start(t0); o.stop(t0 + 0.17);
        // 「吧唧」的脆响
        const len = Math.floor(c.sampleRate * 0.09);
        const buf = c.createBuffer(1, len, c.sampleRate);
        const d = buf.getChannelData(0);
        for (let j = 0; j < len; j++) {
          const k = j / len;
          d[j] = (Math.random() * 2 - 1) * Math.pow(1 - k, 4);
        }
        const src = c.createBufferSource(); src.buffer = buf;
        const bp = c.createBiquadFilter(); bp.type = 'bandpass';
        bp.frequency.value = 1100 - i * 260; bp.Q.value = 1.1;
        const g2 = c.createGain(); g2.gain.value = 0.42;
        src.connect(bp); bp.connect(g2); g2.connect(c.destination);
        src.start(t0);
      } catch (e) { }
    }
  }

  /* ---------- 页面 ---------- */
  function renderPet() {
    petDay();
    const P = db.pet, lock = petLock();
    const hungryOpen = petHungryOpen();
    const satNow = satietyNow();
    const earnedToday = (lock.checked ? 10 : 0) + P.earned.oral * 5 + P.earned.dict * 5 + P.earned.master * 3;
    const head = '<div class="points-card">' +
      '<div class="points-main"><span>我的积分</span><b>' + P.points + '</b></div>' +
      '<div class="points-meta">今天赚了 <b>' + earnedToday + '</b> 分 · 累计喂天禄 <b>' + P.fed + '</b> 次 · 亲密度 <b>' + P.fondness + '</b></div>' +
      '<div class="points-tip">做作业打卡 +10 · 口算练习 +5（全对 +8）· 英语听写 +5（全对 +8）· 弄懂一道错题 +3<br>星星也能当钱花：<b>1 颗星星 = 10 积分</b></div>' +
      '</div>';

    if (!lock.ok && !hungryOpen) {
      const rows = [
        { ok: lock.checked, text: '完成今天的作业打卡', hint: lock.checked ? '已完成' : '还没打卡' },
        { ok: lock.todo === 0, text: '把错题本里的题都弄懂', hint: lock.todo === 0 ? '全部掌握' : '还剩 ' + lock.todo + ' 道' }
      ];
      return '<div class="pet-page">' + head + hungerHtml(true) + starJarHtml() +
        '<div class="lock-card">' +
        '<div class="lock-emoji">🔒</div>' +
        '<h2>天禄的小窝还没开门</h2>' +
        '<p>先把今天的学习任务做完，天禄才肯出来吃东西哦～</p>' +
        '<div class="lock-list">' + rows.map(r =>
          '<div class="lock-row ' + (r.ok ? 'done' : '') + '">' +
          '<span class="lock-dot">' + (r.ok ? '✓' : '·') + '</span>' +
          '<span class="lock-t">' + r.text + '</span>' +
          '<span class="lock-h">' + r.hint + '</span></div>').join('') + '</div>' +
        '<div class="btn-row" style="justify-content:center;margin-top:16px">' +
        (!lock.checked ? '<button class="btn" data-action="nav" data-tab="home">去完成作业打卡</button>' : '') +
        (lock.todo > 0 ? '<button class="btn ghost" data-action="nav" data-tab="mistakes">去弄懂错题</button>' : '') +
        '</div></div>' + shopHtml() + '</div>';
    }

    const owned = SHOP.filter(x => P.food[x.id] > 0);
    const shelf = owned.length ?
      owned.map(x => '<div class="food" data-food="' + x.id + '" role="button" aria-label="把' + x.name + '拖给天禄">' +
        '<span class="food-emoji">' + x.emoji + '</span>' +
        '<span class="food-count">×' + P.food[x.id] + '</span></div>').join('') :
      '<div class="shelf-empty">柜子空空的<br><span>用积分换点吃的吧</span></div>';

    /* 饿的时候没打卡也开门，但要说清楚原因，别让孩子以为规则变了 */
    const unlockedByHunger = hungryOpen && !lock.ok;
    return '<div class="pet-page">' + head + hungerHtml() + (unlockedByHunger ?
      '<div class="hg-note">天禄饿得等不及了，今天先喂它，作业打卡别忘了补上哦～</div>' : '') + starJarHtml() +
      '<div class="yard">' +
      '<div class="yard-pet">' +
      '<div class="mouth-zone" id="mouthZone" data-action="pet-tap" role="button" aria-label="点一点天禄，听它说话">' +
      '<img class="yard-img' + (petPic() ? ' custom' : '') + '" id="yardPet" src="' + esc(petPic()) + '" alt="天禄" draggable="false">' +
      '<div class="mouth-ring"></div>' +
      '</div>' +
      '<div class="yard-bubble" id="yardBubble">' + (petFeedMsg ?
        '<b>吧唧吧唧～</b>' + esc(petFeedMsg) :
        petPatMsg ? '<b>天禄：</b>' + esc(petPatMsg) :
        (satNow < 30 ? '饿得直哼哼…快喂我一口吧～' : '点一下我，或者把零食拖到我嘴边～')) + '</div>' +
      '</div>' +
      '<div class="shelf"><div class="shelf-title">我的零食柜</div>' +
      '<div class="shelf-list" id="shelfList">' + shelf + '</div>' +
      '<div class="shelf-hint">按住拖到天禄嘴边</div></div>' +
      '</div>' + shopHtml() + '</div>';
  }

  function shopHtml() {
    const P = db.pet;
    return '<div class="shop-card"><div class="card-h" style="margin-bottom:12px">' +
      '<h2>积分商城</h2><span class="sub">攒积分换零食，喂给天禄吃</span></div>' +
      '<div class="shop-grid">' + SHOP.map(x =>
        '<div class="shop-item' + (x.rare ? ' rare' : '') + '">' +
        '<div class="shop-emoji">' + x.emoji + '</div>' +
        '<div class="shop-name">' + x.name + '</div>' +
        '<button class="shop-buy' + (P.points < x.price ? ' poor' : '') + '" data-action="buy-food" data-id="' + x.id + '">' +
        x.price + ' 分</button></div>').join('') + '</div></div>';
  }

  /* 把食物喂给天禄：扣库存、播咀嚼声、做动画 */
  let feeding = false;
  let petFeedMsg = '';          // 刚吃过的东西，重绘后气泡还能显示
  let petPatMsg = '';           // 刚被摸过时说的话，重绘后气泡还能显示
  function feedPet(id) {
    const P = db.pet;
    if (!P.food[id] || !SHOP_BY[id]) return;
    if (feeding) return;
    /* v48：已经吃得饱饱的，再喂既吃不下也浪费，先拦一下 */
    if (satietyNow() >= 99) { toast('天禄已经吃得饱饱的啦，等它消化一下再喂～'); return; }
    feeding = true;
    const energy = SHOP_BY[id].energy || 16;
    P.food[id]--;
    if (P.food[id] <= 0) delete P.food[id];
    P.fed++; P.fondness++;
    /* v48：记下这次喂食，饱食度按时间推出来 */
    P.feedLog = Array.isArray(P.feedLog) ? P.feedLog : [];
    P.feedLog.push({ t: Date.now(), e: energy });
    P.feedLog = P.feedLog.filter(f => TS(f.t) >= Date.now() - FEED_KEEP_MS).slice(-80);
    save();
    AudioSys.wake();
    chewSound(SHOP_BY[id].rare ? 4 : 2);
    const img = document.getElementById('yardPet');
    const zone = document.getElementById('mouthZone');
    if (img) { img.classList.add('eating'); setTimeout(() => img.classList.remove('eating'), 720); }
    if (zone) { zone.classList.add('hot'); setTimeout(() => zone.classList.remove('hot'), 720); }
    petFeedMsg = SHOP_BY[id].yum;
    clearTimeout(feedPet._t);
    feedPet._t = setTimeout(() => { petFeedMsg = ''; }, 5000);
    const b = document.getElementById('yardBubble');
    if (b) b.innerHTML = '<b>吧唧吧唧～</b>' + esc(SHOP_BY[id].yum);
    // 每喂 3 次，天禄说一句鼓励的话（有语音包，可爱一点）
    if (P.fed % 3 === 0 && db.settings.petVoice !== false) {
      const i = Math.floor(Math.random() * PET_VOICES.length);
      setTimeout(() => speakPet(i, PET_VOICES[i].say, null), 800);
    }
    setTimeout(() => { feeding = false; render(); }, 760);
  }

  /* 拖拽：pointer 事件，鼠标和 iPad 触摸都能用；没拖动就是点击，直接喂 */
  let dragFood = null;
  function foodDragStart(e) {
    const el = e.target.closest ? e.target.closest('[data-food]') : null;
    if (!el) return;
    if (!petLock().ok) return;
    const r = el.getBoundingClientRect();
    const ghost = el.cloneNode(true);
    ghost.className = 'food-ghost';
    ghost.style.width = r.width + 'px';
    ghost.style.height = r.height + 'px';
    ghost.style.left = r.left + 'px';
    ghost.style.top = r.top + 'px';
    document.body.appendChild(ghost);
    dragFood = { id: el.dataset.food, ghost: ghost, sx: e.clientX, sy: e.clientY, moved: false, src: el };
    el.classList.add('dragging');
    document.addEventListener('pointermove', foodDragMove);
    document.addEventListener('pointerup', foodDragEnd);
    document.addEventListener('pointercancel', foodDragEnd);
  }
  function foodDragMove(e) {
    if (!dragFood) return;
    const dx = e.clientX - dragFood.sx, dy = e.clientY - dragFood.sy;
    if (!dragFood.moved && Math.abs(dx) + Math.abs(dy) > 6) dragFood.moved = true;
    dragFood.ghost.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(1.15)';
    const zone = document.getElementById('mouthZone');
    if (zone) zone.classList.toggle('hot', overMouth(e.clientX, e.clientY));
  }
  function overMouth(x, y) {
    const zone = document.getElementById('mouthZone');
    if (!zone) return false;
    const r = zone.getBoundingClientRect();
    const cy = r.top + r.height * 0.68;      // 嘴在脸的下部
    const cx = r.left + r.width / 2;
    const rad = Math.min(r.width, r.height) * 0.42;
    return Math.hypot(x - cx, y - cy) < rad;
  }
  function foodDragEnd(e) {
    if (!dragFood) return;
    const d = dragFood;
    dragFood = null;
    document.removeEventListener('pointermove', foodDragMove);
    document.removeEventListener('pointerup', foodDragEnd);
    document.removeEventListener('pointercancel', foodDragEnd);
    if (d.src) d.src.classList.remove('dragging');
    const zone = document.getElementById('mouthZone');
    const hit = d.moved ? overMouth(e.clientX, e.clientY) : true;   // 轻点也算喂
    if (zone) zone.classList.remove('hot');
    if (hit) {
      // 飞进嘴里：缩小 + 向嘴心移动
      const zr = zone ? zone.getBoundingClientRect() : null;
      if (zr) {
        const g = d.ghost.getBoundingClientRect();
        const toX = zr.left + zr.width / 2 - (g.left + g.width / 2);
        const toY = zr.top + zr.height * 0.68 - (g.top + g.height / 2);
        d.ghost.style.transition = 'transform .22s ease-in, opacity .22s ease-in';
        d.ghost.style.transform = 'translate(' + toX + 'px,' + toY + 'px) scale(.2)';
        d.ghost.style.opacity = '0';
      }
      setTimeout(() => { if (d.ghost.parentNode) d.ghost.parentNode.removeChild(d.ghost); }, 240);
      feedPet(d.id);
    } else {
      d.ghost.style.transition = 'transform .2s ease, opacity .2s ease';
      d.ghost.style.transform = 'translate(0,0) scale(.9)';
      d.ghost.style.opacity = '0';
      setTimeout(() => { if (d.ghost.parentNode) d.ghost.parentNode.removeChild(d.ghost); }, 210);
      const b = document.getElementById('yardBubble');
      if (b) b.innerHTML = '要拖到天禄嘴边才可以吃哦～';
    }
  }

  /* v49：点一下天禄 —— 说一句话、弹一下、冒爱心。
     和喂食共用同一个气泡，所以优先顺序是：正在吃 > 刚摸过 > 默认提示。 */
  let petPatLock = 0;
  function petTap() {
    if (dragFood || feeding) return false;
    const now = Date.now();
    if (now - petPatLock < 300) return false;      // 连点只算一次，别叠音
    petPatLock = now;
    const idx = Math.floor(Math.random() * PET_VOICES.length);
    const item = PET_VOICES[idx];
    const speechOn = db.settings.petVoice !== false;
    petPatMsg = item.text;
    clearTimeout(petTap._t);
    petTap._t = setTimeout(() => { petPatMsg = ''; }, 7000);
    const b = document.getElementById('yardBubble');
    if (b) b.innerHTML = '<b>天禄：</b>' + esc(item.text);
    const img = document.getElementById('yardPet');
    if (img) {
      img.classList.remove('patting');
      void img.offsetWidth;                        // 强制重排，连点也能重新播动画
      img.classList.add('patting');
      setTimeout(() => { try { img.classList.remove('patting'); } catch (e) { } }, 720);
    }
    petHearts();
    Sound.ok();
    if (speechOn) speakPet(idx, item.say, null);
    return true;
  }
  /* 冒几颗爱心：贴在嘴边，CSS 动画往上飘 */
  function petHearts() {
    const zone = document.getElementById('mouthZone');
    if (!zone) return;
    const box = document.createElement('div');
    box.className = 'pet-hearts';
    ['💗', '✨', '💕'].forEach((ch, i) => {
      const s = document.createElement('i');
      s.textContent = ch;
      s.style.left = (30 + i * 19) + '%';
      s.style.animationDelay = (i * 90) + 'ms';
      box.appendChild(s);
    });
    zone.appendChild(box);
    setTimeout(() => { if (box.parentNode) box.parentNode.removeChild(box); }, 1600);
  }

  /* ---------------- 渲染入口 ---------------- */
  function render() {
    applyCanvas();
    seedDayTasks();                    // v50：把今天的基础任务补进清单（幂等）
    renderNav(); renderTop(); renderSide();
    const v = $('#view');
    v.innerHTML = S.tab === 'home' ? renderHome() : S.tab === 'dict' ? renderDict() : S.tab === 'math' ? renderMath()
      : S.tab === 'oral' ? renderOral() : S.tab === 'pet' ? renderPet() : renderMistakes();
    if (S.tab === 'dict' && S.dict.stage === 'run' && !S.dict.checked) {
      const el = v.querySelector('.spell-input'); if (el) el.focus();
    }
    if (S.tab === 'math' && S.math.tab === 'practice' && S.math.quiz.ids.length && S.math.quiz.idx < S.math.quiz.ids.length && !S.math.quiz.checked) {
      const el = v.querySelector('[data-model="quiz.input"]'); if (el) el.focus();
    }
    ensureOralTimer();

  }

  /* ---------------- 动作 ---------------- */
  const H = {
    nav(el) {
      if (el.dataset.tab !== 'mistakes') { stopChinese(); S.mk.speakingId = null; }
      S.tab = el.dataset.tab; window.scrollTo({ top: 0, behavior: 'smooth' }); render();
    },
    'close-modal'() {
      if (S.baseEdit) closeBaseModal();      /* v51：基础任务编辑弹窗 → 回设置页 */
      else closeModal();
    },
    mask(el, e) {
      if (e.target !== el) return;
      if (S.baseEdit) closeBaseModal();
      else closeModal();
    },
    'cal-prev'() { S.cal.m--; if (S.cal.m < 0) { S.cal.m = 11; S.cal.y--; } render(); },
    'cal-next'() { S.cal.m++; if (S.cal.m > 11) { S.cal.m = 0; S.cal.y++; } render(); },

    /* 作业 */
    'add-task'() {
      const c = $('#taskContent').value.trim(), sub = $('#taskSubject').value;
      const min = Math.min(180, Math.max(1, parseInt($('#taskMinutes').value, 10) || 20));
      if (!c) { toast('先写一下作业内容'); $('#taskContent').focus(); return; }
      const list = tasks(today()); list.push({ id: uid(), subject: sub, content: c, minutes: min, done: false });
      db.tasks[today()] = list; save(); render(); toast('已添加');
    },
    'add-tmpl'(el) {
      const t = D.taskTemplates[+el.dataset.i];
      const list = tasks(today());
      if (list.some(x => x.content === t.content)) { toast('这项已经在清单里了'); return; }
      list.push({ id: uid(), subject: t.subject, content: t.content, minutes: t.minutes, done: false });
      db.tasks[today()] = list; save(); render(); toast('已添加：' + t.content);
    },
    'toggle-task'(el) {
      const t = tasks(today()).find(x => x.id === el.dataset.id); if (!t) return;
      t.done = !t.done;
      /* v52：记下最后一次勾选/取消的时间。同步合并时按时间取新的，
         否则本机取消勾选会被另一台（或云端旧数据）的 done:true 又盖回来 */
      t.doneAt = Date.now();
      save(); render();
      if (t.done) Sound.tick(); else Sound.click();
      const list = tasks(today());
      if (list.length && list.every(x => x.done)) { toast('全部完成啦，记得打卡'); confetti(); }
    },
    'del-task'(el) {
      const id = el.dataset.id, day = today();
      db.tasks[day] = tasks(day).filter(x => x.id !== id);
      /* v50：删的是基础任务就记一笔，否则下次打开（或另一台设备）又会自动补回来 */
      if (String(id).indexOf('base:') === 0) {
        db.taskGone = db.taskGone || {};
        db.taskGone[day + '|' + id] = Date.now();
        trimMap(db.taskGone, 400);
      }
      save(); render();
    },

    /* ---------- v50：每日基础任务（v51 起入口在设置弹窗里） ---------- */
    'base-open'() { S.baseBack = true; openBaseEdit(); },   /* 记住要回设置页 */
    'base-close'() { closeBaseModal(); },
    'base-add'() {
      collectBaseEdit();
      S.baseEdit.push({ subject: '语文', content: '', minutes: 20, days: [0, 1, 2, 3, 4, 5, 6] });
      openModal(baseEditToHtml());
      const i = S.baseEdit.length - 1;
      setTimeout(() => {
        const el = document.querySelector('.ba-row[data-row="' + i + '"] [data-ba="content"]');
        if (el) el.focus();
      }, 60);
    },
    'base-del'(el) {
      collectBaseEdit();
      S.baseEdit.splice(+el.dataset.i, 1);
      openModal(baseEditToHtml());
    },
    'base-day'(el) {
      collectBaseEdit();
      const i = +el.dataset.i, d = +el.dataset.d;
      const cur = S.baseEdit[i];
      if (!cur) return;
      let days = Array.isArray(cur.days) && cur.days.length ? cur.days.slice() : [0, 1, 2, 3, 4, 5, 6];
      if (days.indexOf(d) >= 0) {
        if (days.length === 1) { toast('至少要留一天哦'); return; }
        days = days.filter(x => x !== d);
      } else days.push(d);
      cur.days = days.sort((a, b) => a - b);
      refreshBaseDays(i);
    },
    'base-all'(el) {
      collectBaseEdit();
      const days = String(el.dataset.days).split(',').map(Number);
      (S.baseEdit || []).forEach(b => { b.days = days.slice(); });
      openModal(baseEditToHtml());
    },
    'base-save'() {
      collectBaseEdit();
      const list = [], seen = new Set();
      (S.baseEdit || []).forEach(b => {
        const c = String(b.content || '').trim();
        if (!c) return;                                  // 空行直接忽略
        const k = baseKeyOf({ subject: b.subject, content: c });
        if (seen.has(k)) return;                          // 内容重复只留一条
        seen.add(k);
        const days = (Array.isArray(b.days) && b.days.length) ? b.days.slice().sort((x, y) => x - y) : [0, 1, 2, 3, 4, 5, 6];
        list.push({
          subject: b.subject || '其他', content: c,
          minutes: Math.min(180, Math.max(1, b.minutes | 0 || 20)), days
        });
      });
      /* 删掉的项记进 baseGone，重新加回来的从名单里划掉 —— 不然另一台同步时又会补回来 */
      const oldKeys = new Set(baseTasksOf().map(baseKeyOf));
      const newKeys = new Set(list.map(baseKeyOf));
      oldKeys.forEach(k => { if (!newKeys.has(k)) db.baseGone[k] = Date.now(); });
      newKeys.forEach(k => { if (db.baseGone[k]) delete db.baseGone[k]; });
      trimMap(db.baseGone, 400);
      db.baseTasks = list;
      save();
      const n = seedDayTasks();
      S.baseEdit = null;
      render();
      closeBaseModal();                      /* v51：从设置进来就回设置页（保留未保存的设置草稿） */
      toast(list.length
        ? '已保存 ' + list.length + ' 项基础任务' + (n ? '，今天补了 ' + n + ' 项' : '')
        : '已清空基础任务');
    },
    checkin() {
      const list = tasks(today());
      if (!list.length) { toast('先添加今天的作业吧'); return; }
      const done = list.filter(t => t.done).length;
      if (!done) { toast('至少完成一项才能打卡哦'); return; }
      if (db.checkins[today()]) { toast('今天已经打过卡啦'); return; }
      const rate = done / list.length;
      const stars = Math.max(1, Math.round(rate * 3));
      db.checkins[today()] = { rate: rate, stars: stars, ts: Date.now(), done: done, total: list.length };
      addStars(stars);
      if (!petDay().earned.checkin) { db.pet.earned.checkin = true; addPoints(10, '完成作业打卡'); }
      render(); confetti(); Sound.win();
      toast(rate >= 1 ? '太棒了！全部完成，获得 ' + stars + ' 颗星星' : '打卡成功，完成 ' + Math.round(rate * 100) + '%，获得 ' + stars + ' 颗星星');
    },

    /* ---- v41 家庭同步 ---- */
    'sync-start'() {
      openModal('<div class="modal wide">' + modalHead('开启家庭同步') +
        '<div class="tiny muted" style="line-height:2">' +
        '<b>1.</b> 点下面的按钮打开 GitHub（先在这台设备上登录自己的账号）。<br>' +
        '<b>2.</b> Note 随便写（例如 xiaobu），Expiration 选 <b>No expiration</b>，Scopes 只勾 <b>repo</b>（已经帮你预选好）。<br>' +
        '<b>3.</b> 拉到底点 <b>Generate token</b>，复制那串 <b>ghp_</b> 开头的字符。<br>' +
        '<b>4.</b> 粘到下面，点「连接」。' +
        '</div>' +
        '<div class="btn-row" style="margin:14px 0 10px"><button class="btn sm" data-action="sync-open-github">' + ic('arrow', 'sm') + '去 GitHub 创建令牌</button>' +
        '<button class="btn ghost sm" data-action="copy-sync-url">' + ic('download', 'sm') + '复制创建链接</button></div>' +
        '<div class="tiny muted" style="margin-bottom:4px">点按钮没反应？主屏幕应用有时拦掉新窗口——点「复制创建链接」，到 <b>Safari</b> 里粘贴打开就行。用哪台设备创建都行，令牌是跟着账号走的。</div>' +
        '<div class="field"><label>粘贴令牌（只保存在这台设备）</label>' +
        '<input class="input" id="syncToken" placeholder="ghp_..." autocomplete="off" autocapitalize="off" spellcheck="false"></div>' +
        '<div class="tiny muted" style="margin-top:8px;line-height:1.8">令牌相当于这个账号的钥匙，<b>只存在本机浏览器里</b>，不会上传到别处，随时能在 GitHub 设置里撤销。' +
        '另一台设备用<b>同一个账号</b>重复一次这一步，两台就开始自动同步了。</div>' +
        '<div class="modal-foot" style="margin-top:14px"><button class="btn ghost" data-action="close-modal">取消</button>' +
        '<button class="btn" data-action="sync-save">连接</button></div></div>');
    },
    'sync-open-github'() {
      const url = 'https://github.com/settings/tokens/new?scopes=repo&description=xiaobu-study-sync';
      let ok = false;
      try {
        const w = window.open(url, '_blank');
        ok = !!w && !w.closed;
        if (w) { try { w.opener = null; } catch (e) {} }
      } catch (e) { ok = false; }
      if (ok) return;
      /* iOS 主屏幕应用经常拦掉新窗口：给出可复制的链接 + 应用内打开两条退路 */
      const shown = 'https://github.com/settings/tokens/new?scopes=repo&description=xiaobu-study-sync';
      openModal('<div class="modal">' + modalHead('用 Safari 打开这个链接') +
        '<div class="tiny muted" style="line-height:1.9">在哪台设备上创建都行（令牌跟着账号走）。复制下面的地址，到 <b>Safari</b> 里粘贴打开并登录 GitHub：</div>' +
        '<textarea class="input" rows="3" readonly onclick="this.focus();this.select()" style="font-size:12px">' + esc(shown) + '</textarea>' +
        '<div class="btn-row" style="margin-top:10px"><button class="btn ghost sm" data-action="copy-sync-url">' + ic('download', 'sm') + '复制链接</button>' +
        '<button class="btn sm" data-action="sync-goto-github">在本应用中打开</button></div>' +
        '<div class="tiny muted" style="margin-top:8px">「在本应用中打开」会离开小步陪伴一会儿，创建完令牌后从主屏幕图标重新进来即可，记录不会丢。</div>' +
        '<div class="modal-foot" style="margin-top:14px"><button class="btn ghost" data-action="close-modal">关闭</button></div></div>');
    },
    'copy-sync-url'() {
      const t = 'https://github.com/settings/tokens/new?scopes=repo&description=xiaobu-study-sync';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t).then(() => toast('链接已复制，去 Safari 里粘贴打开'), () => toast('长按方框里的地址手动复制'));
      } else toast('长按方框里的地址手动复制');
    },
    'sync-goto-github'() {
      location.href = 'https://github.com/settings/tokens/new?scopes=repo&description=xiaobu-study-sync';
    },
    async 'sync-save'() {
      const el = document.getElementById('syncToken');
      const t = (el ? el.value : '').trim().replace(/\s+/g, '');
      if (!t) { toast('先把令牌粘贴进来'); return; }
      if (!/^(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})$/.test(t)) {
        toast('格式不对，应该是以 ghp_ 开头的一长串'); return;
      }
      const btn = document.querySelector('[data-action="sync-save"]');
      if (btn) { btn.disabled = true; btn.textContent = '连接中…'; }
      const old = db.sync.token;
      db.sync.token = t;
      try {
        const me = await gh('/user');
        if (me.status === 401) throw new Error('令牌无效，检查有没有复制完整');
        if (!me.ok || !me.data || !me.data.login) throw new Error('连接失败（' + me.status + '）');
        db.sync.owner = me.data.login;
        db.sync.on = true;
        db.sync.updatedAt = Date.now();
        persist();
        closeModal();
        toast('已连接 ' + me.data.login + '，正在同步…');
        await syncNow('connect');
        if (SYNC.state === 'err') toast('连接成功，但同步出错：' + SYNC.err);
        H['open-settings']();
      } catch (e) {
        db.sync.token = old;
        db.sync.on = false;
        persist();
        if (btn) { btn.disabled = false; btn.textContent = '连接'; }
        toast(String((e && e.message) || e));
      }
    },
    'sync-now'() {
      if (SYNC.busy) { toast('正在同步，稍等一下'); return; }
      syncNow('manual').then(st => {
        if (st === 'ok') toast('已同步 · ' + syncAgo(db.sync.lastAt));
        else if (st === 'err') toast('同步失败：' + syncErrText(SYNC.err));
      });
    },
    /* v47：另一台已经清空、这台还留着旧错题时，一键对齐（不必一条条删） */
    'sync-clear-mk'() {
      const n = db.mistakes.length;
      if (!n) { toast('这台设备上已经没有错题了'); return; }
      openModal('<div class="modal">' + modalHead('清空本机的错题本？') +
        '<div class="tiny muted" style="line-height:1.9">这台设备上的 <b>' + n + ' 道错题</b>会全部删掉，并同步到另一台设备（那边也会一起清空）。<br>' +
        '打卡、星星、作业和设置都不受影响。删除后无法撤销。</div>' +
        '<div class="modal-foot"><button class="btn ghost" data-action="close-modal">取消</button>' +
        '<button class="btn coral" data-action="sync-clear-mk-confirm">确认清空</button></div></div>');
    },
    'sync-clear-mk-confirm'() {
      const n = db.mistakes.length;
      db.mistakes.forEach(m => buryMistake(m));
      db.mistakes = [];
      save(); closeModal(); render();
      syncNow('manual').then(st => {
        toast(st === 'ok' ? '已清空 ' + n + ' 道错题并同步' : '已清空 ' + n + ' 道错题（同步稍后自动重试）');
      });
    },
    'sync-off'() {
      openModal('<div class="modal">' + modalHead('关闭同步？') +
        '<div class="tiny muted" style="line-height:1.9">关闭后这台设备不再上传和下载，<b>本机记录完整保留</b>，GitHub 上的同步文件也不会删除。以后想再开，重新连接一次即可。</div>' +
        '<div class="modal-foot" style="margin-top:14px"><button class="btn ghost" data-action="close-modal">再想想</button>' +
        '<button class="btn coral" data-action="sync-off-confirm">关闭同步</button></div></div>');
    },
    'sync-off-confirm'() {
      db.sync.on = false; db.sync.token = ''; db.sync.sha = ''; db.sync.err = '';
      persist(); closeModal(); toast('已关闭同步，本机记录都还在');
      H['open-settings']();
    },

    /* 设置 */
    'open-settings'() {
      /* v51：从「每日基础任务」弹窗回来时保留已输入未保存的草稿（keepDraft），
         正常打开设置则从 db.settings 重新取一份 */
      if (!S.keepDraft || !S.draft) S.draft = JSON.parse(JSON.stringify(db.settings));
      S.keepDraft = false;
      const d = S.draft;
      const voiceOpts = '<option value="">自动选择最佳人声</option>' + englishVoices().map(v =>
        '<option value="' + esc(v.voiceURI) + '"' + (d.voiceURI === v.voiceURI ? ' selected' : '') + '>' +
        esc((v.name || 'Voice') + ' · ' + v.lang) + '</option>').join('');
      const canvasOpts = [
        ['follow', '跟随 iPad 方向（横屏 / 竖屏自动切换 · 推荐）'],
        ['ipad11', 'iPad 11 英寸：横 1180×820 / 竖 834×1194'],
        ['ipad', 'iPad 10.9 英寸：横 1024×768 / 竖 768×1024'],
        ['ipadpro', 'iPad Pro 12.9 英寸：横 1366×1024 / 竖 1024×1366'],
        ['ipad_h', '只锁横屏（竖过来也不换布局）'],
        ['auto', '自适应窗口（铺满屏幕）']
      ].map(o => '<option value="' + o[0] + '"' + ((d.canvas || 'follow') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('');
      const vol = d.soundVolume == null ? 50 : Math.round(d.soundVolume * 100);
      const zhSel = String(d.zhVoiceURI || '');
      const zhVoiceOpts =
        '<option value="pet"' + (zhSel === '' || zhSel === 'pet' ? ' selected' : '') + '>天禄的声音（推荐 · 和宠物同一个声音）</option>' +
        '<option value="online"' + (zhSel === 'online' ? ' selected' : '') + '>在线真人发音（不是天禄的声音）</option>' +
        '<option value="device"' + (zhSel === 'device' ? ' selected' : '') + '>设备朗读（离线可用）</option>' +
        chineseVoices().map(v =>
          '<option value="' + esc(v.voiceURI) + '"' + (zhSel === v.voiceURI ? ' selected' : '') + '>设备 · ' +
          esc((v.name || 'Voice') + ' ' + v.lang) + '</option>').join('');
      openModal('<div class="modal wide">' + modalHead('设置') +
        '<div class="form-row">' +
        '<div class="field"><label>孩子的名字 / 昵称</label><input class="input" data-model="draft.name" value="' + esc(d.name) + '" placeholder="例：朵朵"></div>' +
        '<div class="field"><label>每日星星目标</label><input class="input" type="number" min="1" max="20" data-model="draft.goal" value="' + d.goal + '"></div></div>' +

        '<div class="divider"></div><div class="section-title">画面</div>' +
        '<div class="field"><label>固定画布尺寸（不缩放、不随窗口重排）</label>' +
        '<select class="input" data-model="draft.canvas">' + canvasOpts + '</select></div>' +
        '<div class="tiny muted" style="margin-top:6px">选「跟随 iPad 方向」后，把 iPad 转成竖屏会自动换成竖屏布局：导航搬到顶部、内容改成单列、口算数字键盘移到题目下方。<b>画面始终按 1:1 显示，不缩放、不拉伸</b>；屏幕比画布大时居中留白。iPad 仍允许系统级双指放大（苹果的无障碍设置，网页无法禁用）。</div>' +

        '<div class="divider"></div><div class="section-title">英语发音</div>' +
        '<div class="form-row">' +
        '<div class="field"><label>发音来源</label><select class="input" data-model="draft.voiceMode">' +
        '<option value="recorded"' + (d.voiceMode !== 'tts' ? ' selected' : '') + '>高清预录发音（推荐 · 离线可播）</option>' +
        '<option value="tts"' + (d.voiceMode === 'tts' ? ' selected' : '') + '>浏览器朗读</option></select></div>' +
        '<div class="field"><label>每个词读几遍</label><select class="input" data-model="draft.repeat">' +
        '<option value="1"' + (!d.repeat ? ' selected' : '') + '>1 遍</option>' +
        '<option value="2"' + (d.repeat ? ' selected' : '') + '>2 遍（听写更从容）</option></select></div></div>' +
        '<div class="form-row" style="margin-top:10px">' +
        '<div class="field"><label>朗读语速（预录音与浏览器朗读都生效）</label><input class="input" type="number" step="0.05" min="0.5" max="1.2" data-model="draft.rate" value="' + d.rate + '"></div>' +
        '<div class="field"><label>浏览器人声</label><select class="input" data-model="draft.voiceURI">' + voiceOpts + '</select></div></div>' +
        '<div class="btn-row" style="margin-top:10px"><button class="btn ghost sm" data-action="try-voice">' + ic('volume', 'sm') + '试听 plate</button>' +
        '<span class="tiny muted">点试听会告诉你是哪种发音。内置 ' + D.wordUnits.reduce((a, u) => a + u.words.length, 0) + ' 个课本单词配高清预录人声；手动输入的词和没缓存上的词，自动改用下面的在线真人发音。</span></div>' +
        '<div class="form-row" style="margin-top:10px">' +
        '<div class="field narrow"><label>在线真人发音（兜底）</label><select class="input" data-model="draft.onlineVoice">' +
        '<option value="1"' + (d.onlineVoice !== false ? ' selected' : '') + '>开启</option>' +
        '<option value="0"' + (d.onlineVoice === false ? ' selected' : '') + '>关闭</option></select></div>' +
        '<div class="field"><label>&nbsp;</label><div class="tiny muted" style="padding-top:8px">手动输入的词、或没缓存上的课本词，自动用在线真人发音（有道词典，需联网）；发音内容会发给有道服务器。关闭则退回 iPad 自带朗读。</div></div></div>' +
        '<div class="tiny muted" style="margin-top:6px">如果听到的还是旧的机器朗读：到「设置 → 版本与更新」点一次「检查更新并刷新」即可，打卡记录不会丢。</div>' +

        '<div class="divider"></div><div class="section-title">AI 讲错题 · 声音（普通话）</div>' +
        '<div class="field"><label>讲解用谁的声音</label><select class="input" data-model="draft.zhVoiceURI">' + zhVoiceOpts + '</select>' +
        '<div class="tiny muted" style="margin-top:6px">「天禄的声音」是把讲题的固定句式、知识点提前录好的（6 种声线跟着「天禄的声音」走），题目和答案会显示在屏幕上；换成别的选项则改为在线合成整句朗读。</div></div>' +
        '<div class="btn-row" style="margin-top:10px"><button class="btn ghost sm" data-action="try-zh">' + ic('volume', 'sm') + '试听普通话讲解</button>' +
        '<span class="tiny muted">点一下用当前选项试听一句。孩子听着别扭就换个选项。</span></div>' +

        '<div class="divider"></div><div class="section-title">音效</div>' +
        '<div class="form-row">' +
        '<div class="field narrow"><label>点击 / 完成音效</label><select class="input" data-model="draft.sound">' +
        '<option value="1"' + (d.sound !== false ? ' selected' : '') + '>开启</option>' +
        '<option value="0"' + (d.sound === false ? ' selected' : '') + '>关闭</option></select></div>' +
        '<div class="field"><label>音量 <span id="volLabel">' + vol + '%</span></label>' +
        '<input type="range" min="0" max="100" step="5" value="' + vol + '" data-model="draft.soundVolume" style="width:100%;accent-color:var(--primary)"></div></div>' +
        '<div class="form-row" style="margin-top:10px">' +
        '<div class="field narrow"><label>天禄的语音</label><select class="input" data-model="draft.petVoice">' +
        '<option value="1"' + (d.petVoice !== false ? ' selected' : '') + '>开启（点一下就会说话）</option>' +
        '<option value="0"' + (d.petVoice === false ? ' selected' : '') + '>关闭（只显示文字）</option></select></div>' +
        '<div class="field"><label>&nbsp;</label><button class="btn ghost sm" data-action="try-pet">' + ic('volume', 'sm') + '听天禄说一句</button></div></div>' +
        '<div class="field" style="margin-top:10px"><label>天禄的声音（点一下试听并选中）</label>' +
        '<div class="btn-row" style="gap:8px;flex-wrap:wrap">' +
        PET_STYLES.map(v => '<button class="btn ' + (petStyle() === v.id ? '' : 'ghost ') + 'sm" data-action="pick-pet-voice" data-style="' + v.id + '">' +
          (petStyle() === v.id ? ic('check', 'sm') : ic('volume', 'sm')) + v.name + '<span class="tiny muted"> · ' + v.desc + '</span></button>').join('') +
        '</div></div>' +
        '<div class="tiny muted" style="margin-top:6px">天禄的话全部是<b>预录的可爱人声</b>，已经存进 App，断网也能听，不受 iPad 系统朗读音色影响。音效由设备实时合成、不加载文件。iPad 侧边静音开关打开时声音会被系统静音，关掉即可听到。</div>' +

        '<div class="divider"></div><div class="section-title">宠物形象（自定义上传）</div>' +
        '<div class="pet-look">' +
          '<div class="pl-item"><div class="pl-box"><img id="plAvatar" src="' + esc(db.pet.avatar || 'icons/pipi-lg.png?v=35') + '" alt="首页头像"></div>' +
            '<span>首页头像</span>' +
            '<button class="btn ghost sm" data-action="pet-img" data-which="avatar">' + ic('image', 'sm') + '上传</button></div>' +
          '<div class="pl-item"><div class="pl-box tall"><img id="plPic" src="' + esc(petPic()) + '" alt="小窝里的天禄"></div>' +
            '<span>小窝里的宠物</span>' +
            '<button class="btn ghost sm" data-action="pet-img" data-which="pic">' + ic('image', 'sm') + '上传</button></div>' +
          '<div class="pl-tip">可以用相册里的照片、孩子画的画，或网上下载的图。图片会自动裁成方形并压缩，<b>只存在这台设备</b>，不会上传。只传一张时，首页和小窝都用它。</div>' +
        '</div>' +
        '<input type="file" id="petImgAvatar" accept="image/*" data-petimg="avatar" class="sr-file" onclick="event.stopPropagation()">' +
        '<input type="file" id="petImgPic" accept="image/*" data-petimg="pic" class="sr-file" onclick="event.stopPropagation()">' +
        '<div class="btn-row" style="margin-top:10px">' +
          '<button class="btn ghost sm" data-action="pet-img-reset">' + ic('refresh', 'sm') + '恢复默认天禄</button>' +
          '<span class="tiny muted">自定义后发音、喂食、积分都不受影响。</span></div>' +

        '<div class="divider"></div><div class="section-title">每日基础任务</div>' +
        (function () {
          const bAll = baseTasksOf();
          const bOn = bAll.filter(b => baseOnDay(b, weekdayOf(today()))).length;
          return '<div class="tiny muted" style="line-height:1.8">每天固定要做的日常事项（朗读、口算、整理书包……）在这里设一次，之后每天打开「今日作业」就会自动加进清单，<b>已经打过的钩不会丢</b>；只在部分星期做的项，进去点亮对应的星期即可。</div>' +
            '<div class="btn-row" style="margin-top:10px">' +
            '<button class="btn ghost sm" data-action="base-open">' + ic('refresh', 'sm') +
            (bAll.length ? '修改每日基础任务（' + bAll.length + ' 项）' : '去设置每日基础任务') + '</button>' +
            '<span class="tiny muted">' + (bAll.length
              ? (bOn ? '今天有 ' + bOn + ' 项会自动加进清单' : '今天没有安排基础任务')
              : '还没设置，设置后每天自动出现在作业清单里') + '</span></div>';
        })() +

        '<div class="divider"></div><div class="section-title">学习难度与课本</div>' +
        (function () {
          const dg = Math.min(6, Math.max(1, parseInt(d.grade, 10) || 5));
          const dlv = d.mathLevel === 'easy' ? -1 : d.mathLevel === 'hard' ? 1 : 0;
          const dmath = Math.min(6, Math.max(1, dg + dlv));
          return '<div class="form-row">' +
            '<div class="field narrow"><label>年级</label><select class="input" data-model="draft.grade">' +
            [1, 2, 3, 4, 5, 6].map(n => '<option value="' + n + '"' + (dg === n ? ' selected' : '') + '>' + gradeName(n) + '</option>').join('') +
            '</select></div>' +
            '<div class="field narrow"><label>学期</label><select class="input" data-model="draft.term">' +
            '<option value="1"' + (Number(d.term) === 1 ? ' selected' : '') + '>上册</option>' +
            '<option value="2"' + (Number(d.term) === 2 ? ' selected' : '') + '>下册</option></select></div>' +
            '<div class="field"><label>教材版本</label><select class="input" data-model="draft.book">' +
            BOOKS.map(x => '<option value="' + x.id + '"' + ((d.book || 'wy2024') === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') +
            '</select></div></div>' +
            '<div class="field" style="margin-top:10px"><label>数学难度</label><select class="input" data-model="draft.mathLevel">' +
            '<option value="easy"' + (d.mathLevel === 'easy' ? ' selected' : '') + '>降低一档（先打基础）</option>' +
            '<option value="normal"' + (!d.mathLevel || d.mathLevel === 'normal' ? ' selected' : '') + '>跟着年级走（推荐）</option>' +
            '<option value="hard"' + (d.mathLevel === 'hard' ? ' selected' : '') + '>提高一档（挑战一下）</option></select></div>' +
            '<div class="tiny muted" style="margin-top:6px">口算和数学练习会按 <b>' + gradeName(dmath) + '</b> 出题；英语听写的单元列表跟着上面选的课本切换（内置词库目前是外研社五年级上册，其他课本用「自定义词库」粘贴单词表即可）。</div>';
        })() +
        '<div class="divider"></div><div class="section-title">口算倒计时与拍照批改</div>' +
        '<div class="form-row">' +
        '<div class="field narrow"><label>每天口算题数</label><input class="input" type="number" min="1" max="30" step="1" data-model="draft.oralCount" value="' + (d.oralCount || 5) + '"></div>' +
        '<div class="field narrow"><label>倒计时（分钟）</label><input class="input" type="number" min="1" max="60" step="1" data-model="draft.oralMinutes" value="' + (d.oralMinutes || 8) + '"></div>' +
        '<div class="field"><label>OCR 识别 Key（可留空）</label><input class="input" data-model="draft.ocrKey" value="' + esc(d.ocrKey || '') + '" placeholder="留空用免费额度"></div></div>' +
        '<div class="tiny muted" style="margin-top:6px">默认 <b>8 分钟做 5 道题</b>，题数 1–30、时间 1–60 分钟都能改；时间到自动交卷，没写完的算错。拍照检查支持数学 / 语文 / 英语，照片会发到免费 OCR 服务（ocr.space）读文字，本应用不保存照片。AI 讲错题用设备自带普通话语音，不需要联网。</div>' +

        '<div class="divider"></div><div class="section-title">家庭同步（手机 ⇄ 平板）</div>' +
        '<div id="syncBox">' + syncBoxHtml() + '</div>' +

        '<div class="divider"></div><div class="section-title">版本与更新</div>' +
        '<div class="tiny muted" style="line-height:1.9">当前版本 <b>v52 · 取消勾选不会被同步复活</b>（左下角也能看到）。以后我改了功能，点一下「检查更新并刷新」，App 会自己拉最新版，<b>不用删图标重装，打卡记录也不会丢</b>。万一点了还是旧的，再把主屏幕图标删掉、用最新链接重新添加一次即可。</div>' +
        '<div class="btn-row" style="margin-top:10px"><button class="btn ghost sm" data-action="force-update">' + ic('refresh', 'sm') + '检查更新并刷新</button></div>' +
        '<div class="divider"></div><div class="tiny muted">没开启同步时，所有数据只保存在这台设备、不上传任何内容；开启「家庭同步」后，数据存在你自己的 GitHub 私有仓库里，只有你能看到。换设备或清理浏览器数据会丢失记录，重要内容建议偶尔导出备份。</div>' +
        '<div class="divider"></div><div class="section-title">换图标搬数据</div>' +
        '<div class="tiny muted" style="line-height:1.8">在<b>旧图标</b>里点「复制备份文本」，回主屏幕打开<b>新图标</b>，进设置点「粘贴导入」，打卡、星星、积分、错题会原样带走。两个图标都装好后操作，前后只要 30 秒。</div>' +
        '<div class="btn-row" style="margin-top:8px">' +
        '<button class="btn ghost sm" data-action="export-clip">' + ic('download', 'sm') + '复制备份文本</button>' +
        '<button class="btn ghost sm" data-action="import-paste">' + ic('arrow', 'sm') + '粘贴导入</button></div>' +
        '<div class="modal-foot" style="margin-top:14px"><button class="btn ghost" data-action="export-data">导出文件</button>' +
        '<button class="btn ghost" data-action="import-open">导入文件</button>' +
        '<input type="file" id="importFile" accept="application/json,.json" class="sr-file" data-import' +
          ' onclick="event.stopPropagation()">' +
        '<button class="btn ghost" data-action="clear-data" style="color:var(--coral)">清空数据</button>' +
        '<button class="btn" data-action="save-settings">保存</button></div></div>');
    },
    /* 换图标搬数据：复制 / 粘贴（iOS 主屏幕应用之间的存储互相隔离，系统剪贴板是共享的） */
    'import-open'() { const i = document.getElementById('importFile'); if (i) i.click(); },
    'export-clip'() {
      const txt = exportSnapshot();
      const fallback = () => {
        openModal('<div class="modal">' + modalHead('手动复制备份文本') +
          '<div class="tiny muted" style="margin-bottom:8px">点一下下面的方框 → 全选 → 拷贝。然后回主屏幕打开新图标，进设置点「粘贴导入」。</div>' +
          '<textarea class="input" rows="7" readonly onclick="this.focus();this.select()">' + esc(txt) + '</textarea>' +
          '<div class="modal-foot"><button class="btn" data-action="close-modal">复制好了</button></div></div>');
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(() => toast('备份文本已复制，去新图标里「粘贴导入」'), fallback);
      } else fallback();
    },
    'import-paste'() {
      openModal('<div class="modal">' + modalHead('粘贴导入') +
        '<div class="tiny muted" style="margin-bottom:8px">在旧图标里点过「复制备份文本」后，点下面的方框 → 粘贴，再点「读取并导入」。</div>' +
        '<textarea class="input" rows="7" id="clipIn" placeholder="备份文本粘贴到这里"></textarea>' +
        '<div class="modal-foot"><button class="btn ghost" data-action="close-modal">取消</button>' +
        '<button class="btn" data-action="import-paste-confirm">读取并导入</button></div></div>');
      const ta = document.getElementById('clipIn');
      if (navigator.clipboard && navigator.clipboard.readText && ta) {
        navigator.clipboard.readText().then(t => { if (ta && !ta.value && t) ta.value = t; }, () => {});
      }
    },
    'import-paste-confirm'() {
      const ta = document.getElementById('clipIn');
      const txt = ta ? ta.value : '';
      let parsed = null;
      try { parsed = JSON.parse(txt); } catch (e) { toast('没有读到有效的备份文本，先去旧图标「复制备份文本」'); return; }
      const ok = parsed && typeof parsed === 'object' &&
        ('checkins' in parsed || 'tasks' in parsed || 'mistakes' in parsed);
      if (!ok) { toast('内容不对，先回旧图标「复制备份文本」'); return; }
      S.pendingImport = parsed;
      openModal('<div class="modal">' + modalHead('导入备份？') +
        '<div class="tiny muted" style="line-height:1.9">会用备份<b>覆盖</b>当前这台设备上的全部记录（作业、打卡、星星、错题、设置），且无法撤销。建议先「复制备份文本」把当前数据留一份再导入。</div>' +
        '<div class="modal-foot"><button class="btn ghost" data-action="close-modal">取消</button>' +
        '<button class="btn coral" data-action="import-confirm">确认覆盖导入</button></div></div>');
    },

    'force-update'() {
      if (window.SB_FORCE_UPDATE) window.SB_FORCE_UPDATE();
      else location.reload();
    },
    'try-voice'() {
      const d = S.draft || {};
      const mode = d.voiceMode || 'recorded';
      const r = parseFloat(d.rate) || 0.9;
      AudioSys.wake();
      if (mode === 'tts') {
        const old = { u: db.settings.voiceURI, r: db.settings.rate };
        if (d.voiceURI !== undefined) db.settings.voiceURI = d.voiceURI;
        db.settings.rate = r;
        ttsSpeak('plate', r);
        db.settings.voiceURI = old.u; db.settings.rate = old.r;
        toast('正在用浏览器朗读试听 plate');
      } else {
        toast('正在准备高清发音…');
        Voice.play('plate', r, () => toast('已播放 · 高清预录人声'))
          .catch(() => toast('高清发音加载失败：先连网打开一次，或关闭后台重开 App'));
      }
    },
    'try-pet'() {
      AudioSys.wake();
      speakPet(5, PET_VOICES[5].say, () => {});
      toast('这就是天禄的声音，觉得好听吗？');
    },
    'pick-pet-voice'(el) {
      const v = el.dataset.style;
      if (!PET_STYLES.some(x => x.id === v)) return;
      db.settings.petVoiceStyle = v;
      if (S.draft) S.draft.petVoiceStyle = v;
      save();
      AudioSys.wake();
      speakPet(5, PET_VOICES[5].say, () => {});
      // 只更新按钮选中态，不重绘整个面板，避免丢掉其它还没保存的设置
      document.querySelectorAll('[data-action="pick-pet-voice"]').forEach(b => {
        const on = b.dataset.style === v;
        const st = PET_STYLES.filter(x => x.id === b.dataset.style)[0];
        b.className = 'btn ' + (on ? '' : 'ghost ') + 'sm';
        b.innerHTML = (on ? ic('check', 'sm') : ic('volume', 'sm')) + st.name +
          '<span class="tiny muted"> · ' + st.desc + '</span>';
      });
      toast('已换成「' + (PET_STYLES.filter(x => x.id === v)[0] || {}).name + '」的声音');
    },
    'try-zh'() {
      const d = S.draft || {};
      const sel = String(d.zhVoiceURI || '');
      stopChinese();
      if (sel === '' || sel === 'pet') {
        const style = (S.draft && S.draft.petVoiceStyle) || db.settings.petVoiceStyle || 'sweet';
        const my = zhToken;
        LessonVoice.ready().then(() => {
          if (my !== zhToken) return;
          const ok = LessonVoice.play(['小朋友你好，我是辟邪。', '我们一起把这道题弄懂吧。'], style);
          if (!ok) toast('讲题语音包还没下载好，连一下网再试');
        });
        toast('这是天禄讲题时的声音');
        return;
      }
      const old = db.settings.zhVoiceURI;
      db.settings.zhVoiceURI = sel;
      const ok = speakChinese('小朋友你好，我是辟邪。我们一起把这道题弄懂：先看清题目，再一步一步算，最后检查一遍。');
      db.settings.zhVoiceURI = old;
      toast(ok ? '正在用普通话试听' : '当前浏览器不支持语音朗读');
    },
    'save-settings'() {
      const d = S.draft || {};
      db.settings.name = String(d.name || '').trim().slice(0, 12);
      db.settings.goal = Math.min(20, Math.max(1, parseInt(d.goal, 10) || 5));
      db.settings.rate = Math.min(1.2, Math.max(0.5, parseFloat(d.rate) || 0.9));
      db.settings.canvas = CANVAS[d.canvas] !== undefined ? d.canvas : 'ipad11';
      db.settings.sound = !(d.sound === '0' || d.sound === 0 || d.sound === false);
      const sv = parseFloat(d.soundVolume);
      let volv = Math.min(1, Math.max(0, (isNaN(sv) ? 50 : sv) / 100));
      /* v49：音量拖到 0 时给一个最小音量。真要静音请用上面的「关闭」——
         以前拖到 0 会和「关掉音效」看起来一样，孩子以为开关坏了。 */
      if (volv === 0) volv = 0.35;
      db.settings.soundVolume = volv;
      db.settings.voiceMode = d.voiceMode === 'tts' ? 'tts' : 'recorded';
      db.settings.voiceURI = String(d.voiceURI || '');
      db.settings.repeat = (d.repeat === '2' || d.repeat === 2 || d.repeat === true);
      db.settings.oralCount = Math.min(30, Math.max(1, parseInt(d.oralCount, 10) || 5));
      db.settings.oralMinutes = Math.min(60, Math.max(1, parseInt(d.oralMinutes, 10) || 8));
      db.settings.ocrKey = String(d.ocrKey || '').trim();
      db.settings.onlineVoice = !(d.onlineVoice === '0' || d.onlineVoice === 0 || d.onlineVoice === false);
      db.settings.zhVoiceURI = String(d.zhVoiceURI || '');
      db.settings.petVoice = !(d.petVoice === '0' || d.petVoice === 0 || d.petVoice === false);
      db.settings.petVoiceStyle = PET_STYLES.some(x => x.id === d.petVoiceStyle) ? d.petVoiceStyle : 'sweet';
      db.settings.grade = Math.min(6, Math.max(1, parseInt(d.grade, 10) || 5));
      db.settings.term = parseInt(d.term, 10) === 2 ? 2 : 1;
      db.settings.book = BOOKS.some(x => x.id === d.book) ? d.book : 'wy2024';
      db.settings.mathLevel = (d.mathLevel === 'easy' || d.mathLevel === 'hard') ? d.mathLevel : 'normal';
      S.dict.units = [];                 // 课本变了，已选单元要重置
      S.oral.list = []; S.math.gen = [];
      S.dict.rate = db.settings.rate; S.dict.showZh = db.settings.showZh;
      Sound.config({ on: db.settings.sound, vol: db.settings.soundVolume });
      save(); closeModal(); render(); toast('设置已保存');
    },
    'export-data'() {
      const blob = new Blob([exportSnapshot(true)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = '小步陪伴-备份-' + today() + '.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000); toast('备份已下载');
    },
    'clear-data'() {
      openModal('<div class="modal">' + modalHead('确认清空数据？') +
        '<div class="tiny muted">会删除全部作业记录、打卡、星星和错题，且无法恢复。建议先「导出备份」。如果只是想清掉示例数据，也可以到错题本里逐条删除。</div>' +
        '<div class="modal-foot"><button class="btn ghost" data-action="close-modal">再想想</button>' +
        '<button class="btn coral" data-action="clear-confirm">确认清空</button></div></div>');
    },
    'clear-confirm'() { localStorage.removeItem(KEY); db = defaultDB(); S.dict.rate = 0.85; save(); closeModal(); S.tab = 'home'; render(); toast('数据已清空'); },

    /* 装到 iPad */
    'open-install'() {
      const installed = isStandalone();
      const steps = '<ol style="margin:0;padding-left:20px;line-height:2.1;font-size:14px">' +
        '<li>在 iPad 上用 <b>Safari</b> 打开当前这个链接（别用微信内置浏览器）</li>' +
        '<li>点右上或底部的 <b>分享</b> 图标（方框里向上的箭头）</li>' +
        '<li>找到 <b>添加到主屏幕</b>，把名称改成「小步陪伴」，点右上角 <b>添加</b></li>' +
        '<li>回到主屏幕，点紫色的台阶图标打开</li>' +
        '<li>iPadOS 26 起默认「打开为 Web App」（全屏无地址栏）；旧系统确认该开关是开着的</li></ol>';
      const body = installed
        ? '<div class="sim" style="font-size:14px;line-height:1.95">这个应用已经装到主屏幕啦，正以独立应用模式运行（没有浏览器地址栏，可以离线打开）。<br><br>小提醒：数据存在这台 iPad 上，和 Safari 里打开是两个空间；建议定期到「设置 → 导出备份」存一份，误删或清理后可用「导入备份」找回。</div>'
        : '<div class="tiny muted" style="margin-bottom:12px">不用装任何商店 App，也不用苹果账号和审核：30 秒就能把它变成主屏幕上的一个真 App——有图标、全屏、能离线。</div>' + steps +
        '<div class="pit" style="margin-top:14px;font-size:13px;line-height:1.8">注意：装到主屏幕后，它和 Safari 里的网页是<b>两个独立的数据空间</b>。以后固定从主屏幕图标打开，记录才会连续积累。如果之前在 Safari 里用过，先在 Safari 里「导出备份」，再到主屏幕 App 里「导入备份」。</div>';
      openModal('<div class="modal">' + modalHead(installed ? '已装到主屏幕' : '30 秒装到 iPad') + body +
        '<div class="modal-foot"><button class="btn" data-action="close-modal">知道了</button></div></div>');
    },
    'import-file'(el) {
      const file = el.files && el.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        let parsed = null;
        try { parsed = JSON.parse(reader.result); } catch (e) { toast('这个文件不是有效的备份'); el.value = ''; return; }
        const ok = parsed && typeof parsed === 'object' &&
          ('checkins' in parsed || 'tasks' in parsed || 'mistakes' in parsed);
        if (!ok) { toast('文件内容不对，像是别的文件'); el.value = ''; return; }
        S.pendingImport = parsed;
        openModal('<div class="modal">' + modalHead('导入备份？') +
          '<div class="tiny muted" style="line-height:1.9">会用备份<b>覆盖</b>当前这台设备上的全部记录（作业、打卡、星星、错题、设置），且无法撤销。建议先「导出备份」把当前数据留一份再导入。</div>' +
          '<div class="modal-foot"><button class="btn ghost" data-action="close-modal">取消</button>' +
          '<button class="btn coral" data-action="import-confirm">确认覆盖导入</button></div></div>');
      };
      reader.readAsText(file);
      el.value = '';
    },
    'import-confirm'() {
      const p = S.pendingImport; if (!p) { closeModal(); return; }
      const keep = { token: db.sync ? db.sync.token : '', owner: db.sync ? db.sync.owner : '' };
      db = Object.assign(defaultDB(), p);
      db.settings = Object.assign(defaultDB().settings, p.settings || {});
      db.pet = Object.assign(defaultDB().pet, p.pet || {});
      db.pet.food = db.pet.food || {};
      db.pet.earned = Object.assign({ checkin: false, oral: 0, dict: 0, master: 0 }, db.pet.earned || {});
      // v48：老备份没有喂食记录时，当成刚吃饱
      if (!Array.isArray(db.pet.feedLog)) db.pet.feedLog = [{ t: Date.now(), e: 100 }];
      /* 旧备份没有累计字段时，把当时的余额当成累计获得，免得下次同步被算成负数 */
      if (!p.pet || p.pet.pointsIn == null || p.pet.pointsOut == null) {
        db.pet.pointsOut = Math.max(0, (p.pet && p.pet.pointsOut) | 0);
        db.pet.pointsIn = Math.max(0, (db.pet.points | 0) + db.pet.pointsOut);
      }
      db.counters = Object.assign({ dictation: 0, math: 0, oral: 0 }, p.counters || {});
      // v46：备份里的删除名单也一起恢复；导入是显式覆盖，以备份内容为准
      db.mkDeleted = (p.mkDeleted && typeof p.mkDeleted === 'object' && !Array.isArray(p.mkDeleted)) ? p.mkDeleted : {};
      /* v50：基础任务模板与两张删除名单（老备份没有就留空） */
      db.baseTasks = Array.isArray(p.baseTasks) ? p.baseTasks.filter(t => t && t.content) : [];
      db.baseGone = (p.baseGone && typeof p.baseGone === 'object' && !Array.isArray(p.baseGone)) ? p.baseGone : {};
      db.taskGone = (p.taskGone && typeof p.taskGone === 'object' && !Array.isArray(p.taskGone)) ? p.taskGone : {};
      dedupeMistakes();
      db.sync = Object.assign(defaultDB().sync, p.sync || {});
      db.sync.device = db.sync.device || uid();
      if (!db.sync.token && keep.token) { db.sync.token = keep.token; if (!db.sync.owner) db.sync.owner = keep.owner; }
      if (!db.sync.token) db.sync.on = false;
      S.pendingImport = null;
      save(); closeModal(); S.tab = 'home'; render(); toast('备份已恢复');
    },

    /* 宠物形象自定义 */
    'pet-img'(el) {
      const which = el.dataset.which === 'pic' ? 'pic' : 'avatar';
      const box = document.getElementById(which === 'pic' ? 'petImgPic' : 'petImgAvatar');
      if (box) { box.value = ''; box.click(); }
    },
    'pet-img-pick'(el) {
      const which = el.dataset.petimg === 'pic' ? 'pic' : 'avatar';
      const f = el.files && el.files[0];
      if (!f) return;
      toast('正在处理图片…');
      squareDataURL(f, which === 'pic' ? 512 : 256, 0.82).then(data => {
        if (!data) { toast('这张图读不出来，换一张试试'); return; }
        const prev = db.pet[which];
        db.pet[which] = data;
        if (!save()) {
          db.pet[which] = prev; save();
          toast('图片太大存不下，换张小一点的试试');
          return;
        }
        refreshPetLook();
        render();                        // 首页 / 小窝立刻换成新图
        toast(which === 'pic' ? '小窝里的宠物换好啦' : '首页头像换好啦');
      });
    },
    'pet-img-reset'() {
      db.pet.avatar = ''; db.pet.pic = ''; save();
      refreshPetLook(); render();
      toast('已恢复默认的天禄');
    },

    /* 听写：拍照导入单词表 */
    'dict-photo'() {
      S.dictPhoto = { url: '', busy: false, words: [], text: '' };
      openModal(dictPhotoHtml('拍一张单词表，或者从相册选一张。识别后可以手动改。', ''));
    },
    'dict-photo-cam'() { const el = document.getElementById('dictCam'); if (el) { el.value = ''; el.click(); } },
    'dict-photo-lib'() { const el = document.getElementById('dictLib'); if (el) { el.value = ''; el.click(); } },
    'dict-photo-pick'(el) {
      const f = el.files && el.files[0]; if (!f) return;
      const P = S.dictPhoto = S.dictPhoto || { url: '', busy: false, words: [] };
      if (P.url && P.url.indexOf('blob:') === 0) { try { URL.revokeObjectURL(P.url); } catch (e) { } }
      openModal(dictPhotoHtml('照片已选好，正在压缩…', ''));
      shrinkPhoto(f, 1800, 0.86).then(r => {
        P.url = r.url; P.blob = r.blob; P.words = []; P.text = '';
        openModal(dictPhotoHtml('正在识别照片上的单词，请稍等…', ''));
        H['dict-photo-ocr']();
      });
    },
    async 'dict-photo-ocr'() {
      const P = S.dictPhoto;
      if (!P || !P.blob || P.busy) return;
      P.busy = true;
      openModal(dictPhotoHtml('正在识别照片上的单词，请稍等…', ''));
      try {
        let txt = await ocrSpace(P.blob, 'chs');
        // 中文没认出来（纯英文单词表）时，再用英文模型识别一次，准确率更高
        if (!txt || !/[\u4e00-\u9fa5]/.test(txt)) {
          try {
            const t2 = await ocrSpace(P.blob, 'eng');
            if (t2 && t2.length > txt.length) txt = t2;
          } catch (e2) { }
        }
        P.busy = false;
        P.raw = txt;
        P.words = parseWordSheet(txt);
        openModal(dictPhotoHtml(P.words.length ?
          '识别到 ' + P.words.length + ' 个单词。请核对下面的内容，改好错字后点「存进我的词库」。' :
          '没认出单词。可以换一张更清楚、正着拍的照片，或直接在设置里用「自定义词库」手动输入。',
          P.words.length ? 'good' : 'bad'));
      } catch (e) {
        P.busy = false;
        const m = String(e.message || '');
        openModal(dictPhotoHtml(/abort/i.test(m) ? '识别服务连不上或太慢，换张照片再试。' :
          '自动识别没成功（' + (m || '网络问题') + '），可以换张照片再试，或手动输入。', 'bad'));
      }
    },
    'dict-photo-again'() { if (S.dictPhoto) { S.dictPhoto.words = []; H['dict-photo-ocr'](); } },
    'dict-photo-save'() {
      const ta = document.querySelector('[data-model="dictPhoto.text"]');
      const words = parseWordSheet(ta ? ta.value : '');
      if (!words.length) { toast('没有可保存的单词，先改一下上面的内容'); return; }
      const map = {};
      db.customWords.forEach(w => { map[String(w.w).toLowerCase()] = w; });
      words.forEach(w => { map[String(w.w).toLowerCase()] = w; });
      db.customWords = Object.keys(map).map(k => map[k]);
      if (S.dict.units.indexOf('custom') < 0) S.dict.units.push('custom');
      save();
      S.dictPhoto = null;
      closeModal(); S.dict.stage = 'setup'; S.tab = 'dict'; render();
      toast('已存进「我的词库」，共 ' + db.customWords.length + ' 个词');
    },

    /* 自定义词库 */
    'open-custom-words'() {
      S.draft = { text: db.customWords.map(w => [w.w, w.zh, w.tip || ''].join(',')).join('\n') };
      openModal('<div class="modal wide">' + modalHead('自定义英语词库') +
        '<div class="tiny muted" style="margin-bottom:10px">每行一个单词，用英文逗号分隔：<b>英文,中文,拼写提示（可省略）</b>。保存后会出现在听写的单元列表里。</div>' +
        '<div class="field"><label>词库内容</label><textarea class="input" data-model="draft.text" rows="10" placeholder="例：\numbrella,雨伞,um + bre + lla\nplate,盘子,结尾 e 不发音但要写">' + esc(S.draft.text) + '</textarea></div>' +
        '<div class="modal-foot"><button class="btn ghost" data-action="close-modal">取消</button>' +
        '<button class="btn" data-action="save-custom-words">保存词库（' + db.customWords.length + ' 词）</button></div></div>');
    },
    'save-custom-words'() {
      const lines = String((S.draft && S.draft.text) || '').split('\n').map(x => x.trim()).filter(Boolean);
      const words = [];
      lines.forEach(l => {
        const p = l.split(/[,，]/).map(x => x.trim());
        if (p[0]) words.push({ w: p[0], zh: p[1] || '', tip: p[2] || '' });
      });
      db.customWords = words; save(); closeModal(); render(); toast('已保存 ' + words.length + ' 个自定义单词');
    },

    /* 听写 */
    'dict-unit'(el) {
      const id = el.dataset.id, i = S.dict.units.indexOf(id);
      if (i >= 0) S.dict.units.splice(i, 1); else S.dict.units.push(id);
      render();
    },
    'dict-start'() {
      const units = allUnits().filter(u => S.dict.units.indexOf(u.id) >= 0);
      const q = []; units.forEach(u => u.words.forEach(w => q.push(w)));
      if (!q.length) { toast('先选至少一个单元'); return; }
      // 打乱顺序
      for (let i = q.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = q[i]; q[i] = q[j]; q[j] = t; }
      Object.assign(S.dict, { stage: 'run', queue: q, idx: 0, answers: [], hint: false, input: '', checked: false, lastOK: false });
      AudioSys.wake();
      // 提前解码前几个词，避免第一次播放要等下载/解码
      q.forEach(x => Voice.prefetch(wordKey(x.w)));   // 联网时一次缓存本次全部词，课本词可离线听写
      render(); speak(q[0].w);
    },
    'dict-play'() { if (S.dict.queue[S.dict.idx]) speak(S.dict.queue[S.dict.idx].w); },
    /* 屏上字母键盘：只改输入框的值，不整页重绘，所以不会闪、也不会打断发音 */
    'dict-key'(el) {
      const d = S.dict;
      if (d.stage !== 'run' || d.checked) return;
      const k = el.dataset.k;
      let v = String(d.input || '');
      if (k === 'del') v = v.slice(0, -1);
      else if (k === 'clear') v = '';
      else if (k === 'space') { if (v && !/\s$/.test(v)) v += ' '; }
      else v += k;
      if (v.length > 40) v = v.slice(0, 40);
      d.input = v;
      const inp = document.querySelector('[data-model="dict.input"]');
      if (inp) { inp.value = v; inp.classList.remove('right', 'wrong'); }
    },
    'dict-kb-toggle'() {
      const wasScreenKb = db.settings.dictKeyboard !== false;
      db.settings.dictKeyboard = !wasScreenKb;
      save();
      render();
      if (wasScreenKb) {
        const inp = document.querySelector('[data-model="dict.input"]');
        if (inp) inp.focus();
        toast('已换成系统键盘');
      } else {
        toast('已换回字母键盘');
      }
    },
    'dict-hint'() { S.dict.hint = true; render(); },
    'dict-skip'() { S.dict.input = ''; H['dict-submit'](null, true); },
    'dict-submit'(el, forced) {
      const d = S.dict; if (d.checked) return;
      const cur = d.queue[d.idx];
      const mine = String(d.input || '').trim();
      if (!mine && !forced) { toast('先写下你听到的单词，或点「跳过」'); return; }
      const ok = grade(mine, cur.w, 'text') && norm(mine) === norm(cur.w);
      d.checked = true; d.lastOK = ok;
      d.answers.push({ w: cur.w, zh: cur.zh, mine: mine, ok: ok });
      if (!ok) addMistake({ subject: '英语', q: '听写：' + (cur.zh || cur.w), correct: cur.w, mine: mine, zh: cur.zh, tip: cur.tip, tag: 'word' });
      if (ok) Sound.ok(); else Sound.no();
      render();
    },
    'dict-next'() {
      const d = S.dict;
      if (d.idx + 1 >= d.queue.length) {
        db.counters.dictation++; const right = d.answers.filter(a => a.ok).length;
        if (right === d.answers.length && d.answers.length >= 5) { addStars(2); toast('全对！额外奖励 2 颗星星'); }
        if (petDay().earned.dict < 3) {
          db.pet.earned.dict++;
          addPoints(right === d.answers.length ? 8 : 5, right === d.answers.length ? '听写全对' : '英语听写');
        }
        if (right === d.answers.length) Sound.win();
        save(); d.stage = 'result'; confetti();
      } else { d.idx++; d.input = ''; d.checked = false; d.hint = false; d.lastOK = false; }
      render();
      if (d.stage === 'run') {
        d.queue.slice(d.idx, d.idx + 3).forEach(x => Voice.prefetch(wordKey(x.w)));
        speak(d.queue[d.idx].w);
      }
    },
    'dict-restart'() { H['dict-start'](); },
    'dict-back'() { S.dict.stage = 'setup'; render(); },

    /* 数学检查 */
    'math-tab'(el) { S.math.tab = el.dataset.tab; S.math.judge = null; render(); },
    'math-add-row'() { S.math.rows.push({ q: '', mine: '', correct: '' }); render(); },
    'math-del-row'(el) { S.math.rows.splice(+el.dataset.i, 1); render(); },
    'math-load-sample'() {
      S.math.rows = [
        { q: '0.8 × 0.7 = ?', mine: '0.56', correct: '0.56' },
        { q: '1/2 + 1/3 = ?', mine: '2/5', correct: '5/6' },
        { q: '三角形底 8cm 高 5cm，面积？', mine: '40', correct: '20' },
        { q: '3.6 ÷ 4 = ?', mine: '0.9', correct: '0.9' }
      ]; render(); toast('已载入 4 道示例，可以直接点「开始检查」');
    },
    'math-batch'() {
      S.draft = { text: '' };
      openModal('<div class="modal wide">' + modalHead('批量粘贴题目') +
        '<div class="tiny muted" style="margin-bottom:10px">每行一道题，用竖线 | 分隔三段：<b>题目 | 我的答案 | 正确答案</b>。粘贴后会替换当前列表。</div>' +
        '<div class="field"><textarea class="input" data-model="draft.text" rows="9" placeholder="0.8 × 0.7 = ?|0.56|0.56\n1/2 + 1/3 = ?|2/5|5/6"></textarea></div>' +
        '<div class="modal-foot"><button class="btn ghost" data-action="close-modal">取消</button>' +
        '<button class="btn" data-action="math-save-batch">导入</button></div></div>');
    },
    'math-save-batch'() {
      const lines = String((S.draft && S.draft.text) || '').split('\n').map(x => x.trim()).filter(Boolean);
      const rows = [];
      lines.forEach(l => { const p = l.split('|').map(x => x.trim()); if (p[0]) rows.push({ q: p[0], mine: p[1] || '', correct: p[2] || '' }); });
      if (!rows.length) { toast('没有识别到题目'); return; }
      S.math.rows = rows; S.math.judge = null; closeModal(); render(); toast('已导入 ' + rows.length + ' 道题');
    },
    'math-judge'() {
      const rows = S.math.rows.filter(r => r.q.trim());
      if (!rows.length) { toast('至少填一道题目'); return; }
      if (rows.some(r => !r.correct.trim())) { toast('每道题都要填正确答案，才能判断对错'); return; }
      const sub = S.math.subject || '数学';
      S.math.judge = rows.map(r => {
        const isMath = sub === '数学';
        const ok = grade(r.mine, r.correct, isMath ? ((r.correct.indexOf('/') >= 0 || r.mine.indexOf('/') >= 0) ? 'frac' : 'num') : 'text');
        if (!ok) {
          addMistake(isMath
            ? { subject: '数学', kind: 'math', q: r.q, correct: r.correct, mine: r.mine, tag: inferTag(r.q), solution: null }
            : { subject: sub, kind: 'general', q: r.q, correct: r.correct, mine: r.mine, tag: 'word' });
        }
        return { q: r.q, mine: r.mine, correct: r.correct, ok: ok };
      });
      db.counters.math++;
      const right = S.math.judge.filter(r => r.ok).length;
      if (right === S.math.judge.length && S.math.judge.length >= 5) { addStars(2); }
      if (right === S.math.judge.length) Sound.win(); else Sound.no();
      save(); render();
      toast(right === S.math.judge.length ? '全部正确，太厉害了' : '批改完成：' + right + ' 对 / ' + (S.math.judge.length - right) + ' 错，错题已收好');
      if (right === S.math.judge.length) confetti();
    },
    'math-judge-back'() { S.math.judge = null; render(); },
    'math-tag'(el) { S.math.tag = el.dataset.tag; S.math.gen = []; render(); },
    'math-quiz-start'() {
      const pool = mathPool().slice();
      pool.sort(() => Math.random() - 0.5);
      let ids = pool.slice(0, 5).map(x => x.id);
      S.math.gen = [];
      if (ids.length < 5) {                    // 该年级题不够：用本年级计算专项补齐
        const extra = genMath(5 - ids.length, mathGrade());
        S.math.gen = extra;
        ids = ids.concat(extra.map(x => x.id));
        ids.sort(() => Math.random() - 0.5);
      }
      Object.assign(S.math.quiz, { ids: ids, idx: 0, answers: [], input: '', checked: false, lastOK: false });
      render();
    },
    'math-quiz-submit'() {
      const Q = S.math.quiz, item = quizFind(Q.ids[Q.idx]);
      const mine = String(Q.input || '').trim();
      if (!mine) { toast('先写下答案'); return; }
      const ok = grade(mine, item.a, item.type);
      Q.checked = true; Q.lastOK = ok;
      Q.answers.push({ q: item.q, mine: mine, correct: item.a, ok: ok });
      if (!ok) addMistake({ subject: '数学', q: item.q, correct: item.a, mine: mine, tag: item.tag, solution: item.solution });
      if (ok) Sound.ok(); else Sound.no();
      render();
    },
    'math-quiz-next'() {
      const Q = S.math.quiz;
      if (Q.idx + 1 >= Q.ids.length) {
        db.counters.math++;
        const right = Q.answers.filter(a => a.ok).length;
        if (right === Q.answers.length) { addStars(2); toast('全对！奖励 2 颗星星'); Sound.win(); }
        save(); Q.idx = Q.ids.length; confetti();
      } else { Q.idx++; Q.input = ''; Q.checked = false; Q.lastOK = false; }
      render();
    },
    'math-quiz-back'() { Object.assign(S.math.quiz, { ids: [], idx: 0, answers: [], input: '', checked: false }); render(); },
    'math-quiz-restart'() { H['math-quiz-start'](); },

    /* 口算计时 */
    'oral-start'() {
      stopOralTimer();
      const n = oralCount(), ms = oralLimitMs(), mins = oralMinutes();
      const now = Date.now();
      S.oral.list = makeOral(n, mathGrade()); S.oral.answers = [];
      S.oral.startAt = now; S.oral.endAt = now + ms; S.oral.limitMs = ms;
      S.oral.running = true; S.oral.done = false; S.oral.timedOut = false;
      S.oral.elapsed = 0; S.oral.cur = 0;
      render(); toast('开始！' + mins + ' 分钟倒计时，时间到自动交卷，加油');
    },
    /* 内置数字键盘：写入当前题的答案。只更新 DOM，不整页重绘（不打断计时、不丢焦点） */
    'oral-key'(el) {
      const O = S.oral;
      if (!O.running || O.done) return;
      const k = el && el.dataset ? el.dataset.k : '';
      const i = Math.min(Math.max(O.cur || 0, 0), O.list.length - 1);
      let v = String(O.answers[i] || '');
      if (k === 'del') v = v.slice(0, -1);
      else if (k === '.') { if (v.indexOf('.') < 0 && v.length < 8) v += '.'; }
      else if (k === '/') { if (v.indexOf('/') < 0 && v.length < 9) v += '/'; }
      else if (v.length < 9) v += k;
      O.answers[i] = v;
      syncOralInput(i);
    },
    'oral-jump'(el) {
      const O = S.oral;
      if (!O.running || O.done) return;
      focusOralRow((O.cur || 0) + parseInt(el.dataset.d, 10));
    },
    'oral-next'() {
      const O = S.oral;
      if (!O.running || O.done) return;
      if ((O.cur || 0) >= O.list.length - 1) { toast('已经是最后一题了，点「交卷批改」吧'); return; }
      focusOralRow((O.cur || 0) + 1);
    },
    'oral-submit'() {
      const O = S.oral;
      if (!O.running) return;
      const forced = O.timedOut === true;
      const blank = O.list.filter((x, i) => !String(O.answers[i] || '').trim()).length;
      if (blank > 0 && !forced) {
        // 有空题先提醒，并跳到第一道空着题，避免手滑交卷
        const firstBlank = O.list.findIndex((x, i) => !String(O.answers[i] || '').trim());
        toast('还有 ' + blank + ' 道空着，已帮你跳到第 ' + (firstBlank + 1) + ' 题');
        O.cur = firstBlank; syncOralInput(firstBlank); return;
      }
      O.elapsed = Math.min(Date.now() - O.startAt, O.limitMs || (Date.now() - O.startAt));
      O.running = false; stopOralTimer();
      let right = 0;
      O.list.forEach((it, i) => {
        const mine = String(O.answers[i] || '').trim();
        const ok = grade(mine, it.a, it.type);
        it.result = ok;
        if (ok) right++;
        else addMistake({ subject: '数学', q: it.q, correct: it.a, mine: mine, tag: inferTag(it.q), solution: null });
      });
      O.done = true;
      db.counters.oral++;
      const prev = db.oral.best[today()];
      if (!prev || right > prev.right || (right === prev.right && O.elapsed < prev.ms)) {
        db.oral.best[today()] = { ms: O.elapsed, right: right, total: O.list.length };
      }
      if (right === O.list.length) { addStars(2); Sound.win(); confetti(); } else Sound.no();
      if (petDay().earned.oral < 3) {
        db.pet.earned.oral++;
        addPoints(right === O.list.length ? 8 : 5, right === O.list.length ? '口算全对' : '口算练习');
      }
      save(); render();
      toast(forced ? '时间到，已自动交卷：答对 ' + right + ' / ' + O.list.length + '，错的题收进错题本啦' :
        (right === O.list.length ? '全对！用时 ' + fmtTime(O.elapsed) + '，奖励 2 颗星星' :
          '答对 ' + right + ' / ' + O.list.length + ' · 用时 ' + fmtTime(O.elapsed) + '，错题已收好'));
    },
    'oral-restart'() { H['oral-start'](); },
    'oral-back'() {
      stopOralTimer();
      Object.assign(S.oral, { list: [], answers: [], running: false, done: false, timedOut: false, elapsed: 0, endAt: 0 });
      render();
    },

    /* 天禄小窝：星星换积分 */
    'star-exchange'() { exchangeStars(); },

    /* 天禄小窝：积分兑换 */
    'buy-food'(el) {
      const id = el.dataset.id, item = SHOP_BY[id];
      if (!item) return;
      const lock = petLock();
      if (!lock.ok) { toast('先把作业打卡和错题都完成，才能来换零食哦'); return; }
      if (db.pet.points < item.price) {
        Sound.no();
        toast('积分还差 ' + (item.price - db.pet.points) + ' 分，继续加油');
        return;
      }
      db.pet.points -= item.price;
      db.pet.pointsOut = (db.pet.pointsOut || 0) + item.price;
      db.pet.food[id] = (db.pet.food[id] || 0) + 1;
      save(); Sound.ok(); render();
      toast('换到了 ' + item.name + '，拖给天禄吃吧');
    },

    /* 辟邪宠物 */
    /* v49：小窝里点一下天禄（首页那张卡片走下面的 pet-pat） */
    'pet-tap'() { petTap(); },
    'pet-pat'() {
      const idx = Math.floor(Math.random() * PET_VOICES.length);
      const item = PET_VOICES[idx];
      const speechOn = db.settings.petVoice !== false;
      const bubble = $('#petLine');
      if (bubble) bubble.innerHTML = '<b>天禄：</b>' + esc(item.text) +
        (speechOn ? '<span class="pet-speaking">' + ic('volume', 'sm') + '正在说话…</span>' : '');
      Sound.ok();
      if (!speechOn) return;                 // 设置里关掉语音时只显示文字
      AudioSys.wake();                       // 保证音频通道已解锁（iPad 首次点击必需）
      const clearChip = () => { const sp = document.querySelector('.pet-speaking'); if (sp) sp.remove(); };
      // 用温和偏高的普通话把鼓励念出来，像小动物在说话
      const said = speakPet(idx, item.say, clearChip);
      if (!said) {
        clearChip();
        toast('这台设备的语音还没准备好，连点几下或关掉后台重开 App 就能听天禄说话啦');
      }
    },

    /* 拍照批改 */
    'photo-open'() {
      S.photo = { url: '', text: '', busy: false, name: '', subject: S.math.subject || '数学', blob: null };
      openModal(photoModalHtml('选一张' + S.photo.subject + '作业照片，会自动识别上面的题目。', ''));
    },
    'photo-subject'(el) {
      S.photo.subject = el.dataset.s || '数学';
      S.math.subject = S.photo.subject;
      openModal(photoModalHtml('已切到' + S.photo.subject + '，选一张作业照片吧。', ''));
    },
    'math-subject'(el) {
      S.math.subject = el.dataset.s || '数学';
      render();
    },
    'photo-camera'() {
      const el = document.getElementById('photoCam'); if (el) { el.value = ''; el.click(); }
    },
    'photo-album'() {
      const el = document.getElementById('photoLib'); if (el) { el.value = ''; el.click(); }
    },
    'photo-pick'(el) {
      const f = el.files && el.files[0]; if (!f) return;
      if (S.photo.url && S.photo.url.indexOf('blob:') === 0) {
        try { URL.revokeObjectURL(S.photo.url); } catch (e) { }
      }
      openModal(photoModalHtml('照片已选好，正在压缩…', ''));
      // iPad 拍的照片常有 3~5MB，超过免费 OCR 的 1MB 上限会直接失败。
      // 先压成 1600px 以内的 JPEG（认字足够清楚，通常只有几百 KB）。
      shrinkPhoto(f, 1600, 0.85).then(r => {
        S.photo.url = r.url;
        S.photo.blob = r.blob;
        S.photo.name = f.name; S.photo.text = '';
        openModal(photoModalHtml('照片已选好，正在识别…', ''));
        H['photo-ocr']();
      });
    },
    async 'photo-ocr'() {
      const P = S.photo;
      if (!P.url || P.busy) return;
      P.busy = true;
      openModal(photoModalHtml('正在识别照片上的字，请稍等…', ''));
      const ask = (blob) => {
        const fd = new FormData();
        fd.append('apikey', db.settings.ocrKey || 'helloworld');
        fd.append('language', S.photo.subject === '英语' ? 'eng' : 'chs');
        fd.append('isOverlayRequired', 'false');
        fd.append('OCREngine', '2');
        fd.append('file', blob, 'homework.jpg');
        // 加超时：网络差时不至于一直卡在「正在识别」
        const ctrl = ('AbortController' in window) ? new AbortController() : null;
        const timer = setTimeout(() => { if (ctrl) ctrl.abort(); }, 25000);
        return fetch('https://api.ocr.space/parse/image', {
          method: 'POST', body: fd, signal: ctrl ? ctrl.signal : undefined
        }).then(r => r.json()).finally(() => clearTimeout(timer));
      };
      try {
        const blob = P.blob;
        if (!blob) throw new Error('照片还没准备好，请重新选一张');
        let j;
        try {
          j = await ask(blob);
        } catch (e1) {
          await new Promise(r => setTimeout(r, 900));
          j = await ask(blob);                 // 网络抖动时重试一次
        }
        if (j.IsErroredOnProcessing) throw new Error((j.ErrorMessage && j.ErrorMessage[0]) || '识别服务返回错误');
        P.text = String((j.ParsedResults && j.ParsedResults[0] && j.ParsedResults[0].ParsedText) || '').trim();
        P.busy = false;
        openModal(photoModalHtml(P.text ? '识别完成，请核对下面的文字，改错后点「导入并批改」。' :
          '没能识别出文字，可以直接在下面的框里手动输入题目，照样能自动批改。', P.text ? 'good' : 'bad'));
      } catch (e) {
        P.busy = false;
        const m = String(e.message || '');
        const msg = /abort/i.test(m) ?
          '识别服务连不上或太慢（网络问题）。可以直接在下面手动输入题目，导入后照样自动批改。' :
          /size|too large|maximum/i.test(m) ?
          '照片太大了，换一张近一点拍的试试，或直接在下面手动输入题目。' :
          '自动识别没成功（' + (m || '网络问题') + '）。可直接在下面手动输入算式，每行一道，导入后照样自动批改。';
        openModal(photoModalHtml(msg, 'bad'));
      }
    },
    'photo-import'() {
      const ta = document.querySelector('[data-model="photo.text"]');
      const sub = S.photo.subject || '数学';
      const rows = parseOcrText(ta ? ta.value : S.photo.text, sub);
      if (!rows.length) { toast('没有识别到题目，先写点内容'); return; }
      const missing = rows.filter(r => !r.correct).length;
      S.math.subject = sub;
      S.math.rows = rows.map(r => Object.assign({ subject: sub, kind: sub === '数学' ? 'math' : 'general' }, r));
      S.math.judge = null; S.math.tab = 'check'; S.tab = 'math';
      closeModal();
      if (!missing) H['math-judge']();
      else { render(); toast('已导入 ' + rows.length + ' 道' + sub + '题，其中 ' + missing + ' 道请补填正确答案再检查'); }
    },

    /* 错题本 */
    'mk-filter'(el) { S.mk.filter = el.dataset.f; render(); },
    'mk-toggle'(el) { S.mk.open = S.mk.open === el.dataset.id ? null : el.dataset.id; render(); },
    'mk-master'(el) {
      const m = db.mistakes.find(x => x.id === el.dataset.id); if (!m) return;
      m.mastered = !m.mastered;
      if (m.mastered && petDay().earned.master < 5) {
        db.pet.earned.master++;
        addPoints(3, '弄懂一道错题');
      }
      save(); render();
      if (m.mastered) Sound.ok(); else Sound.click();
      toast(m.mastered ? '标记为已掌握，真棒' : '已放回待复习');
    },
    'mk-del'(el) {
      const id = el.dataset.id;
      const cur = db.mistakes.find(x => x.id === id);
      /* v47：同一道题可能因为两台设备各记了一次而存成两条（内容一样、id 不同），
         只删一条，另一条还在，看起来就像「删了没反应」。这里把同内容的副本一起删。 */
      const same = !cur ? db.mistakes.filter(x => x.id === id) : db.mistakes.filter(x =>
        x.id === id || (x.subject === cur.subject && String(x.q || '').trim() === String(cur.q || '').trim()));
      const dead = new Set(same.map(x => x.id));
      same.forEach(x => buryMistake(x));
      db.mistakes = db.mistakes.filter(x => !dead.has(x.id));
      save(); render();
    },
    'mk-clear'() {
      const gone = db.mistakes.filter(m => m.mastered);
      if (!gone.length) { toast('还没有标记为已掌握的题目'); return; }
      gone.forEach(m => buryMistake(m));
      db.mistakes = db.mistakes.filter(m => !m.mastered);
      save(); render(); toast('已清理掌握的题目');
    },
    'mk-speak'(el) {
      const m = db.mistakes.find(x => x.id === el.dataset.id) || { correct: el.dataset.w || '', subject: '英语' };
      if (m.subject === '语文') speakChinese(String(m.correct || ''));
      else speak(String(m.correct || ''));
    },
    'mk-ai-speak'(el) {
      const id = el.dataset.id;
      if (S.mk.speakingId === id) { stopChinese(); S.mk.speakingId = null; render(); return; }
      const m = db.mistakes.find(x => x.id === id); if (!m) return;
      S.mk.speakingId = id;
      const ok = speakLesson(m, () => {
        if (S.mk.speakingId === id) { S.mk.speakingId = null; render(); }
      });
      if (!ok) S.mk.speakingId = null;
      render();
      if (ok) toast('辟邪正在用普通话讲这道题，点「停止讲解」可随时停下');
    },
    'mk-practice'(el) {
      const m = db.mistakes.find(x => x.id === el.dataset.id); if (!m) return;
      S.math.tab = 'check'; S.math.judge = null;
      S.math.rows = [{ q: m.q, mine: '', correct: m.correct }];
      S.tab = 'math'; render(); toast('把这道题重新做一遍吧');
    },
    'mk-note'(el) {
      const m = db.mistakes.find(x => x.id === el.dataset.id); if (!m) return;
      S.draft = { id: m.id, text: m.note || '' };
      openModal('<div class="modal">' + modalHead('家长笔记') +
        '<div class="tiny muted" style="margin-bottom:10px">可以写一句提醒、一个更好懂的讲法，或孩子容易卡住的那一步。讲解里会显示出来。</div>' +
        '<div class="field"><textarea class="input" data-model="draft.text" rows="5" placeholder="例：先圈出「绕一圈」，提醒她这是求周长不是面积">' + esc(S.draft.text) + '</textarea></div>' +
        '<div class="modal-foot"><button class="btn ghost" data-action="close-modal">取消</button>' +
        '<button class="btn" data-action="mk-save-note">保存</button></div></div>');
    },
    'mk-save-note'() {
      const m = db.mistakes.find(x => x.id === (S.draft && S.draft.id)); if (!m) return;
      m.note = String(S.draft.text || '').trim().slice(0, 300); save(); closeModal(); render(); toast('笔记已保存');
    },
    'reveal-sim'(el) { toast('答案：' + el.dataset.a); }
  };

  /* ---------------- 事件绑定 ---------------- */
  const QUIET = { 'dict-submit': 1, 'dict-skip': 1, 'dict-start': 1, 'math-judge': 1, 'math-quiz-submit': 1, checkin: 1, 'toggle-task': 1, 'mk-master': 1, 'dict-key': 1, 'dict-kb-toggle': 1, 'pet-tap': 1, 'pet-pat': 1, 'buy-food': 1 };
  /* 天禄小窝：零食拖拽（鼠标 / 触摸通用） */
  document.addEventListener('pointerdown', e => {
    if (S.tab !== 'pet') return;
    foodDragStart(e);
  });
  document.addEventListener('touchstart', () => AudioSys.wake(), { passive: true });
  document.addEventListener('click', e => {
    AudioSys.wake();                 // 任意一次点击都解锁音频底座（iPad 首次交互必需）
    const t = e.target;
    /* 文件选择框的点击必须原样放行：
       它会冒泡到 .modal-mask（带 data-action），一旦被 preventDefault，
       浏览器就会取消打开相册/相机，弹窗还会被当成「点了遮罩」关掉。 */
    if (t && t.closest && t.closest('input[type=file]')) return;
    const el = t.closest('[data-action]');
    if (!el) return;
    if (!QUIET[el.dataset.action]) Sound.click();
    const fn = H[el.dataset.action];
    if (!fn) return;
    /* 唤起相机/相册的按钮不能 preventDefault，否则 iOS 会认为不是用户手势 */
    const noPrevent = el.dataset.action === 'photo-camera' || el.dataset.action === 'photo-album';
    if (!noPrevent) e.preventDefault();
    fn(el, e);
  });
  /* 口算：点某一行（题号 / 算式 / 输入框）就切到那道题，全程不弹系统键盘。
     用 capture 阶段拦 click，保证在 iPad 触摸、鼠标、程序化 click 下都生效。 */
  function focusOralRow(i) {
    const O = S.oral;
    if (!O.running || O.done) return false;
    const n = O.list.length;
    if (!n) return false;
    O.cur = Math.min(Math.max(parseInt(i, 10) || 0, 0), n - 1);
    syncOralInput(O.cur);
    return true;
  }
  document.addEventListener('click', e => {
    const target = e.target;
    if (!target || !target.closest) return;
    // 小键盘按钮有自己的 action，不在这里处理
    if (target.closest('.oral-pad')) return;
    const inp = target.closest('.oral-inp');
    const it = target.closest('.oral-item');
    if (inp && inp.dataset.oralFocus != null) {
      e.preventDefault();
      focusOralRow(inp.dataset.oralFocus);
      try { inp.blur(); } catch (err) { }
    } else if (it && S.oral.running) {
      const box = it.querySelector('.oral-inp');
      if (box && box.dataset.oralFocus != null) focusOralRow(box.dataset.oralFocus);
    }
  }, true);
  document.addEventListener('focusin', e => {
    const inp = e.target.closest && e.target.closest('.oral-inp');
    if (inp && inp.dataset.oralFocus != null) {
      focusOralRow(inp.dataset.oralFocus);
      try { inp.blur(); } catch (err) { }   // 立刻交还焦点，避免 iPad 顶起键盘
    }
  });
  /* 接了实体键盘也能用：数字 / . / - 直接敲进当前题 */
  document.addEventListener('keydown', e => {
    if (!S.oral.running || S.oral.done || S.tab !== 'oral') return;
    const tag = (e.target.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (/^[0-9./]$/.test(e.key)) { e.preventDefault(); H['oral-key']({ dataset: { k: e.key } }); }
    else if (e.key === 'Backspace') { e.preventDefault(); H['oral-key']({ dataset: { k: 'del' } }); }
    else if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); H['oral-jump']({ dataset: { d: '1' } }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); H['oral-jump']({ dataset: { d: '-1' } }); }
  });
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.row !== undefined) {
      const r = S.math.rows[+t.dataset.row]; if (r) r[t.dataset.field] = t.value; return;
    }
    const m = t.dataset.model;
    if (!m) return;
    const v = t.type === 'range' || t.type === 'number' ? parseFloat(t.value) : t.value;
    if (m === 'dict.input') { S.dict.input = t.value; return; }
    if (m === 'quiz.input') { S.math.quiz.input = t.value; return; }
    if (m === 'photo.text') { S.photo.text = t.value; return; }
    if (m === 'dictPhoto.text') {
      if (S.dictPhoto) { S.dictPhoto.text = t.value; S.dictPhoto.words = parseWordSheet(t.value); }
      return;
    }
    if (m.indexOf('oral.') === 0) { S.oral.answers[+m.slice(5)] = t.value; return; }
    if (m === 'dict.rate') { S.dict.rate = v; const lab = t.closest('.field').querySelector('label'); if (lab) lab.textContent = '朗读语速（' + v.toFixed(2) + ' 倍）· 听不清可以调慢'; return; }
    if (m.indexOf('draft.') === 0 && S.draft) {
      S.draft[m.slice(6)] = v;
      if (m === 'draft.soundVolume') {
        const lab = document.getElementById('volLabel'); if (lab) lab.textContent = Math.round(v) + '%';
        /* v49：以前把音量调大但「点击音效」还停在关闭，保存后就仍然没声音，
           看着像「调大又被关掉」。现在只要音量不为 0，就自动把开关打开。 */
        if (v > 0) {
          S.draft.sound = '1';
          const sel = document.querySelector('[data-model="draft.sound"]');
          if (sel && sel.value !== '1') sel.value = '1';
        }
      }
      return;
    }
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.photo !== undefined) { H['photo-pick'](t); return; }
    if (t.dataset.dictphoto !== undefined) { H['dict-photo-pick'](t); return; }
    if (t.dataset.petimg !== undefined) { H['pet-img-pick'](t); return; }
    if (t.dataset.import !== undefined) { H['import-file'](t); return; }
    const m = t.dataset.model;
    if (m === 'dict.showZh') { S.dict.showZh = t.value === '1'; db.settings.showZh = S.dict.showZh; save(); }
    if (m && m.indexOf('draft.') === 0 && S.draft) {
      S.draft[m.slice(6)] = t.value;
      /* v49：松手/选完就试听一下，调到多大心里有数 */
      if (m === 'draft.soundVolume') {
        const nv = Math.min(1, Math.max(0, (parseFloat(t.value) || 0) / 100));
        Sound.config({ on: true, vol: nv || 0.5 });
        if (nv > 0) Sound.click();
      } else if (m === 'draft.sound') {
        if (t.value === '0') { Sound.config({ on: false }); }
        else {
          const raw = S.draft.soundVolume;
          const vol = raw == null ? 0.5 : (raw > 1 ? raw / 100 : raw);
          Sound.config({ on: true, vol: vol || 0.5 });
          Sound.click();
        }
      }
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key !== 'Enter') return;
    const t = e.target;
    if (t.id === 'taskContent' || t.id === 'taskMinutes') { H['add-task'](); return; }
    if (t.dataset.model === 'dict.input' && S.dict.stage === 'run' && !S.dict.checked) { H['dict-submit'](); return; }
    if (t.dataset.model === 'quiz.input' && !S.math.quiz.checked) { H['math-quiz-submit'](); return; }
    if (t.dataset.row !== undefined && S.math.tab === 'check') { t.blur(); return; }
  });

  /* ---------------- 启动 ---------------- */
  render();
  /* v48：天禄饿了就提醒一次（同一天只提一次，别烦人） */
  if (satietyNow() < 30 && db.settings.hungerTip !== today()) {
    setTimeout(() => {
      db.settings.hungerTip = today();
      persist();
      renderNav();
      toast('天禄饿了，去小窝喂它一口吧');
    }, 2400);
  }
  /* v48：App 一直开着时饱食度也要跟着走——每分钟轻量更新一次，不整页重绘 */
  setInterval(() => {
    if (document.visibilityState !== 'visible' || S.tab !== 'pet') return;
    const card = document.querySelector('.hunger-card');
    if (!card) return;
    const v = satietyNow(), st = hungerState(v);
    const num = card.querySelector('.hg-num');
    const bar = card.querySelector('.hg-bar > i');
    const t1 = card.querySelector('.hg-main b');
    const t2 = card.querySelector('.hg-main span');
    if (num) num.innerHTML = Math.round(v) + '<i>/100</i>';
    if (bar) { bar.style.width = Math.max(2, v) + '%'; bar.style.background = st.color; }
    if (t1) t1.textContent = st.text;
    if (t2) t2.textContent = satietyLeftText(v);
  }, 60000);
  /* v41：连过同步的设备，启动后自动拉一次（延迟 2.5 秒，先让界面出来） */
  if (db.sync && db.sync.on && db.sync.token) {
    setTimeout(() => { syncNow('boot'); }, 2500);
    setInterval(() => {
      if (document.visibilityState === 'visible' && !SYNC.busy && db.sync.on) syncNow('tick');
    }, 120000);
  }
})();
