/* 砺学体系 · 隐私层
 * 加密存储 / 假名化 / 聊后即焚 / k-匿名脱敏 / 家长端最小化
 * 说明：原型级实现。生产环境须将密钥交由 KMS 托管，并去除演示密钥路径。
 */
window.LX = window.LX || {};

(function () {
  var subtle = (window.crypto && window.crypto.subtle) ? window.crypto.subtle : null;

  /* 存储降级：localStorage 不可用时退化为内存存储，保证应用仍可运行 */
  var LS = (function () {
    try {
      if (window.localStorage) {
        window.localStorage.setItem('__probe__', '1');
        window.localStorage.removeItem('__probe__');
        return window.localStorage;
      }
    } catch (e) { /* 无痕模式、opaque origin 等场景 */ }
    var mem = {};
    return {
      _memory: true,
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      setItem: function (k, v) { mem[k] = String(v); },
      removeItem: function (k) { delete mem[k]; }
    };
  })();

  var KEY_SLOT = 'lx.key.device';
  var SALT_SLOT = 'lx.key.salt';
  var PASS_MARK = 'lx.key.passmode';

  var state = {
    mode: 'demo',        // demo | passphrase | fallback
    keyBytes: null,
    ready: false
  };

  /* ---------- 基础工具 ---------- */
  function toB64(buf) {
    var bytes = new Uint8Array(buf), s = '', i;
    for (i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return window.btoa(s);
  }
  function fromB64(str) {
    var s = window.atob(str), bytes = new Uint8Array(s.length), i;
    for (i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    return bytes;
  }
  function randBytes(n) {
    var a = new Uint8Array(n);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(a);
    else for (var i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256);
    return a;
  }

  async function sha256(str) {
    if (!subtle) return simpleHash(str);
    var buf = await subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(function (b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
  }
  function simpleHash(str) {
    var h = 2166136261, i;
    for (i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ('lx' + (h >>> 0).toString(16)).padStart(64, '0');
  }

  /* ---------- 密钥管理 ---------- */
  function loadDeviceKey() {
    var exist = LS.getItem(KEY_SLOT);
    if (exist) return fromB64(exist);
    var nb = randBytes(32);
    LS.setItem(KEY_SLOT, toB64(nb));
    return nb;
  }

  async function ensureReady() {
    if (state.ready) return state;
    if (LS.getItem(PASS_MARK) === '1') {
      state.pendingPass = true;
      state.mode = 'passphrase';
      return state;
    }
    state.keyBytes = loadDeviceKey();
    state.mode = subtle ? 'demo' : 'fallback';
    state.ready = true;
    return state;
  }

  /* 由口令派生密钥（PBKDF2） */
  async function unlock(passphrase) {
    if (!subtle) { throw new Error('当前环境不支持 Web Crypto，无法使用口令模式'); }
    var saltRaw = LS.getItem(SALT_SLOT);
    var salt = saltRaw ? fromB64(saltRaw) : randBytes(16);
    if (!saltRaw) LS.setItem(SALT_SLOT, toB64(salt));
    var base = await subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveBits']);
    var bits = await subtle.deriveBits({ name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' }, base, 256);
    state.keyBytes = new Uint8Array(bits);
    state.mode = 'passphrase';
    state.ready = true;
    LS.setItem(PASS_MARK, '1');
    return state;
  }

  function lock() {
    LS.removeItem(PASS_MARK);
    state.ready = false;
    state.keyBytes = null;
    state.mode = subtle ? 'demo' : 'fallback';
  }

  function needsUnlock() {
    return LS.getItem(PASS_MARK) === '1' && !state.ready;
  }

  /* ---------- 加解密 ---------- */
  async function aesEncrypt(plainObj) {
    var json = JSON.stringify(plainObj);
    if (!subtle) return { m: 'xor', d: xorTransform(json, state.keyBytes) };
    var key = await subtle.importKey('raw', state.keyBytes, { name: 'AES-GCM' }, false, ['encrypt']);
    var iv = randBytes(12);
    var ct = await subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(json));
    return { m: 'gcm', i: toB64(iv), d: toB64(ct) };
  }

  async function aesDecrypt(payload) {
    if (!payload) return null;
    if (payload.m === 'xor') return JSON.parse(xorReverse(payload.d, state.keyBytes));
    var key = await subtle.importKey('raw', state.keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
    var pt = await subtle.decrypt({ name: 'AES-GCM', iv: fromB64(payload.i) }, key, fromB64(payload.d));
    return JSON.parse(new TextDecoder().decode(pt));
  }

  /* 无 Web Crypto 时的降级混淆（明确标注，不等于加密） */
  function xorTransform(str, keyBytes) {
    var out = '', i;
    for (i = 0; i < str.length; i++) {
      out += String.fromCharCode(str.charCodeAt(i) ^ keyBytes[i % keyBytes.length]);
    }
    return window.btoa(unescape(encodeURIComponent(out)));
  }
  function xorReverse(b64, keyBytes) {
    var bin = window.atob(b64);
    var dec = decodeURIComponent(escape(bin));
    var out = '', i;
    for (i = 0; i < dec.length; i++) out += String.fromCharCode(dec.charCodeAt(i) ^ keyBytes[i % keyBytes.length]);
    return out;
  }

  /* ---------- 假名化 ---------- */
  async function pseudonym(realId) {
    var h = await sha256('lixue::' + realId);
    return 'SX-' + h.slice(0, 8).toUpperCase();
  }

  /* ---------- 聊后即焚：易失态存储 ---------- */
  var volatile = {
    mem: {},
    ttlMs: 4 * 60 * 60 * 1000,
    set: function (k, v) { volatile.mem[k] = { t: Date.now(), v: v }; },
    get: function (k) { var e = volatile.mem[k]; return e ? e.v : null; },
    del: function (k) { delete volatile.mem[k]; },
    clear: function () { volatile.mem = {}; },
    sweep: function () {
      var now = Date.now(), removed = 0;
      Object.keys(volatile.mem).forEach(function (k) {
        if (now - volatile.mem[k].t > volatile.ttlMs) { delete volatile.mem[k]; removed++; }
      });
      return removed;
    },
    count: function () { return Object.keys(volatile.mem).length; }
  };

  /* ---------- k-匿名与群体脱敏 ---------- */
  function kAnonym(rows, k, labelFn) {
    k = k || 5;
    var kept = [], suppressed = [];
    rows.forEach(function (r) {
      if (r.n >= k) kept.push(r);
      else suppressed.push({ label: labelFn ? labelFn(r) : r.grade + ' · ' + r.major, n: r.n });
    });
    return { kept: kept, suppressed: suppressed, k: k };
  }

  /* 交叉抑制：控制可识别组合维度数 */
  function crossCheck(row, activeFilters) {
    if (activeFilters >= 4) {
      return { ok: false, reason: '当前交叉维度达 ' + activeFilters + ' 项，可能定位到特定个人，已自动汇总到上级粒度' };
    }
    if (row.n < 5) return { ok: false, reason: '样本量 < 5，依据 k-匿名（k≥5）规则抑制输出' };
    return { ok: true };
  }

  /* ---------- 家长端最小化 + 正向转译 ---------- */
  var PARENT_BLACKLIST = [
    '成绩', '绩点', 'GPA', '排名', '考勤', '违纪', '处分',
    '测评原始条目', '维度分', '心理咨询记录', '诊断', '同伴姓名', '家庭经济'
  ];

  function band(score) {
    if (score >= 4.0) return '稳定';
    if (score >= 3.0) return '稳步建立中';
    return '正在练习';
  }

  function desensitizeForParent(profile, dimScores) {
    if (!dimScores) return null;
    var weaken = Object.keys(dimScores).sort(function (a, b) { return dimScores[a] - dimScores[b]; }).slice(0, 2);
    var dimMap = {};
    LX.DIMS.forEach(function (d) { dimMap[d.key] = d.name; });
    return {
      period: profile.lastAssessmentDate || '本学期',
      summary: {
        engagement: band((dimScores.time + dimScores.motivation) / 2),
        practiceStarted: profile.practiceCount || 0,
        helpSeeking: profile.helpSeekingCount || 0,
        activities: (profile.activities || []).slice(0, 3)
      },
      growing: weaken.map(function (k) { return dimMap[k] + '：' + band(dimScores[k]); }),
      highlights: (profile.highlights || []).slice(0, 3),
      blacklistNote: '本摘要不含 ' + PARENT_BLACKLIST.slice(0, 6).join('、') + ' 等信息',
      _rawExcluded: true
    };
  }

  LX.privacy = {
    ensureReady: ensureReady,
    unlock: unlock,
    lock: lock,
    needsUnlock: needsUnlock,
    encryptJSON: aesEncrypt,
    decryptJSON: aesDecrypt,
    pseudonym: pseudonym,
    sha256: sha256,
    volatile: volatile,
    LS: LS,
    kAnonym: kAnonym,
    crossCheck: crossCheck,
    desensitizeForParent: desensitizeForParent,
    PARENT_BLACKLIST: PARENT_BLACKLIST,
    status: function () {
      return { mode: state.mode, ready: state.ready, secure: !!subtle };
    },
    modeLabel: function () {
      var s = state.mode;
      if (s === 'passphrase') return '口令派生密钥 · AES-GCM';
      if (s === 'demo') return '本机演示密钥 · AES-GCM（生产环境须交由 KMS 托管）';
      return '降级：混淆存储（当前环境不支持 Web Crypto）';
    }
  };
})();
