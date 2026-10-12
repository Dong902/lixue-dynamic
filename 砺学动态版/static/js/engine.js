/* 砺学体系 · 智能体引擎
 * 离线规则引擎 + 可选大模型桥接 + 护栏 + 风险分级
 */
window.LX = window.LX || {};

(function () {
  /* ========== 0. 护栏：负面清单与正向转译 ========== */
  var BANNED = ['差生', '后进生', '问题学生', '矫治', '废物', '没救了', '不可救药', '劣等'];
  var REPLACE_MAP = [
        [/你怎么总是这样/g, '我注意到最近几次都是这样'],
        [/你怎么总是/g, '我注意到最近几次'],
        [/你怎么这么/g, '我注意到你'],
        [/你怎么又不/g, '我注意到'],
        [/你怎么又/g, '我注意到'],
        [/你总是/g, '最近几次'],
        [/你应该/g, '如果你愿意，可以试试'],
        [/你为什么不能/g, '是哪一步让你觉得难'],
        [/这样不行/g, '我们可以换一种方式'],
        [/太懒了/g, '启动这一步似乎不太容易'],
        [/笨/g, '还没找到合适的方法'],
        [/你必须/g, '你可以先考虑']
  ];

  function guardOut(text) {
    var hits = [];
    BANNED.forEach(function (w) {
      if (text.indexOf(w) >= 0) hits.push(w);
    });
    var clean = text;
    BANNED.forEach(function (w) { clean = clean.split(w).join(''); });
    return { text: clean, hits: hits };
  }

  function toPositive(text) {
    var out = text;
    REPLACE_MAP.forEach(function (p) { out = out.replace(p[0], p[1]); });
    return out;
  }

  /* ========== 1. 知识库检索（RAG 简化实现） ========== */
  function tokenize(s) {
    return String(s || '').toLowerCase().replace(/[^\u4e00-\u9fa5a-z0-9]/g, ' ').split(/\s+/).filter(function (x) { return x; });
  }

  function retrieve(query, opts) {
    opts = opts || {};
    var qs = tokenize(query);
    var scored = LX.KB.map(function (e) {
      var score = 0;
      var hay = (e.title + ' ' + e.keywords.join(' ') + ' ' + e.body).toLowerCase();
      qs.forEach(function (t) {
        if (t.length < 2) return;
        if (e.keywords.join(' ').toLowerCase().indexOf(t) >= 0) score += 3;
        if (e.title.toLowerCase().indexOf(t) >= 0) score += 2;
        if (hay.indexOf(t) >= 0) score += 1;
      });
      return { e: e, s: score };
    }).filter(function (x) { return x.s > 0; })
      .sort(function (a, b) { return b.s - a.s; });

    if (opts.domain) scored = scored.filter(function (x) { return x.e.domain === opts.domain; });
    if (opts.ids) scored = scored.filter(function (x) { return opts.ids.indexOf(x.e.id) >= 0; });
    return scored.slice(0, opts.top || 3).map(function (x) { return x.e; });
  }

  function byIds(ids) {
    return ids.map(function (id) {
      return LX.KB.filter(function (e) { return e.id === id; })[0];
    }).filter(Boolean);
  }

  /* ========== 2. 风险分级 ========== */
  var SIG = {
    3: ['自杀', '不想活', '结束生命', '伤害自己', '自残', '活着没意思', '想消失', '轻生', '伤害别人', '同归于尽'],
    2: ['撑不住', '崩溃', '熬不下去', '想退学', '活不下去', '没意义', '整夜睡不着', '长期失眠', '吃不下', '完全学不了'],
    1: ['跟不上', '效率低', '拖延', '焦虑', '压力大', '慌', '来不及', '看不懂', '学不进去']
  };

  function assessRisk(text, profile) {
    var t = String(text || '');
    var signals = [];
    var level = 0;
    function hit(arr, lv, label) {
      for (var i = 0; i < arr.length; i++) {
        if (t.indexOf(arr[i]) >= 0) { signals.push(label + '：命中“' + arr[i] + '”'); level = Math.max(level, lv); return true; }
      }
      return false;
    }
    hit(SIG[3], 3, '危机信号');
    hit(SIG[2], 2, '功能受损');
    hit(SIG[1], 1, '一般困扰');

    /* 多信号融合：维度下滑 + 连续未打卡 */
    if (profile && profile.assessments && profile.assessments.length >= 2) {
      var last = profile.assessments[profile.assessments.length - 1].scores;
      var prev = profile.assessments[profile.assessments.length - 2].scores;
      var down = 0;
      LX.DIM_KEYS.forEach(function (k) { if (last[k] - prev[k] <= -0.4) down++; });
      if (down >= 3) { signals.push('多信号：' + down + ' 个维度同步下滑'); level = Math.max(level, 2); }
    }
    if (profile && profile.checkins) {
      var recent = profile.checkins.slice(-14).filter(function (c) { return !c.done; }).length;
      if (recent >= 7) { signals.push('多信号：近两周连续未打卡'); level = Math.max(level, Math.max(level, 1) === 1 ? 1 : 1); }
    }
    return { level: level, signals: signals };
  }

  function riskResponse() {
    return [
      '我听到你现在很不容易。这一刻我不想再多说什么方法了——接下来请务必联系真人：',
      '',
      '· 学校心理健康教育与辅导中心（个体咨询，免费且保密）',
      '· 校内心理援助热线（非工作时间即时支持）',
      '· 你的辅导员或班主任（他们会帮你对接资源）',
      '· 情况紧急时请直接拨打 120 或前往校医院',
      '',
      '我已经把这个情况提交给人工责任人。你不需要独自扛这件事。'
    ].join('\n');
  }

  /* ========== 3. 学术诚信护栏 ========== */
  var CHEAT = ['帮我写完', '直接给我答案', '代写', '给我标准答案', '考试答案', '替我做题', '帮我作弊'];
  function integrityCheck(t) {
    for (var i = 0; i < CHEAT.length; i++) {
      if (t.indexOf(CHEAT[i]) >= 0) return CHEAT[i];
    }
    return null;
  }
  function integrityReply() {
    return '这一步我不能替你完成——它关系到学术诚信，也关系到你自己的成长曲线。\n\n我可以做的是：\n' +
      '① 帮你确定这一步到底要产出什么；\n' +
      '② 帮你把它拆到能动手的第一小块；\n' +
      '③ 在你写出初稿后，帮你看逻辑和漏洞，提出改进问题。\n\n' +
      '要不要先从②开始？告诉我任务最终要交的是什么。';
  }

  /* ========== 4. 四端 System Prompt（接入大模型时使用） ========== */
  var PROMPTS = {
    student: [
      '你是 AI青砺助手，一名面向学习困难大学生的学业韧性教练。语气：平等、克制、不煽情、不评判。',
      '',
      '【核心立场】',
      '1. 你描述的对象是“可塑能力”，不是缺陷。绝不输出能力排名、群体位次，绝不使用“差生/后进/问题学生”等标签。',
      '2. 低分维度一律表述为“正在练习的方向”。',
      '3. 采用“成长型语言模板”：现状描述 → 已具备的资源 → 学生可自选的下一步动作（2–3 项）。',
      '4. 苏格拉底式提问优先于直接给结论；先问清处境，再给方法。',
      '',
      '【禁止】',
      '· 直接提供作业、论文、考试的标准答案或代写内容（学术诚信红线）；可提供改写建议、结构建议与追问。',
      '· 推断或使用任何生物特征（摄像头、微表情、眼动）来判断注意力或情绪。',
      '· 开展心理危机疏导。一旦出现自伤、伤害他人或严重功能受损信号，立即终止自主对话，只做陪伴与转介。',
      '',
      '【输出格式】',
      '先共情（1 句，不作评判）→ 一个澄清问题 → 方法要点（来自知识库，标注来源编号）→ 一个≤25 分钟的最小可行动作。'
    ].join('\n'),
    teacher: [
      '你是 AI砺学顾问，面向辅导员与学业导师的群体层面学业顾问。',
      '',
      '【核心立场】',
      '1. 默认只输出群体聚合结果；不生成点名式的个体处置建议。',
      '2. 任何输出须先过 k-匿名（k≥5）与交叉抑制（≥4 个交叉维度须汇总到上级粒度）。',
      '3. 不展示学生的测评原始作答内容。',
      '4. 所有方案为“草案”，须明确标注依据与局限，由教师审核后生效。',
      '',
      '【输出格式】',
      '结论先行 → 依据（数据口径 + 样本量）→ 分层建议 → 局限与注意事项。'
    ].join('\n'),
    peer: [
      '你是 AI伴砺助教，服务“学习困难关爱社”朋辈志愿者。',
      '',
      '【核心立场】',
      '1. 赋能志愿者，而非替代其判断。',
      '2. 明确角色边界：陪伴 ≠ 心理咨询。遇到心理困扰、自伤意念、严重功能受损，立即停止生成话术，引导上报指导教师或心理中心。',
      '3. 所有沟通话术须为鼓励式、描述式，避免评判与说教。',
      '4. 记录以“成长亮点”为主，不做能力缺陷记录。',
      '',
      '【输出格式】',
      '提纲或话术 → 使用提示 → 边界提示（何时必须转介）。'
    ].join('\n'),
    parent: [
      '你是 AI砺伴，面向学习困难大学生的家长。',
      '',
      '【核心立场】',
      '1. 核心任务是帮家长理解大学学业、学会支持性沟通，而不是向家长披露孩子的数据。',
      '2. 家长端硬约束：不展示成绩、绩点、排名、考勤、违纪、测评维度分、心理咨询记录、诊断信息、同伴姓名、家庭经济状况。',
      '3. 所有个体信息须经学生授权且未撤回；所有低分维度表述为“正在练习的方向”。',
      '4. 不做家庭关系诊断；冲突场景提供降级话术并建议联系辅导员。',
      '',
      '【输出格式】',
      '先共情家长的担心 → 给出大学学业的事实性说明 → 给出 2–3 句可直接使用的沟通话术。'
    ].join('\n')
  };

  /* ========== 5. 情境卡片 → 知识条目映射 ========== */
  var SCENARIO_KB = {
    preview: ['K2-09', 'K2-05'],
    review: ['K2-01', 'K2-02', 'K2-08'],
    paper: ['K2-04'],
    decompose: ['K2-06'],
    finals: ['K2-07', 'K3-04'],
    procrastinate: ['K3-05', 'K2-05']
  };

  /* ========== 6. 学生端：场景辅导生成 ========== */
  function studentReply(ctx) {
    var text = ctx.text || '';
    var sc = ctx.scenario;
    var risk = assessRisk(text, ctx.profile);
    if (risk.level >= 3) {
      return { text: riskResponse(), risk: risk, stop: true, sources: [] };
    }
    var cheat = integrityCheck(text);
    if (cheat) return { text: integrityReply(), risk: risk, sources: [] };

    var pool = sc ? byIds(SCENARIO_KB[sc.key] || []) : [];
    var extra = retrieve(text, { top: 2 });
    var sources = pool.slice(0, 2);
    extra.forEach(function (e) { if (sources.indexOf(e) < 0 && sources.length < 3) sources.push(e); });
    if (!sources.length) sources = retrieve('学习方法', { top: 1 });

    var parts = [];
    parts.push(acknowledge(text, sc));

    if (sc) {
      var probe = pickProbe(sc, ctx.probeIndex || 0);
      if (probe) parts.push('先确认一件事：**' + probe + '**');
    }

    if (sources.length) {
      parts.push('参考方法是「' + (sc ? sc.method : '下面这些方法') + '」，要点如下：');
      sources.forEach(function (e) {
        var lines = e.body.split('\n').filter(function (l) { return l.trim(); }).slice(0, 3);
        lines.forEach(function (l) { parts.push('· ' + l.trim()); });
      });
      parts.push('（来源：' + sources.map(function (e) { return e.id; }).join('、') + '）');
    }

    parts.push('**现在最小的一步**：' + microStep(sc, text));

    if (risk.level === 2) {
      parts.push('');
      parts.push('另外，我感觉到你最近的压力不小。如果这种状态持续，建议考虑联系辅导员或学校心理中心——这不是“撑不住”的表现，而是会用资源的表现。要不要我把相关资源列给你？');
    }

    var guarded = guardOut(parts.join('\n'));
    return { text: guarded.text, risk: risk, sources: sources, guardHits: guarded.hits };
  }

  function acknowledge(text, sc) {
    if (!text) return sc ? '我们来看「' + sc.name + '」。' : '说说你现在卡在哪？';
    var t = text.trim();
    var core = t.length > 40 ? t.slice(0, 38) + '……' : t;
    return '你说的是：' + core + '。这件事确实不容易开始。';
  }

  function pickProbe(sc, idx) {
    if (!sc || !sc.probes) return null;
    return sc.probes[idx % sc.probes.length];
  }

  function microStep(sc, text) {
    var k = sc ? sc.key : 'decompose';
    var map = {
      preview: '花 8 分钟翻一下下次课的目录与 PPT 标题，写下 1 个你想在课上搞清楚的问题。',
      review: '合上书，用一张白纸默写出这一节你能想起的所有要点，然后再翻开补全——这一步比再看一遍书有用得多。',
      paper: '先用 15 分钟做第一遍阅读：标题、摘要、图表、结论。读完判断“这篇对我有没有用”，再决定要不要深入。',
      decompose: '把任务的第一步再砍一半，砍到不用思考就能动手的程度，然后只做这一个小动作（建议不超过 10 分钟）。',
      finals: '列出科目与考试日期，标注每门学分权重，圈出“高学分 + 低掌握度”的那 1–2 门作为本周重点。',
      procrastinate: '设一个 5 分钟的计时器，告诉自己“只做 5 分钟”。时间到就可以停，但通常你会愿意继续。'
    };
    return map[k] || map.decompose;
  }

  /* ========== 7. 教师端：群体画像与方案 ========== */
  function cohortRows(rows) {
    return rows.slice();
  }

  function weakestDims(rows) {
    var agg = {};
    LX.DIM_KEYS.forEach(function (k) { agg[k] = { sum: 0, n: 0 }; });
    rows.forEach(function (r) {
      LX.DIM_KEYS.forEach(function (k) {
        agg[k].sum += r[k] * r.n;
        agg[k].n += r.n;
      });
    });
    var out = LX.DIMS.map(function (d) {
      return { key: d.key, name: d.name, avg: Math.round((agg[d.key].sum / agg[d.key].n) * 100) / 100 };
    }).sort(function (a, b) { return a.avg - b.avg; });
    return out;
  }

  function teacherPlan(rows, kind) {
    var dims = weakestDims(rows);
    var totalN = rows.reduce(function (s, r) { return s + r.n; }, 0);
    var weak = dims.slice(0, 2);
    var lines = [];

    if (kind === 'help') {
      lines.push('**结论**：本批次样本共 ' + totalN + ' 人，最需要支持的两个方向是「' + weak[0].name + '」（均分 ' + weak[0].avg + '）与「' + weak[1].name + '」（均分 ' + weak[1].avg + '）。');
      lines.push('');
      lines.push('**分层帮扶建议**');
      lines.push('· 第一层（稳健层）：以自主赋能为主，提供资源清单与方法工具包，不占用一对一资源。');
      lines.push('· 第二层（波动层）：' + '围绕「' + weak[0].name + '」开展 4 周小组干预，每两周一次方法工作坊。');
      lines.push('· 第三层（需关注层）：一对一配对朋辈志愿者，配学业导师每月一次会谈。名单须走线下既有流程确认，不由本系统直接生成。');
      lines.push('');
      lines.push('**资源配比**：按 1 名志愿者对接 3–4 名学生的经验比例配置。');
      lines.push('');
      lines.push('**依据与局限**：数据为聚合级，已过 k-匿名（k≥5）处理；本结论为草案，须教师结合日常观察核验后方可执行。');
    } else if (kind === 'style') {
      lines.push('**结论**：学风建设的着力点宜放在「可观测的学习行为」而非思想动员。');
      lines.push('');
      lines.push('· 主题班会设计：以「' + weak[0].name + '」为主题，采用同伴分享 + 现场演练的形式（避免单向宣讲）。');
      lines.push('· 学习共同体：按 4–6 人组建固定学习小组，指定每周一次共学时段，产出为共同的错题集。');
      lines.push('· 作业节奏：建议将大作业拆分为至少两个中间节点提交，把反馈周期缩短。');
      lines.push('· 关键节点：考前第 3 周与第 1 周各安排一次集体自习或答疑。');
      lines.push('');
      lines.push('**局限**：本方案基于群体层面推断，个别班级可能有特殊成因，建议由辅导员结合实际情况调整。');
    } else if (kind === 'parent') {
      lines.push('**家校沟通常用科普材料（不含任何个体数据）**');
      lines.push('');
      lines.push('标题建议：《致家长：为什么大学里的“成绩”来得这么慢》');
      lines.push('');
      var src = byIds(['K5-01', 'K5-02']);
      src.forEach(function (e) {
        lines.push('**' + e.title + '**（' + e.id + '）');
        e.body.split('\n').forEach(function (l) { if (l.trim()) lines.push(l.trim()); });
        lines.push('');
      });
      lines.push('使用提示：本材料不引用任何学生个体数据，可批量发放。');
    } else {
      lines.push('**跨期追踪说明**');
      lines.push('');
      lines.push('· 对比口径：跨期进行比较时，须确认两次测评的量表版本、样本构成与施测情境一致。');
      lines.push('· 样本变动：' + totalN + ' 人（聚合级），若单期样本变动超过 20%，须在报告中标注。');
      lines.push('· 归因谨慎：群体自然波动的存在意味着不宜将变化直接归因于干预，建议设对照组或采用前后测设计。');
      lines.push('');
      lines.push('本批次最弱维度：' + dims.slice(0, 3).map(function (d) { return d.name + '（' + d.avg + '）'; }).join('、') + '。');
    }

    var guarded = guardOut(lines.join('\n'));
    return { text: guarded.text, guardHits: guarded.hits };
  }

  /* ========== 8. 朋辈端：提纲、话术、流程 ========== */
  function peerOutline(stage, p) {
    var map = {
      '建立关系': [
        '开场：「我们是同专业的，老师让我陪你聊聊学习上的事——先说清楚，我不是来考核你的。」',
        '提问：最近哪门课让你觉得最吃力？是从什么时候开始的？',
        '提问：在那之前，你哪一门学得还算顺？那门是怎么学的？',
        '收尾：这次先到这，下次我们聊聊那门吃力的课的具体卡点。'
      ],
      '定位需求': [
        '回顾：上次你说到 XX，这周有没有什么变化？',
        '提问：如果要把这件事往前推一步，你觉得卡在哪儿？',
        '提问：是需要有人讲清楚，还是需要有人盯着你去做的节奏？',
        '收尾：那我们试试 XX，下周四这个时间我们再复盘一次。'
      ],
      '共设目标': [
        '开场：这周我们定一个「小到不好意思不定」的目标。',
        '提问：这周你最有把握完成的是哪一件？',
        '确认：把它写下来，具体到「周几、几点、做什么、多久」。',
        '收尾：我会问你完成情况，但不是为了检查，是为了看怎么调整更合适。'
      ],
      '方法练习': [
        '带着一个具体任务来，现场做一次（如番茄钟、一次合书默写）。',
        '做完后问：和你平时的做法比，哪里有不一样的感觉？',
        '一起决定：这个方法要不要保留，如果需要，怎么改更适合你。',
        '收尾：留一个同样的练习作为这周的任务。'
      ],
      '复盘调整': [
        '先问完成情况，不带任何评价地听完。',
        '提问：是什么让它没做成？是太大、太模糊，还是时机不对？',
        '根据回答把下一步再砍一半，或换一个更合适的触发时机。',
        '明确：这是方法不合适，不是你不行。'
      ],
      '阶段总结': [
        '一起回顾这段时间的记录，重点看「亮点」。',
        '提问：这段时间哪一件事你以前做不到、现在能做到？',
        '把它写进亮点卡，征求对方同意后可用于后续反馈。',
        '商量：接下来是否继续，还是交给其他资源。'
      ]
    };
    var lines = map[stage] || map['建立关系'];
    var head = ['**「' + stage + '」阶段访谈提纲**' + (p ? '（对象：' + p.alias + '）' : ''), ''];
    var body = lines.map(function (l) { return '· ' + l; });
    body.push('');
    body.push('**边界提示**：若对方出现持续低落、表达自伤念头或严重的睡眠饮食紊乱，请停止继续提问，改为陪伴，并立即上报指导教师或转介心理中心。');
    var g = guardOut(head.concat(body).join('\n'));
    return { text: g.text, guardHits: g.hits };
  }

  function rewriteSupportive(t) {
    var out = toPositive(t);
    var notes = [];
    if (/怎么又|总是|从来|每次都/.test(t)) notes.push('检测到绝对化表述（“总是/从来”），容易引发防御，已改为描述具体情境。');
    if (/应该|必须|赶紧/.test(t)) notes.push('检测到命令式表述，已改为提供选项。');
    if (/不行|太差|懒/.test(t)) notes.push('检测到评判性词语，已改为描述行为本身。');
    if (!notes.length) notes.push('这句话本身已经是支持性的表达，可以直接使用。');
    var g = guardOut(out);
    return { text: g.text, notes: notes, guardHits: g.hits };
  }

  function peerFlow(p) {
    var stages = ['建立关系', '定位需求', '共设目标', '方法练习', '复盘调整', '阶段总结'];
    var lines = ['**一对一帮扶流程模板（6 次会话）**' + (p ? '　对象：' + p.alias + '（' + p.grade + '）' : ''), ''];
    stages.forEach(function (s, i) {
      lines.push((i + 1) + '. ' + s + (p && i < p.sessions ? '　✓ 已完成' : ''));
    });
    lines.push('');
    lines.push('频次建议：每周 1 次，每次 30–45 分钟；连续 2 次联系不上应上报指导教师。');
    lines.push('边界提示：志愿者不承担心理咨询、危机干预与学业评价职责。');
    var g = guardOut(lines.join('\n'));
    return { text: g.text, guardHits: g.hits };
  }

  function resourceGuide(query) {
    var hits = retrieve(query, { domain: 'K4', top: 3 });
    if (!hits.length) hits = byIds(['K4-01', 'K4-02', 'K4-03']);
    var lines = ['**校园资源智能导引**', ''];
    hits.forEach(function (e) {
      lines.push('**' + e.title + '**（' + e.id + '）');
      e.body.split('\n').forEach(function (l) { if (l.trim()) lines.push('· ' + l.trim()); });
      lines.push('');
    });
    var res = LX.RESOURCES.slice(0, 5);
    lines.push('**可直接联系的资源清单**');
    res.forEach(function (r) { lines.push('· ' + r.name + '：' + r.desc + '（' + r.booking + '）'); });
    var g = guardOut(lines.join('\n'));
    return { text: g.text, guardHits: g.hits };
  }

  /* ========== 9. 家长端 ========== */
  function parentScience(query) {
    var hits = retrieve(query || '大学 学业 沟通', { domain: 'K5', top: 2 });
    if (!hits.length) hits = byIds(['K5-01', 'K5-02']);
    var lines = [];
    hits.forEach(function (e) {
      lines.push('**' + e.title + '**（' + e.id + '）');
      e.body.split('\n').forEach(function (l) { if (l.trim()) lines.push(l.trim()); });
      lines.push('');
    });
    lines.push('提示：本页面不显示孩子的任何成绩、排名或测评数据，这是设计的底线，也是为了让沟通回到支持本身。');
    var g = guardOut(lines.join('\n'));
    return { text: g.text, guardHits: g.hits };
  }

  function parentTalkCoach(t) {
    var riskWords = ['你必须', '你应该考', '别人家', '你怎么这么', '白培养', '丢人', '没出息'];
    var hit = riskWords.filter(function (w) { return t.indexOf(w) >= 0; });
    var lines = ['**你原本想说**：' + t, ''];
    if (hit.length) {
      lines.push('**风险提示**：检测到「' + hit.join('、') + '」等表述，容易让孩子进入防御或回避状态，沟通可能升级为冲突。');
      lines.push('');
      lines.push('**建议的替代表达**：');
      lines.push('· 「我们不是要追问结果，只是想知道你最近过得累不累。」');
      lines.push('· 「这件事你自己是怎么想的？我们想先听听你的。」');
      lines.push('· 「如果需要帮忙，告诉我们具体哪一件，别的我们不插手。」');
      lines.push('');
      lines.push('**如果已经在冲突中**：先暂停——「我们先各自缓一下，明天再聊」，把评价换成描述（“我很担心”而不是“你怎么又……”）。');
    } else {
      lines.push('**反馈**：这句话没有明显的评判或命令成分，语气是平的。');
      lines.push('');
      lines.push('可以更进一步的一个改法：在结尾加一句把决定权交还给对方的话，例如「你自己觉得呢？」或「需要我们的时候说一声」。');
    }
    lines.push('');
    lines.push('注意：本模拟对话不会被保存，也不会被孩子看到。');
    var g = guardOut(lines.join('\n'));
    return { text: g.text, guardHits: g.hits };
  }

  function familyPlan(summary) {
    var lines = ['**家庭支持方案**', ''];
    if (!summary) {
      lines.push('当前尚未获得授权，无法查看孩子的成长摘要。这是完全正常的——大学阶段的孩子需要这样的空间。');
      lines.push('');
    } else {
      lines.push('基于已授权的脱敏摘要（' + summary.period + '）：');
      lines.push('· 学习投入：' + summary.summary.engagement);
      lines.push('· 已启动能力练习：' + summary.summary.practiceStarted + ' 次');
      lines.push('· 主动求助：' + summary.summary.helpSeeking + ' 次');
      if (summary.highlights.length) lines.push('· 近期亮点：' + summary.highlights.join('；'));
      lines.push('');
    }
    lines.push('**家庭侧可以做的四件事**');
    var s = byIds(['K5-04'])[0];
    s.body.split('\n').forEach(function (l) { if (l.trim()) lines.push(l.trim()); });
    lines.push('');
    lines.push('**应减少的对话**：反复追问名次、与他人比较、把单次成绩与前途直接挂钩。');
    var g = guardOut(lines.join('\n'));
    return { text: g.text, guardHits: g.hits };
  }

  /* ========== 10. 大模型桥接 ========== */
  var llmCfg = { enabled: false, endpoint: '', key: '', model: '' };

  function setLLM(cfg) {
    llmCfg = {
      enabled: !!cfg.enabled,
      endpoint: cfg.endpoint || '',
      key: cfg.key || '',
      model: cfg.model || ''
    };
  }
  function llmState() {
    return { enabled: llmCfg.enabled, endpoint: llmCfg.endpoint, model: llmCfg.model, hasKey: !!llmCfg.key };
  }

  async function callLLM(role, messages) {
    if (!llmCfg.enabled || !llmCfg.endpoint) throw new Error('未配置大模型');
    var sys = PROMPTS[role] || PROMPTS.student;
    var res = await fetch(llmCfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + llmCfg.key },
      body: JSON.stringify({ model: llmCfg.model, messages: [{ role: 'system', content: sys }].concat(messages), temperature: 0.6 })
    });
    if (!res.ok) throw new Error('模型服务返回 ' + res.status);
    var j = await res.json();
    var content = j.choices && j.choices[0] && j.choices[0].message ? j.choices[0].message.content : (j.content || '');
    return guardOut(content).text;
  }

  LX.engine = {
    guardOut: guardOut, toPositive: toPositive,
    retrieve: retrieve, byIds: byIds,
    assessRisk: assessRisk, riskResponse: riskResponse,
    integrityCheck: integrityCheck,
    studentReply: studentReply,
    cohortRows: cohortRows, weakestDims: weakestDims, teacherPlan: teacherPlan,
    peerOutline: peerOutline, rewriteSupportive: rewriteSupportive, peerFlow: peerFlow, resourceGuide: resourceGuide,
    parentScience: parentScience, parentTalkCoach: parentTalkCoach, familyPlan: familyPlan,
    PROMPTS: PROMPTS,
    setLLM: setLLM, llmState: llmState, callLLM: callLLM,
    BANNED: BANNED
  };
})();
