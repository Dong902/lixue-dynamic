/* 砺学体系 · 存储层
 * 全量 AES-GCM 加密落盘；谈话原文不落盘，仅保留结构化状态与事件计数
 */
window.LX = window.LX || {};

(function () {
  var SLOT = 'lx.profile.v1';
  var cache = null;

  function blank(pseudo) {
    var now = new Date().toISOString();
    return {
      pseudonym: pseudo || 'SX-PENDING',
      createdAt: now,
      settings: {
        burnAfterChat: true,
        shareTeacher: false,
        shareParent: false,
        sharePeer: false,
        shareExpiry: null
      },
      assessments: [],
      plans: [],
      checkins: [],
      highlights: [],
      activities: [],
      events: [],
      counters: { chatTurns: 0, practiceCount: 0, helpSeekingCount: 0, riskEvents: 0 },
      lastAssessmentDate: null
    };
  }

  async function load() {
    if (cache) return cache;
    await LX.privacy.ensureReady();
    var raw = LX.privacy.LS.getItem(SLOT);
    if (!raw) {
      cache = blank(await LX.privacy.pseudonym('local-' + Date.now()));
      await persist();
      return cache;
    }
    try {
      var payload = JSON.parse(raw);
      cache = await LX.privacy.decryptJSON(payload);
    } catch (e) {
      cache = blank(await LX.privacy.pseudonym('local-recovered'));
    }
    return cache;
  }

  async function persist() {
    if (!cache) return;
    var payload = await LX.privacy.encryptJSON(cache);
    LX.privacy.LS.setItem(SLOT, JSON.stringify(payload));
  }

  async function update(fn) {
    var p = await load();
    fn(p);
    await persist();
    return p;
  }

  function get() { return cache; }

  async function reset() {
    cache = blank(await LX.privacy.pseudonym('local-' + Date.now()));
    LX.privacy.volatile.clear();
    await persist();
    return cache;
  }

  /* 审计元数据：只记事件类型，不记明文内容 */
  async function log(type, meta) {
    return update(function (p) {
      p.events.push({ t: new Date().toISOString(), type: type, meta: meta || {} });
      if (p.events.length > 200) p.events = p.events.slice(-200);
    });
  }

  /* 测评计分 */
  function scoreAnswers(raw) {
    var sum = {}, cnt = {};
    LX.DIM_KEYS.forEach(function (k) { sum[k] = 0; cnt[k] = 0; });
    LX.ITEMS.forEach(function (it) {
      var v = raw[it.id];
      if (!v) return;
      var val = it.reverse ? (6 - v) : v;
      sum[it.dim] += val;
      cnt[it.dim] += 1;
    });
    var out = {};
    LX.DIM_KEYS.forEach(function (k) {
      out[k] = cnt[k] ? Math.round((sum[k] / cnt[k]) * 100) / 100 : 0;
    });
    return out;
  }

  LX.store = {
    load: load, persist: persist, update: update, get: get,
    reset: reset, log: log, scoreAnswers: scoreAnswers, blank: blank,
    slot: SLOT
  };

  /* 云端同步层：调用后端 API（FastAPI）。登录态存 localStorage（MVP；生产应改用更安全的存储）。
     前端与后端同源部署，故 API 路径使用相对地址 /api/... */
  LX.cloud = (function () {
    var TK = 'lx.token', RK = 'lx.role', UK = 'lx.user';
    function getToken() { return localStorage.getItem(TK); }
    function setSession(token, role, user) {
      localStorage.setItem(TK, token); localStorage.setItem(RK, role);
      localStorage.setItem(UK, JSON.stringify(user || {}));
    }
    function clearSession() {
      localStorage.removeItem(TK); localStorage.removeItem(RK); localStorage.removeItem(UK);
    }
    function getRole() { return localStorage.getItem(RK); }
    function getUser() { try { return JSON.parse(localStorage.getItem(UK) || '{}'); } catch (e) { return {}; } }
    async function req(method, path, body) {
      var headers = { 'Content-Type': 'application/json' };
      var tk = getToken(); if (tk) headers['Authorization'] = 'Bearer ' + tk;
      var r = await fetch(path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined });
      var data = await r.json().catch(function () { return { detail: '响应解析失败' }; });
      if (!r.ok) throw new Error(data.detail || ('HTTP ' + r.status));
      return data;
    }
    function login(u, p) {
      return req('POST', '/api/login', { username: u, password: p })
        .then(function (d) { setSession(d.token, d.role, { display_name: d.display_name, pseudonym: d.pseudonym }); return d; });
    }
    function register(u, p, role, dn) {
      return req('POST', '/api/register', { username: u, password: p, role: role, display_name: dn || '' })
        .then(function (d) { setSession(d.token, d.role, { display_name: d.display_name, pseudonym: d.pseudonym }); return d; });
    }
    function me() { return req('GET', '/api/me'); }
    function submitAssessment(answers) { return req('POST', '/api/assessment', { answers: answers }); }
    function myAssessment() { return req('GET', '/api/assessment/me'); }
    function cohort() { return req('GET', '/api/teacher/cohort'); }
    function child(student) { return req('GET', '/api/parent/child?student=' + encodeURIComponent(student)); }
    return {
      getToken: getToken, setSession: setSession, clearSession: clearSession,
      getRole: getRole, getUser: getUser, login: login, register: register,
      me: me, submitAssessment: submitAssessment, myAssessment: myAssessment,
      cohort: cohort, child: child
    };
  })();
})();
