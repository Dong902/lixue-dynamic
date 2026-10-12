/* 砺学体系 · 界面层
 * 四端交互：学生端 / 教师端 / 朋辈端 / 家长端 + 隐私面板
 */
window.LX = window.LX || {};

(function () {
  var st = {
    role: 'student',
    view: 'home',
    k: 5, applyK: true,
    peer: null,
    chat: [],
    draft: {},
    scenario: null,
    probeIndex: 0,
    timer: null,
    ticking: false,
    authMode: 'login',
    childUser: ''
  };

  var NAV = {
    student: [
      { id: 'home', name: '今日', icon: '◈' },
      { id: 'assess', name: '六维测评', icon: '◍' },
      { id: 'coach', name: '场景辅导', icon: '❋' },
      { id: 'plan', name: '我的计划', icon: '▦' },
      { id: 'practice', name: '微练习', icon: '◔' },
      { id: 'archive', name: '成长档案', icon: '▤' },
      { id: 'consent', name: '授权中心', icon: '⚿' }
    ],
    teacher: [
      { id: 'cohort', name: '群体画像', icon: '▦' },
      { id: 'thelp', name: '分层帮扶', icon: '◈' },
      { id: 'tstyle', name: '学风建设', icon: '❋' },
      { id: 'tmaterial', name: '家校材料', icon: '▤' },
      { id: 'ttrack', name: '长效追踪', icon: '◍' }
    ],
    peer: [
      { id: 'plist', name: '帮扶对象', icon: '◈' },
      { id: 'poutline', name: '访谈提纲', icon: '▤' },
      { id: 'prewrite', name: '话术改写', icon: '❋' },
      { id: 'pflow', name: '流程模板', icon: '▦' },
      { id: 'phigh', name: '亮点记录', icon: '◍' },
      { id: 'pres', name: '资源导引', icon: '⚿' }
    ],
    parent: [
      { id: 'psci', name: '学业科普', icon: '❋' },
      { id: 'ptalk', name: '沟通模拟', icon: '◈' },
      { id: 'psum', name: '成长摘要', icon: '▤' },
      { id: 'pfam', name: '支持方案', icon: '◍' }
    ]
  };

  function $(sel) { return document.querySelector(sel); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* 轻量 Markdown：**粗体**、· 列表、换行 */
  function md(s) {
    var lines = String(s || '').split('\n');
    var out = [], inList = false;
    function closeList() { if (inList) { out.push('</ul>'); inList = false; } }
    lines.forEach(function (line) {
      var t = esc(line).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      var isItem = /^\s*·\s?/.test(line);
      if (isItem) {
        if (!inList) { out.push('<ul class="md-list">'); inList = true; }
        out.push('<li>' + t.replace(/^\s*·\s?/, '') + '</li>');
      } else if (!t.trim()) {
        closeList();
      } else {
        closeList();
        out.push('<p>' + t + '</p>');
      }
    });
    closeList();
    return out.join('');
  }

  function card(title, body, opts) {
    opts = opts || {};
    return '<section class="card' + (opts.wide ? ' wide' : '') + '">' +
      (title ? '<h3 class="card-title">' + esc(title) + (opts.sub ? '<span class="card-sub">' + esc(opts.sub) + '</span>' : '') + '</h3>' : '') +
      '<div class="card-body">' + body + '</div></section>';
  }

  function outputBox(res) {
    if (!res) return '';
    var warn = (res.guardHits && res.guardHits.length)
      ? '<div class="guard-note">护栏已拦截标签化表述：' + res.guardHits.join('、') + '</div>' : '';
    return warn + '<div class="md">' + md(res.text) + '</div>';
  }

  /* ---------- 雷达图 ---------- */
  function radar(scores) {
    var size = 320, cx = size / 2, cy = size / 2, r = 108;
    function pt(i, val) {
      var ang = (-90 + i * 60) * Math.PI / 180;
      var rr = r * (val / 5);
      return [cx + rr * Math.cos(ang), cy + rr * Math.sin(ang)];
    }
    var rings = '';
    [1, 2, 3, 4, 5].forEach(function (lv) {
      var poly = LX.DIMS.map(function (d, i) {
        var p = pt(i, lv); return p[0].toFixed(1) + ',' + p[1].toFixed(1);
      }).join(' ');
      rings += '<polygon points="' + poly + '" fill="none" stroke="#DDE3EA" stroke-width="1"/>';
    });
    var axes = LX.DIMS.map(function (d, i) {
      var p = pt(i, 5);
      return '<line x1="' + cx + '" y1="' + cy + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '" stroke="#DDE3EA" stroke-width="1"/>';
    }).join('');
    var area = LX.DIMS.map(function (d, i) {
      var p = pt(i, scores[d.key] || 0);
      return p[0].toFixed(1) + ',' + p[1].toFixed(1);
    }).join(' ');
    var dots = LX.DIMS.map(function (d, i) {
      var p = pt(i, scores[d.key] || 0);
      return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3.5" fill="' + d.color + '"/>';
    }).join('');
    var labels = LX.DIMS.map(function (d, i) {
      var p = pt(i, 5.9);
      var anchor = p[0] > cx + 6 ? 'start' : (p[0] < cx - 6 ? 'end' : 'middle');
      return '<text x="' + p[0].toFixed(1) + '" y="' + p[1].toFixed(1) + '" text-anchor="' + anchor +
        '" dominant-baseline="middle" font-size="12" fill="#44546A">' + d.name +
        '<tspan font-size="11" fill="#8494A8"> ' + (scores[d.key] || 0).toFixed(1) + '</tspan></text>';
    }).join('');
    return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="100%" style="max-width:340px" role="img" aria-label="六维测评雷达图">' +
      rings + axes +
      '<polygon points="' + area + '" fill="rgba(24,95,165,0.14)" stroke="#185FA5" stroke-width="1.6"/>' +
      dots + labels + '</svg>';
  }

  function dimBar(name, val, color) {
    var pct = Math.max(2, Math.min(100, val / 5 * 100));
    return '<div class="bar-row"><span class="bar-name">' + esc(name) + '</span>' +
      '<span class="bar-track"><i style="width:' + pct + '%;background:' + color + '"></i></span>' +
      '<span class="bar-val">' + val.toFixed(1) + '</span></div>';
  }

  function bandOf(v) { return v >= 4 ? 'high' : (v >= 3 ? 'mid' : 'low'); }

  /* ---------- 导出：Word / Markdown ---------- */
  function latestScores(p) {
    return p.assessments.length ? p.assessments[p.assessments.length - 1] : null;
  }

  function reportMarkdown(p) {
    var a = latestScores(p);
    if (!a) return '';
    var L = [];
    L.push('# 学业韧性成长报告', '');
    L.push('- 档案标识：' + p.pseudonym + '（已假名化）');
    L.push('- 测评日期：' + a.date);
    L.push('- 生成方式：砺学体系原型导出，全程本机处理，未上传', '');
    L.push('## 一、六维得分', '');
    L.push('| 维度 | 得分 | 说明 |', '| --- | --- | --- |');
    LX.DIMS.forEach(function (d) {
      L.push('| ' + d.name + ' | ' + a.scores[d.key].toFixed(1) + ' | ' + LX.DIM_NARRATIVE[d.key][bandOf(a.scores[d.key])] + ' |');
    });
    L.push('', '## 二、下一步可练的方向', '');
    LX.DIMS.forEach(function (d) { L.push('- **' + d.name + '**：' + d.lever); });
    L.push('');
    var actives = p.plans.filter(function (x) { return !x.archived; });
    if (actives.length) {
      L.push('## 三、进行中的计划', '');
      actives.forEach(function (pl) {
        var done = pl.steps.filter(function (s) { return s.done; }).length;
        L.push('- ' + pl.title + '（' + pl.level + '，已完成 ' + done + '/' + pl.steps.length + '）');
        pl.steps.forEach(function (s) { L.push('    - [' + (s.done ? 'x' : ' ') + '] ' + s.text); });
      });
      L.push('');
    }
    if (p.highlights.length) {
      L.push('## 四、成长亮点', '');
      p.highlights.forEach(function (h) { L.push('- ' + h); });
      L.push('');
    }
    L.push('---', '');
    L.push('**重要声明**：本报告使用的六维量表为教育干预导向的能力画像工具，非临床诊断工具，'
      + '不得用于精神疾病筛查、评奖评优或处分依据。若拟用于科研发表，须在本校样本上独立完成'
      + '探索性因子分析、验证性因子分析、信度与效标关联效度检验。');
    return L.join('\n');
  }

  function reportWordHtml(p) {
    var a = latestScores(p);
    if (!a) return '';
    var rows = LX.DIMS.map(function (d) {
      return '<tr><td>' + esc(d.name) + '</td><td class="num">' + a.scores[d.key].toFixed(1) + '</td><td>'
        + esc(LX.DIM_NARRATIVE[d.key][bandOf(a.scores[d.key])]) + '</td><td>' + esc(d.lever) + '</td></tr>';
    }).join('');
    return '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" '
      + 'xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>学业韧性成长报告</title>'
      + '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->'
      + '<style>'
      + 'body{font-family:"宋体",SimSun,serif;font-size:12pt;line-height:1.6;color:#1F2A37;}'
      + 'h1{font-family:"黑体",SimHei,sans-serif;font-size:18pt;color:#185FA5;}'
      + 'h2{font-family:"黑体",SimHei,sans-serif;font-size:14pt;color:#185FA5;margin-top:18pt;}'
      + 'table{border-collapse:collapse;width:100%;}'
      + 'th,td{border:1px solid #9AA5B1;padding:6pt 8pt;font-size:10.5pt;}'
      + 'th{background:#EAF0F6;text-align:left;}'
      + '.num{text-align:center;width:60pt;}'
      + '.meta{color:#5F6B7A;font-size:10.5pt;}'
      + '.warn{border:1px solid #BA7517;background:#FAEEDA;color:#633806;padding:8pt 10pt;font-size:10.5pt;}'
      + '</style></head><body>'
      + '<h1>学业韧性成长报告</h1>'
      + '<p class="meta">档案标识：' + esc(p.pseudonym) + '（已假名化）　|　测评日期：' + esc(a.date)
      + '　|　生成方式：砺学体系原型，全程本机处理，未上传</p>'
      + '<h2>一、六维得分</h2>'
      + '<table><thead><tr><th>维度</th><th>得分</th><th>说明</th><th>下一步可练</th></tr></thead><tbody>'
      + rows + '</tbody></table>'
      + '<h2>二、说明与使用边界</h2>'
      + '<div class="warn">本报告使用的六维量表为教育干预导向的能力画像工具，非临床诊断工具，'
      + '不得用于精神疾病筛查、评奖评优或处分依据。分数应作为成长对话的起点，而非结论。'
      + '若拟用于科研发表，须在本校样本上独立完成探索性因子分析、验证性因子分析、'
      + '信度与效标关联效度检验。</div>'
      + '</body></html>';
  }

  function download(name, content, mime) {
    try {
      var blob = new Blob([content], { type: mime + ';charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var anchor = document.createElement('a');
      anchor.href = url; anchor.download = name; anchor.style.display = 'none';
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
      toast('已导出 ' + name);
    } catch (e) {
      toast('当前环境不支持导出，请改用 Chrome 或 Edge', 'warn');
    }
  }

  function exportBar() {
    return '<div class="row-end"><span class="muted">导出内容不含对话原文，仅含本次六维得分与解读</span>' +
      '<span><button class="btn" data-act="exportMd">导出 Markdown</button> ' +
      '<button class="btn primary" data-act="exportDoc">导出 Word</button></span></div>';
  }

  function reportHtml(scores) {
    var rows = LX.DIMS.map(function (d) {
      var v = scores[d.key] || 0;
      var n = LX.DIM_NARRATIVE[d.key][bandOf(v)];
      return '<div class="rep-item"><div class="rep-head"><span class="rep-dot" style="background:' + d.color + '"></span>' +
        '<strong>' + d.name + '</strong><span class="rep-score">' + v.toFixed(1) + '</span></div>' +
        '<p class="rep-text">' + esc(n) + '</p>' +
        '<p class="rep-lever">下一步可练：' + esc(d.lever) + '</p></div>';
    }).join('');
    var top = LX.DIMS.slice().sort(function (a, b) { return (scores[b.key] || 0) - (scores[a.key] || 0); }).slice(0, 2);
    var head = '<div class="rep-lead">你的两个明显优势：<strong>' + top.map(function (d) { return d.name; }).join('</strong> 与 <strong>') +
      '</strong>。下面的描述针对的是「还在成形中的能力」，不是你的标签。</div>';
    return head + '<div class="rep-grid">' + rows + '</div>';
  }

  /* ---------- 各视图渲染 ---------- */
  var VIEWS = {};

  /* ===== 学生端 ===== */
  VIEWS.home = function (p) {
    var last = p.assessments.length ? p.assessments[p.assessments.length - 1] : null;
    var doneToday = p.checkins.length && p.checkins[p.checkins.length - 1].date === today();
    var steps = [];
    if (!last) steps.push('完成一次六维测评（约 5 分钟），看看哪两个方向值得先练');
    var active = p.plans.filter(function (x) { return !x.archived; })[0];
    if (active) {
      var undone = active.steps.filter(function (s) { return !s.done; })[0];
      if (undone) steps.push('推进计划「' + active.title + '」的下一步：' + undone.text);
    }
    steps.push('做一次 5 分钟注意力微练习');
    steps = steps.slice(0, 3);

    var html = '<div class="hero"><div><h2>AI青砺助手 · 学生端</h2>' +
      '<p>这里是你的学业韧性教练。所有记录只属于你，随时可以清除。</p></div>' +
      '<div class="hero-stat"><span>' + (p.assessments.length) + '</span><small>测评次数</small></div>' +
      '<div class="hero-stat"><span>' + (active ? active.steps.filter(function (s) { return s.done; }).length : 0) + '</span><small>已完成步骤</small></div>' +
      '<div class="hero-stat"><span>' + p.counters.practiceCount + '</span><small>微练习</small></div></div>';

    html += card('今天可以做的一小步',
      '<ol class="steps">' + steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
      '<button class="btn primary" data-act="checkin">' + (doneToday ? '今天已完成打卡 ✓' : '完成今日打卡') + '</button>');
    return html;
  };

  VIEWS.assess = function (p) {
    if (p.assessments.length >= 3) {
      return card('本学期测评次数已达上限',
        '<p>为保证测评不变成负担，一学期最多 3 次。最近一次：' + esc(p.lastAssessmentDate) + '</p>' +
        '<button class="btn" data-act="showLast">查看上次报告</button>');
    }
    var items = LX.ITEMS.map(function (it) {
      var opts = LX.SCALE_OPTIONS.map(function (o) {
        return '<label class="opt"><input type="radio" name="q' + it.id + '" value="' + o.v + '" data-act="answer" data-id="' + it.id + '"><span>' + o.v + '</span></label>';
      }).join('');
      return '<div class="item" data-item="' + it.id + '"><div class="item-text">' + it.id + '. ' + esc(it.text) +
        (it.reverse ? '<span class="tagmini">反向计分</span>' : '') + '</div><div class="opts">' + opts + '</div></div>';
    }).join('');
    return '<div class="notice">量表共 24 题，5 点计分。作答结果加密保存在本机，不上传、不进入任何教师可见范围。</div>' +
      card('学业韧性六维测评', items + '<div class="row-end"><span id="progress" class="muted">已作答 0 / 24</span>' +
        '<button class="btn primary" data-act="submitAssess">提交并生成报告</button></div>');
  };

  VIEWS.assessResult = function (p) {
    var last = p.assessments[p.assessments.length - 1];
    return '<div class="two-col">' +
      '<div>' + card('你的六维画像', radar(last.scores)) + '</div>' +
      '<div>' + card('维度得分', LX.DIMS.map(function (d) { return dimBar(d.name, last.scores[d.key], d.color); }).join('')) + '</div>' +
      '</div>' +
      card('成长报告（' + esc(p.lastAssessmentDate) + '）', reportHtml(last.scores)) + exportBar();
  };

  VIEWS.coach = function (p) {
    if (st.scenario) return coachChat(p);
    var cards = LX.SCENARIOS.map(function (s) {
      return '<button class="scenario" data-act="pickScenario" data-key="' + s.key + '">' +
        '<span class="sc-icon">' + s.icon + '</span><span class="sc-name">' + s.name + '</span>' +
        '<span class="sc-tag">' + esc(s.tagline) + '</span></button>';
    }).join('');
    return '<div class="grid-3">' + cards + '</div>' +
      card('对话准则', '<ul class="md-list"><li>采用苏格拉底式提问优先，不直接给结论</li><li>方法来自校园学业专属知识库，会标注来源编号</li><li>每次回复都会给出一个 ≤25 分钟的最小可行动作</li><li>聊天内容默认不保存（聊后即焚）</li></ul>');
  };

  function coachChat(p) {
    var sc = LX.SCENARIOS.filter(function (s) { return s.key === st.scenario; })[0];
    var burn = p.settings.burnAfterChat;
    var msgs = st.chat.map(function (m) {
      return '<div class="msg ' + m.role + '"><div class="bubble">' + md(m.text) +
        (m.sources && m.sources.length ? '<div class="src">来源：' + m.sources.map(function (e) { return e.id + ' ' + e.title; }).join('；') + '</div>' : '') +
        '</div></div>';
    }).join('');
    return '<div class="chat-head"><button class="btn ghost" data-act="backScenario">← 返回场景</button>' +
      '<strong>' + esc(sc.name) + '</strong><span class="muted">' + esc(sc.tagline) + '</span>' +
      '<span class="chip ' + (burn ? 'ok' : 'warn') + '">' + (burn ? '聊后即焚 已开启' : '聊后即焚 已关闭') + '</span></div>' +
      '<div class="chat" id="chatBox">' + msgs + '</div>' +
      '<div class="composer"><textarea id="chatInput" placeholder="描述你现在的处境，例如：下周要考高数，但第一章还没看完，一坐下来就走神…"></textarea>' +
      '<button class="btn primary" data-act="send">发送</button></div>';
  }

  VIEWS.plan = function (p) {
    var actives = p.plans.filter(function (x) { return !x.archived; });
    var body = '';
    if (!actives.length) {
      body = '<p class="muted">还没有进行中的计划。建议从 L0 起步——它只需要 5 分钟。</p>';
    } else {
      body = actives.map(function (pl) {
        var stepsHtml = pl.steps.map(function (s, i) {
          return '<li class="' + (s.done ? 'done' : '') + '"><label><input type="checkbox" ' + (s.done ? 'checked' : '') +
            ' data-act="toggleStep" data-plan="' + pl.id + '" data-i="' + i + '"><span>' + esc(s.text) + '</span></label></li>';
        }).join('');
        var done = pl.steps.filter(function (s) { return s.done; }).length;
        return '<div class="plan"><div class="plan-head"><strong>' + esc(pl.title) + '</strong>' +
          '<span class="chip">' + pl.level + '</span><span class="muted">' + done + '/' + pl.steps.length + '</span></div>' +
          '<ul class="plan-steps">' + stepsHtml + '</ul></div>';
      }).join('');
    }
    var lv = ['L0 微行动（≤5 分钟）', 'L1 单次任务（约 25 分钟）', 'L2 一周计划', 'L3 月度/期末计划'];
    var builder = '<div class="row">' + lv.map(function (l) {
      return '<button class="btn ghost" data-act="newPlan" data-level="' + l.split(' ')[0] + '">' + l + '</button>';
    }).join('') + '</div><input id="planTitle" class="input" placeholder="计划名称，例如：第三章例题攻坚">';
    return card('进行中的计划', body) + card('新建一个计划', builder +
      '<p class="muted">连续两次未完成时，系统会自动降一级而不是责备你——这是刻意的设计。</p>');
  };

  VIEWS.practice = function (p) {
    var presets = [
      { name: '4–7–8 呼吸', minutes: 3, tip: '吸气 4 秒 → 屏息 7 秒 → 缓慢呼气 8 秒，循环。屏息不适可改为 4–4–6。' },
      { name: '单任务专注（番茄）', minutes: 5, tip: '关掉通知，只打开一件东西。计时结束后必须真正休息，不要刷手机。' },
      { name: '身体扫描', minutes: 4, tip: '从脚趾开始，依次注意各部位是否紧绷，遇到紧绷处呼气时让它松下来。' }
    ];
    var list = presets.map(function (x, i) {
      return '<div class="practice"><div><strong>' + x.name + '</strong><p class="muted">' + esc(x.tip) + '</p></div>' +
        '<button class="btn primary" data-act="startTimer" data-min="' + x.minutes + '" data-idx="' + i + '">' + x.minutes + ' 分钟开始</button></div>';
    }).join('');
    return card('注意力微练习', list +
      '<div class="timer-box" id="timerBox"><span id="timerText">—</span><button class="btn ghost" data-act="stopTimer">停止</button></div>' +
      '<p class="muted">本功能不采集任何生理信号，不调用摄像头，仅记录你主动点击的次数。</p>');
  };

  VIEWS.archive = function (p) {
    if (!p.assessments.length) return card('暂无记录', '<p class="muted">完成一次测评后，这里会显示你的成长轨迹。</p>');
    var rows = p.assessments.map(function (a, i) {
      return '<tr><td>' + (i + 1) + '</td><td>' + esc(a.date) + '</td>' +
        LX.DIMS.map(function (d) { return '<td>' + a.scores[d.key].toFixed(1) + '</td>'; }).join('') + '</tr>';
    }).join('');
    var latest = p.assessments[p.assessments.length - 1];
    var prev = p.assessments.length > 1 ? p.assessments[p.assessments.length - 2] : null;
    var deltas = prev ? LX.DIMS.map(function (d) {
      var dv = latest.scores[d.key] - prev.scores[d.key];
      var cls = dv > 0.2 ? 'up' : (dv < -0.2 ? 'down' : 'flat');
      var arrow = dv > 0.2 ? '↑' : (dv < -0.2 ? '↓' : '—');
      return '<div class="delta ' + cls + '"><span>' + d.name + '</span><strong>' + arrow + ' ' + Math.abs(dv).toFixed(1) + '</strong></div>';
    }).join('') : '<p class="muted">完成第二次测评后即可看到变化。变化表述为「进展」，不是评级。</p>';
    return card('测评记录', '<table class="tbl"><thead><tr><th>#</th><th>日期</th>' +
      LX.DIMS.map(function (d) { return '<th>' + d.short + '</th>'; }).join('') + '</tr></thead><tbody>' + rows + '</tbody></table>') +
      card('最近一次的变化', '<div class="delta-grid">' + deltas + '</div>') +
      card('系统记住了我什么', '<pre class="code">' + esc(JSON.stringify({
        pseudonym: p.pseudonym,
        assessments: p.assessments.length,
        plans: p.plans.length,
        checkins: p.checkins.length,
        events: p.events.length,
        rawChatStored: 0
      }, null, 2)) + '</pre><p class="muted">对话原文不落盘，仅保留结构化状态与事件计数。</p>' +
        '<button class="btn danger" data-act="wipe">清除全部数据</button>');
  };

  VIEWS.consent = function (p) {
    var s = p.settings;
    function toggleRow(key, title, desc) {
      var on = s[key];
      return '<div class="consent ' + (on ? 'on' : '') + '"><div><strong>' + title + '</strong><p class="muted">' + desc + '</p></div>' +
        '<button class="btn ' + (on ? 'danger' : 'primary') + '" data-act="toggleConsent" data-key="' + key + '">' +
        (on ? '撤回授权' : '授予授权') + '</button></div>';
    }
    return '<div class="notice">授权三要素：<strong>范围</strong>（字段级白名单）、<strong>期限</strong>（默认一学期）、<strong>撤回</strong>（一键，5 分钟内全端下线）。</div>' +
      '<section class="card"><h3 class="card-title">对外授权</h3><div class="card-body"><div class="consent-list">' +
      toggleRow('shareTeacher', '教师可见我的个体维度分', '默认关闭。辅导员仅能看到群体聚合画像；如需个体数据须在此处授权。') +
      toggleRow('sharePeer', '朋辈志愿者可见我的帮扶档案', '用于帮扶配对时的进展同步，不含测评原始作答。') +
      toggleRow('shareParent', '家长可见脱敏成长摘要', '摘要不含成绩、绩点、排名、考勤、违纪与任何测评原始分。低分维度表述为「正在练习」。') +
      '</div></div></section>' +
      card('撤回效力与残余风险', '<ul class="md-list">' +
        '<li>撤回后：不再生成新摘要，家长端已生成摘要即时下线，服务端缓存清除</li>' +
        '<li>残余风险：家长端已截图或打印的内容技术上无法追回，因此家长端禁用导出、复制与长截图，并以页面水印形成追溯依据</li>' +
        '<li>若你选择不授权，系统完全尊重，且不会将其作为「不配合」的信号反馈给教师或家长</li></ul>');
  };

  /* ===== 教师端 ===== */
  function cohortTable() {
    var rows = LX.MockCohort.slice();
    var applied = st.applyK ? LX.privacy.kAnonym(rows, st.k, function (r) { return r.grade + ' · ' + r.major; }) : { kept: rows, suppressed: [], k: st.k };
    var head = '<tr><th>年级</th><th>专业</th><th>人数</th>' + LX.DIMS.map(function (d) { return '<th>' + d.short + '</th>'; }).join('') + '</tr>';
    var body = applied.kept.map(function (r) {
      return '<tr><td>' + r.grade + '</td><td>' + r.major + '</td><td>' + r.n + '</td>' +
        LX.DIMS.map(function (d) { return '<td>' + r[d.key].toFixed(1) + '</td>'; }).join('') + '</tr>';
    }).join('');
    var supp = applied.suppressed.length
      ? '<div class="guard-note">以下分组样本量 &lt; ' + applied.k + '，依据 k-匿名规则已抑制输出：' +
        applied.suppressed.map(function (s) { return s.label + '（n=' + s.n + '）'; }).join('、') + '</div>'
      : '';
    var dims = LX.engine.weakestDims(applied.kept);
    return '<div class="toolbar">' +
      '<label><input type="checkbox" ' + (st.applyK ? 'checked' : '') + ' data-act="toggleK"> 启用 k-匿名（k≥5）</label>' +
      '<span class="muted">交叉维度 ≥4 项时自动汇总到上级粒度</span></div>' +
      '<table class="tbl"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>' + supp +
      card('群体最弱维度', LX.DIMS.map(function (d) {
        var v = dims.filter(function (x) { return x.key === d.key; })[0].avg;
        return dimBar(d.name, v, d.color);
      }).join('') + '<p class="muted">口径：加权平均（按各组人数）。仅用于支持方案选择，不构成个体评价。</p>');
  }

  VIEWS.cohort = function () {
    setTimeout(function () { loadCohort(); }, 0);
    return '<div class="notice">教师端仅可见<strong>群体聚合数据</strong>；个体数据留存在服务端、不向外下发。样本量低于 k=5 时整体抑制（k-匿名）。</div>' +
      card('匿名化群体学业画像', '<div id="cohortBody"><p class="muted">正在从服务端加载群体数据…</p></div>');
  };

  async function loadCohort() {
    var box = $('#cohortBody'); if (!box) return;
    try {
      var d = await LX.cloud.cohort();
      if (d.suppressed) {
        box.innerHTML = '<div class="guard-note">' + esc((d.note || '样本量不足，已按 k-匿名整体抑制')) + '（当前样本量 n=' + d.n + '）</div>';
        return;
      }
      var head = '<tr><th>维度</th><th>群体均值</th><th>档位</th></tr>';
      var body = LX.DIMS.map(function (dim) {
        var v = d.avg[dim.key];
        return '<tr><td>' + dim.name + '</td><td>' + (v == null ? '—' : v.toFixed(2)) + '</td><td>' + bandLabel(v) + '</td></tr>';
      }).join('');
      var weakNames = (d.weak || []).map(dimName).join('、');
      var bandStr = d.bands ? Object.keys(d.bands).map(function (b) { return bandLabel2(b) + ' ' + d.bands[b] + ' 人'; }).join('、') : '';
      box.innerHTML = '<table class="tbl"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>' +
        '<div class="guard-note">' + esc((d.note || '')) + '（样本量 n=' + d.n + '）</div>' +
        '<h4>群体最需关注的维度</h4><p>' + (weakNames || '—') + '</p>' +
        (bandStr ? '<p class="muted">整体投入分布：' + bandStr + '</p>' : '');
    } catch (e) {
      box.innerHTML = '<div class="guard-note">加载失败：' + esc(e.message) + '</div>';
    }
  }

  VIEWS.thelp = function () { return card('分层帮扶方案', '<div id="out"></div><button class="btn primary" data-act="genHelp">生成方案草案</button>'); };
  VIEWS.tstyle = function () { return card('学风建设方案', '<div id="out"></div><button class="btn primary" data-act="genStyle">生成方案草案</button>'); };
  VIEWS.tmaterial = function () { return card('家校沟通科普材料', '<div id="out"></div><button class="btn primary" data-act="genMaterial">生成材料</button>'); };
  VIEWS.ttrack = function () { return card('群体成长数据长效追踪', '<div id="out"></div><button class="btn primary" data-act="genTrack">生成追踪说明</button>'); };

  /* ===== 朋辈端 ===== */
  VIEWS.plist = function () {
    var rows = LX.MockPeers.map(function (p) {
      return '<div class="peer-row' + (st.peer && st.peer.pid === p.pid ? ' active' : '') + '" data-act="pickPeer" data-pid="' + p.pid + '">' +
        '<div><strong>' + esc(p.alias) + '</strong><span class="muted"> ' + p.grade + ' · 已完成 ' + p.sessions + ' 次会话</span></div>' +
        '<div><span class="chip">' + p.stage + '</span></div></div>';
    }).join('');
    return card('帮扶配对', rows + '<p class="muted">选择对象后，可在「访谈提纲」「流程模板」中生成对应材料。</p>');
  };

  VIEWS.poutline = function () {
    return card('访谈提纲生成', '<div class="row">' +
      ['建立关系', '定位需求', '共设目标', '方法练习', '复盘调整', '阶段总结'].map(function (s) {
        return '<button class="btn ghost" data-act="genOutline" data-stage="' + s + '">' + s + '</button>';
      }).join('') + '</div><div id="out"></div>');
  };

  VIEWS.prewrite = function () {
    return card('鼓励式沟通话术改写',
      '<textarea id="rwInput" class="input tall" placeholder="输入你想说的话，例如：你怎么又没去上课，这样不行">' + esc(st.draft.rw || '') + '</textarea>' +
      '<button class="btn primary" data-act="doRewrite">改写为鼓励式表达</button><div id="out"></div>');
  };

  VIEWS.pflow = function () { return card('一对一帮扶流程模板', '<div id="out"></div><button class="btn primary" data-act="genFlow">生成 6 次会话流程</button>'); };

  VIEWS.phigh = function (p) {
    var list = (p.highlights && p.highlights.length)
      ? '<ul class="md-list">' + p.highlights.map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('') + '</ul>'
      : '<p class="muted">暂无亮点记录。</p>';
    return card('学生成长亮点记录', list +
      '<input id="hlInput" class="input" placeholder="记录一条成长亮点（每条 ≤50 字，须经本人确认后方可展示给家长）">' +
      '<button class="btn primary" data-act="addHighlight">添加亮点</button>');
  };

  VIEWS.pres = function () {
    return card('校园资源智能导引',
      '<input id="resInput" class="input" placeholder="想找什么资源？例如：高数答疑 / 心理咨询 / 竞赛">' +
      '<button class="btn primary" data-act="genRes">检索资源</button><div id="out"></div>');
  };

  /* ===== 家长端 ===== */
  VIEWS.psci = function () {
    return card('大学学业科普',
      '<input id="sciInput" class="input" placeholder="想了解什么？例如：学分绩点 / 为什么要这么久才有成绩 / 怎么沟通">' +
      '<button class="btn primary" data-act="genSci">查看科普</button><div id="out"></div>');
  };

  VIEWS.ptalk = function () {
    return card('正向远程沟通话术模拟',
      '<textarea id="talkInput" class="input tall" placeholder="输入你打算对孩子说的话，系统会给出反馈与替代表达">' + esc(st.draft.talk || '') + '</textarea>' +
      '<button class="btn primary" data-act="doTalk">模拟并反馈</button>' +
      '<p class="muted">本模拟对话不会被保存，孩子也看不到。</p><div id="out"></div>');
  };

  VIEWS.psum = function () {
    return '<div class="notice">家长端仅展示<strong>脱敏成长摘要</strong>，不暴露成绩与原始测评分值。需先与孩子绑定（演示：家长-甲 parent01 已绑定 学生-甲 stu01，输入用户名 stu01 查询）。</div>' +
      card('脱敏成长摘要',
        '<label>孩子用户名<input id="childUser" class="input" placeholder="如 stu01"></label>' +
        '<button class="btn primary" data-act="fetchChild">查询摘要</button>' +
        '<div id="childBox"><p class="muted">输入孩子的用户名后点击「查询摘要」。</p></div>');
  };

  VIEWS.pfam = function (p) {
    var last = p.assessments.length ? p.assessments[p.assessments.length - 1].scores : null;
    var sum = p.settings.shareParent && last ? LX.privacy.desensitizeForParent(p, last) : null;
    return card('家庭支持方案', '<div class="md">' + md(LX.engine.familyPlan(sum).text) + '</div>');
  };

  /* ---------- 通用部件 ---------- */
  function today() { return new Date().toISOString().slice(0, 10); }

  function bandLabel(v) {
    if (v == null) return '—';
    if (v < 2.6) return '偏低';
    if (v < 3.6) return '中等';
    return '较高';
  }
  function bandLabel2(b) {
    return ({ low: '偏低', mid: '中等', high: '较高', na: '—' })[b] || '—';
  }
  function dimName(key) {
    var f = LX.DIMS.filter(function (d) { return d.key === key; })[0];
    return f ? f.name : key;
  }

  function skeleton() {
    return '<header class="topbar">' +
      '<div class="brand"><span class="logo">砺</span><div><strong>砺学 · 学业成长 AI 赋能体系</strong><small>动态版 v1.0</small></div></div>' +
      '<nav class="roles" id="roles"></nav>' +
      '<div class="top-right"><button class="btn ghost" data-act="logout">退出</button>' +
      '<button class="btn ghost" data-act="openPrivacy">隐私与安全</button>' +
      '<button class="btn ghost" data-act="openLLM">模型接入</button></div></header>' +
      '<div class="layout"><aside class="sidebar" id="sidebar"></aside><main class="content" id="content"></main></div>' +
      '<div id="modalRoot"></div><div id="toastRoot"></div>';
  }

  function enterApp() {
    st.view = NAV[st.role][0].id;
    $('#app').innerHTML = skeleton();
    render();
  }

  function showLogin() {
    $('#app').innerHTML = loginScreen();
  }

  function loginScreen() {
    return '<div class="auth-wrap"><div class="auth-card">' +
      '<div class="brand center"><span class="logo">砺</span><div><strong>砺学 · 学业成长 AI 赋能体系</strong><small>动态版 · 请先登录</small></div></div>' +
      '<div class="auth-tabs">' +
        '<button class="auth-tab' + (st.authMode === 'login' ? ' active' : '') + '" data-act="authTab" data-mode="login">登录</button>' +
        '<button class="auth-tab' + (st.authMode !== 'login' ? ' active' : '') + '" data-act="authTab" data-mode="register">注册</button>' +
      '</div>' +
      '<div class="auth-form">' +
        '<label>角色<select id="authRole" class="input">' +
          '<option value="student">学生端（AI青砺助手）</option>' +
          '<option value="teacher">教师端（AI砺学顾问）</option>' +
          '<option value="peer">朋辈端（AI伴砺助教）</option>' +
          '<option value="parent">家长端（AI砺伴）</option>' +
        '</select></label>' +
        '<label>用户名<input id="authUser" class="input" placeholder="用户名"></label>' +
        '<label>密码<input id="authPass" class="input" type="password" placeholder="密码"></label>' +
        (st.authMode !== 'login' ? '<label>显示名（可选）<input id="authName" class="input" placeholder="如：李老师 / 学生-甲"></label>' : '') +
        '<button class="btn primary block" data-act="' + (st.authMode === 'login' ? 'doLogin' : 'doRegister') + '">' + (st.authMode === 'login' ? '登录并进入' : '注册并进入') + '</button>' +
        '<p class="muted center">演示账号：teacher01 / peer01 / parent01 / stu01～stu06，密码均为 demo1234（仅演示用，非真实数据）。<br>家长端演示：用 parent01 登录，在"脱敏成长摘要"中输入 stu01 查询。</p>' +
      '</div></div></div>';
  }

  function renderRoles() {
    var roles = [
      { id: 'student', name: 'AI青砺助手', sub: '学生端' },
      { id: 'teacher', name: 'AI砺学顾问', sub: '教师端' },
      { id: 'peer', name: 'AI伴砺助教', sub: '朋辈端' },
      { id: 'parent', name: 'AI砺伴', sub: '家长端' }
    ];
    $('#roles').innerHTML = roles.map(function (r) {
      return '<button class="role-tab' + (st.role === r.id ? ' active' : '') + '" data-act="switchRole" data-role="' + r.id + '">' +
        '<strong>' + r.name + '</strong><small>' + r.sub + '</small></button>';
    }).join('');
  }

  function renderSidebar() {
    var items = NAV[st.role];
    $('#sidebar').innerHTML = '<div class="side-title">' +
      ({ student: '学生自主赋能', teacher: '教师精准指导', peer: '社团朋辈跟进', parent: '家长协同支持' })[st.role] +
      '</div>' +
      items.map(function (it) {
        return '<button class="nav-item' + (st.view === it.id ? ' active' : '') + '" data-act="nav" data-view="' + it.id + '">' +
          '<span class="nav-icon">' + it.icon + '</span>' + it.name + '</button>';
      }).join('') +
      '<div class="side-foot"><div class="loop">协同闭环<br><small>感知 → 测评 → 赋能 → 协同 → 评估</small></div></div>';
  }

  async function renderContent() {
    var p = await LX.store.load();
    var fn = VIEWS[st.view];
    $('#content').innerHTML = fn ? fn(p) : '<p class="muted">敬请期待</p>';
    if (st.pending && $('#out')) { $('#out').innerHTML = outputBox(st.pending); }
  }

  function render() {
    renderRoles(); renderSidebar(); renderContent();
  }

  function setOut(res) {
    st.pending = res;
    var box = $('#out');
    if (box) box.innerHTML = outputBox(res);
    else { st.view = st.view; st.pending = res; renderContent(); }
  }

  function toast(msg, kind) {
    var el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = msg;
    var root = $('#toastRoot') || $('#app') || document.body;
    root.appendChild(el);
    setTimeout(function () { el.remove(); }, 3200);
  }

  function modal(title, inner) {
    $('#modalRoot').innerHTML = '<div class="mask" data-act="closeModal"><div class="modal">' +
      '<div class="modal-head"><strong>' + esc(title) + '</strong><button class="btn ghost" data-act="closeModal">关闭</button></div>' +
      '<div class="modal-body" data-act="noop">' + inner + '</div></div></div>';
  }
  function closeModal() { $('#modalRoot').innerHTML = ''; }

  /* ---------- 隐私面板 ---------- */
  async function privacyPanel() {
    var p = await LX.store.load();
    var s = LX.privacy.status();
    var rm = LX.privacy.volatile.sweep();
    modal('隐私与安全', [
      '<div class="kv"><span>加密方式</span><strong>' + esc(LX.privacy.modeLabel()) + '</strong></div>',
      '<div class="kv"><span>身份标识</span><strong>' + esc(p.pseudonym) + '</strong><span class="muted">（学号经 SHA-256 假名化，映射表不落本库）</span></div>',
      '<div class="kv"><span>聊后即焚</span><button class="btn ' + (p.settings.burnAfterChat ? 'danger' : 'primary') + '" data-act="toggleBurn">' +
        (p.settings.burnAfterChat ? '已开启，点击关闭' : '已关闭，点击开启') + '</button></div>',
      '<div class="kv"><span>易失态缓存</span><strong>' + LX.privacy.volatile.count() + ' 条</strong><span class="muted">TTL 4 小时，本次清理 ' + rm + ' 条</span></div>',
      '<div class="kv"><span>存储的敏感字段</span><strong>测评作答、维度分</strong><span class="muted">AES-GCM 加密落盘</span></div>',
      '<div class="kv"><span>对话原文</span><strong>0 条</strong><span class="muted">不落盘，仅保留结构化状态</span></div>',
      '<hr>',
      '<h4>本地加密口令</h4>',
      '<p class="muted">当前使用本机演示密钥。设置口令后将改用 PBKDF2（100,000 轮）派生密钥，未输入口令无法读取任何数据。</p>',
      '<input id="passInput" type="password" class="input" placeholder="设置本地口令（至少 6 位）">',
      '<div class="row"><button class="btn primary" data-act="setPass">启用口令加密</button>' +
      '<button class="btn ghost" data-act="lockNow">锁定（清除内存密钥）</button></div>',
      '<hr>',
      '<h4>数据处置</h4>',
      '<div class="row"><button class="btn danger" data-act="wipe">清除全部数据</button>' +
      '<button class="btn ghost" data-act="clearVolatile">清空对话缓存</button></div>',
      '<hr>',
      '<p class="muted">红线：本原型不采集摄像头、微表情、眼动等生物特征；不接入课堂监控、门禁与消费数据。</p>'
    ].join(''));
  }

  function llmPanel() {
    var s = LX.engine.llmState();
    modal('大模型接入', [
      '<div class="notice">不填写则使用内置离线规则引擎，全部计算在本机完成，数据不出浏览器。填入后将以 OpenAI 兼容接口调用外部模型——请仅在确认合规后启用。</div>',
      '<label class="field"><span>是否启用外部模型</span><select id="llmEnabled"><option value="0"' + (s.enabled ? '' : ' selected') + '>否（离线引擎）</option><option value="1"' + (s.enabled ? ' selected' : '') + '>是</option></select></label>',
      '<label class="field"><span>接口地址（OpenAI 兼容）</span><input id="llmEndpoint" class="input" placeholder="https://.../v1/chat/completions" value="' + esc(s.endpoint) + '"></label>',
      '<label class="field"><span>模型名称</span><input id="llmModel" class="input" placeholder="例如 deepseek-chat / qwen-plus" value="' + esc(s.model) + '"></label>',
      '<label class="field"><span>API Key</span><input id="llmKey" class="input" type="password" placeholder="sk-...（仅保存在本机内存，会话结束即失效）"></label>',
      '<div class="row"><button class="btn primary" data-act="saveLLM">保存</button><button class="btn ghost" data-act="closeModal">取消</button></div>',
      '<hr><p class="muted">生产建议：使用校内私有化部署或在合规评估通过后接入；家长端与原始测评数据不得作为上下文外发。</p>'
    ].join(''));
  }

  /* ---------- 事件处理 ---------- */
  async function handle(act, el) {
    var p = await LX.store.load();

    if (act === 'authTab') { st.authMode = el.dataset.mode; showLogin(); return; }
    if (act === 'doLogin') {
      var lu = (($('#authUser') || {}).value || '').trim(), lp = (($('#authPass') || {}).value || ''), lr = (($('#authRole') || {}).value || 'student');
      LX.cloud.login(lu, lp).then(function (d) { st.role = d.role; enterApp(); })
        .catch(function (e) { toast('登录失败：' + e.message, 'warn'); });
      return;
    }
    if (act === 'doRegister') {
      var ru = (($('#authUser') || {}).value || '').trim(), rp = (($('#authPass') || {}).value || ''), rr = (($('#authRole') || {}).value || 'student'), rn = (($('#authName') || {}).value || '');
      if (!ru || !rp) { toast('请填写用户名与密码', 'warn'); return; }
      LX.cloud.register(ru, rp, rr, rn).then(function (d) { st.role = d.role; enterApp(); })
        .catch(function (e) { toast('注册失败：' + e.message, 'warn'); });
      return;
    }
    if (act === 'logout') { LX.cloud.clearSession(); st.role = 'student'; st.view = 'home'; st.authMode = 'login'; showLogin(); return; }

    if (act === 'fetchChild') {
      var cu = (($('#childUser') || {}).value || '').trim();
      if (!cu) { toast('请输入孩子用户名', 'warn'); return; }
      var cbox = $('#childBox');
      if (cbox) cbox.innerHTML = '<p class="muted">正在查询…</p>';
      LX.cloud.child(cu).then(function (d) {
        if (!d.bound) { if (cbox) cbox.innerHTML = '<p class="muted">未绑定该孩子，或孩子用户名不存在。</p>'; return; }
        if (d.assessed === false) { if (cbox) cbox.innerHTML = '<p class="muted">该孩子尚未完成测评。</p>'; return; }
        var s = d.summary;
        if (cbox) cbox.innerHTML = '<div class="sum-grid">' +
          '<div class="sum-cell"><span>整体投入</span><strong>' + bandLabel2(s.engagement_band) + '</strong></div>' +
          '<div class="sum-cell"><span>最需关注</span><strong>' + (s.growing_dims || []).map(dimName).join('、') + '</strong></div>' +
          '</div><div class="guard-note">' + esc(s.note || '') + '</div>';
      }).catch(function (e) { if (cbox) cbox.innerHTML = '<div class="guard-note">查询失败：' + esc(e.message) + '</div>'; });
      return;
    }

    if (act === 'switchRole') { st.role = el.dataset.role; st.view = NAV[st.role][0].id; st.chat = []; st.scenario = null; st.pending = null; renderRoles(); renderSidebar(); renderContent(); return; }
    if (act === 'nav') { st.view = el.dataset.view; st.pending = null; renderSidebar(); renderContent(); return; }

    if (act === 'answer') {
      var cnt = document.querySelectorAll('input[type=radio]:checked').length;
      var pr = $('#progress'); if (pr) pr.textContent = '已作答 ' + cnt + ' / 24';
      return;
    }

    if (act === 'submitAssess') {
      var raw = {}, n = 0;
      LX.ITEMS.forEach(function (it) {
        var sel = document.querySelector('input[name=q' + it.id + ']:checked');
        if (sel) { raw[it.id] = parseInt(sel.value, 10); n++; }
      });
      if (n < LX.ITEMS.length) { toast('还有 ' + (LX.ITEMS.length - n) + ' 题未作答', 'warn'); return; }
      var scores = LX.store.scoreAnswers(raw);
      await LX.store.update(function (pp) {
        pp.assessments.push({ date: today(), scores: scores, raw: raw });
        pp.lastAssessmentDate = today();
      });
      await LX.store.log('assessment', { items: n });
      st.view = 'assessResult';
      renderSidebar(); renderContent();
      toast('已生成成长报告');
      if (LX.cloud.getToken()) {
        LX.cloud.submitAssessment(raw).then(function () { toast('已同步到云端', 'ok'); })
          .catch(function (e) { toast('本地已保存，云端同步失败：' + e.message, 'warn'); });
      }
      return;
    }

    if (act === 'showLast') { st.view = 'assessResult'; renderSidebar(); renderContent(); return; }

    if (act === 'pickScenario') { st.scenario = el.dataset.key; st.chat = []; st.probeIndex = 0; renderContent(); return; }
    if (act === 'backScenario') { st.scenario = null; st.chat = []; renderContent(); return; }

    if (act === 'send') {
      var input = $('#chatInput');
      var text = (input.value || '').trim();
      if (!text) return;
      input.value = '';
      st.chat.push({ role: 'user', text: text });
      var sc = LX.SCENARIOS.filter(function (x) { return x.key === st.scenario; })[0];
      var ctx = { text: text, scenario: sc, profile: p, probeIndex: st.probeIndex };
      var res = LX.engine.studentReply(ctx);
      st.probeIndex++;
      st.chat.push({ role: 'ai', text: res.text, sources: res.sources });
      await LX.store.update(function (pp) { pp.counters.chatTurns++; });
      if (res.risk && res.risk.level >= 3) await LX.store.log('risk-L3', { signals: res.risk.signals.length });
      if (p.settings.burnAfterChat) {
        /* 焚毁：仅保留事件计数，不留原文 */
        LX.privacy.volatile.set('lastTurn', Date.now());
      }
      renderContent();
      var box = $('#chatBox'); if (box) box.scrollTop = box.scrollHeight;
      return;
    }

    if (act === 'checkin') {
      await LX.store.update(function (pp) {
        if (pp.checkins.length && pp.checkins[pp.checkins.length - 1].date === today()) return;
        pp.checkins.push({ date: today(), done: true });
      });
      renderContent(); toast('已打卡');
      return;
    }

    if (act === 'newPlan') {
      var titleEl = $('#planTitle');
      var title = (titleEl && titleEl.value || '未命名计划').trim();
      var level = el.dataset.level;
      await LX.store.update(function (pp) {
        pp.plans.push({
          id: 'PL' + Date.now(), title: title, level: level, createdAt: today(),
          steps: [{ text: '把任务写到纸上，确定最终交付物', done: false },
                  { text: '拆第一步，砍到 10 分钟内可动手', done: false },
                  { text: '做完第一步，回来勾选', done: false }]
        });
      });
      renderContent(); toast('已创建计划');
      return;
    }

    if (act === 'toggleStep') {
      var planId = el.dataset.plan, i = parseInt(el.dataset.i, 10);
      await LX.store.update(function (pp) {
        var pl = pp.plans.filter(function (x) { return x.id === planId; })[0];
        if (pl) pl.steps[i].done = !pl.steps[i].done;
      });
      renderContent();
      return;
    }

    if (act === 'startTimer') {
      var min = parseInt(el.dataset.min, 10);
      if (st.timer) clearInterval(st.timer);
      var end = Date.now() + min * 60000;
      st.timer = setInterval(function () {
        var left = Math.max(0, end - Date.now());
        var t = $('#timerText');
        if (!t) { clearInterval(st.timer); st.timer = null; return; }
        var mm = Math.floor(left / 60000), ss = Math.floor((left % 60000) / 1000);
        t.textContent = mm + ':' + (ss < 10 ? '0' : '') + ss;
        if (left <= 0) {
          clearInterval(st.timer); st.timer = null; t.textContent = '完成 ✓';
          LX.store.update(function (pp) { pp.counters.practiceCount++; });
          toast('练习完成，记得真正休息一下');
        }
      }, 500);
      toast('开始 ' + min + ' 分钟练习');
      return;
    }
    if (act === 'stopTimer') { if (st.timer) { clearInterval(st.timer); st.timer = null; } var tt = $('#timerText'); if (tt) tt.textContent = '—'; return; }

    if (act === 'toggleConsent') {
      var key = el.dataset.key;
      var to = !p.settings[key];
      await LX.store.update(function (pp) { pp.settings[key] = to; });
      await LX.store.log('consent-change', { key: key, to: to });
      renderContent();
      toast(to ? '已授予授权（可随时撤回）' : '已撤回授权，相关视图即时下线');
      return;
    }

    if (act === 'exportDoc') {
      var mdEmpty = !latestScores(p);
      if (mdEmpty) { toast('请先完成一次测评', 'warn'); return; }
      download('学业韧性成长报告_' + today() + '.doc', reportWordHtml(p), 'application/msword');
      return;
    }
    if (act === 'exportMd') {
      if (!latestScores(p)) { toast('请先完成一次测评', 'warn'); return; }
      download('学业韧性成长报告_' + today() + '.md', reportMarkdown(p), 'text/markdown');
      return;
    }

    if (act === 'toggleBurn') {
      await LX.store.update(function (pp) { pp.settings.burnAfterChat = !pp.settings.burnAfterChat; });
      privacyPanel(); renderRoles();
      return;
    }

    if (act === 'wipe') {
      await LX.store.reset();
      st.chat = []; st.scenario = null; st.pending = null; st.view = NAV[st.role][0].id;
      closeModal(); render();
      toast('全部数据已清除');
      return;
    }
    if (act === 'clearVolatile') { LX.privacy.volatile.clear(); privacyPanel(); toast('对话缓存已清空'); return; }

    if (act === 'setPass') {
      var v = ($('#passInput') || {}).value || '';
      if (v.length < 6) { toast('口令至少 6 位', 'warn'); return; }
      try {
        await LX.privacy.unlock(v);
        await LX.store.persist();
        closeModal(); toast('已启用口令派生密钥（PBKDF2）');
      } catch (e) { toast(e.message, 'warn'); }
      return;
    }
    if (act === 'lockNow') { LX.privacy.lock(); closeModal(); toast('已锁定，需重新解锁'); return; }

    if (act === 'openPrivacy') { privacyPanel(); return; }
    if (act === 'openLLM') { llmPanel(); return; }
    if (act === 'closeModal') { closeModal(); return; }
    if (act === 'noop') { return; }

    if (act === 'saveLLM') {
      LX.engine.setLLM({
        enabled: $('#llmEnabled').value === '1',
        endpoint: $('#llmEndpoint').value.trim(),
        model: $('#llmModel').value.trim(),
        key: $('#llmKey').value.trim()
      });
      closeModal(); toast('模型配置已保存（密钥仅存于内存）');
      return;
    }

    if (act === 'toggleK') { st.applyK = el.checked; renderContent(); return; }

    if (act === 'genHelp') { setOut(LX.engine.teacherPlan(LX.MockCohort, 'help')); return; }
    if (act === 'genStyle') { setOut(LX.engine.teacherPlan(LX.MockCohort, 'style')); return; }
    if (act === 'genMaterial') { setOut(LX.engine.teacherPlan(LX.MockCohort, 'parent')); return; }
    if (act === 'genTrack') { setOut(LX.engine.teacherPlan(LX.MockCohort, 'track')); return; }

    if (act === 'pickPeer') {
      st.peer = LX.MockPeers.filter(function (x) { return x.pid === el.dataset.pid; })[0];
      renderContent(); toast('已选择 ' + st.peer.alias);
      return;
    }
    if (act === 'genOutline') {
      setOut(LX.engine.peerOutline(el.dataset.stage, st.peer));
      return;
    }
    if (act === 'doRewrite') {
      var rwv = $('#rwInput').value.trim();
      if (!rwv) { toast('请输入一句话', 'warn'); return; }
      setOut(LX.engine.rewriteSupportive(rwv));
      return;
    }
    if (act === 'genFlow') { setOut(LX.engine.peerFlow(st.peer)); return; }
    if (act === 'addHighlight') {
      var hv = ($('#hlInput') || {}).value || '';
      if (!hv.trim()) return;
      await LX.store.update(function (pp) {
        pp.highlights.push(hv.trim().slice(0, 50));
        if (pp.highlights.length > 12) pp.highlights = pp.highlights.slice(-12);
      });
      renderContent(); toast('已记录亮点');
      return;
    }
    if (act === 'genRes') {
      setOut(LX.engine.resourceGuide(($('#resInput') || {}).value || ''));
      return;
    }

    if (act === 'genSci') { setOut(LX.engine.parentScience(($('#sciInput') || {}).value || '')); return; }
    if (act === 'doTalk') {
      var tv = $('#talkInput').value.trim();
      if (!tv) { toast('请输入你想说的话', 'warn'); return; }
      setOut(LX.engine.parentTalkCoach(tv));
      return;
    }
  }

  /* ---------- 初始化 ---------- */
  async function init() {
    await LX.privacy.ensureReady();
    await LX.store.load();
    if (LX.cloud.getToken()) {
      var savedRole = LX.cloud.getRole();
      if (savedRole) st.role = savedRole;
      enterApp();
    } else {
      showLogin();
    }

    function isFormControl(el) {
      if (!el || !el.tagName) return false;
      return ['INPUT', 'SELECT', 'TEXTAREA', 'LABEL', 'OPTION'].indexOf(el.tagName) >= 0;
    }

    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
      if (!t) return;
      if (isFormControl(t)) return;
      e.preventDefault();
      handle(t.dataset.act, t);
    });

    document.addEventListener('change', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
      if (!t) return;
      var a = t.dataset.act;
      if (a === 'answer') { handle('answer', t); }
      else if (a === 'toggleStep') { handle('toggleStep', t); }
      else if (a === 'toggleK') {
        st.applyK = t.checked;
        renderContent();
      }
    });

    document.addEventListener('input', function (e) {
      if (e.target.id === 'rwInput') st.draft.rw = e.target.value;
      if (e.target.id === 'talkInput') st.draft.talk = e.target.value;
    });
  }

  LX.ui = { init: init, state: st };
})();
