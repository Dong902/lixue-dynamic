/* 砺学动态版 · 前端渲染联调（jsdom 同源加载 + 真实 fetch 到后端） */
const { JSDOM } = require('C:/Users/董燕艳/.workbuddy/binaries/node/workspace/node_modules/jsdom/lib/api.js');
const BASE = 'http://127.0.0.1:8014';

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS', name); }
  else { fail++; console.log('FAIL', name, extra || ''); }
}
function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
async function until(fn, tries = 60, gap = 200) {
  for (let i = 0; i < tries; i++) { if (fn()) return true; await wait(gap); }
  return false;
}

(async () => {
  const dom = await JSDOM.fromURL(BASE + '/index.html', {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    beforeParse(window) {
      // Node 22 自带全局 fetch；注入到 jsdom 窗口，并把相对路径按后端基址补全
      window.fetch = (url, opts) => {
        const abs = (typeof url === 'string' && url.startsWith('/')) ? (BASE + url) : url;
        return global.fetch(abs, opts);
      };
    },
  });
  const { window } = dom;
  const doc = window.document;

  // 1) 登录屏出现
  const loginOk = await until(() => doc.querySelector('#app .auth-card'));
  check('登录屏渲染', loginOk);
  check('登录按钮存在', !!doc.querySelector('[data-act="doLogin"]'));

  // 2) 教师登录：填表 + 触发 doLogin 点击
  doc.getElementById('authUser').value = 'teacher01';
  doc.getElementById('authPass').value = 'demo1234';
  doc.getElementById('authRole').value = 'teacher';
  const loginBtn = doc.querySelector('[data-act="doLogin"]');
  loginBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const appOk = await until(() => doc.querySelector('#roles'));
  check('登录后进入四端骨架', appOk);
  check('教师角色已设定(四角色 tab)', doc.querySelectorAll('.role-tab').length === 4);
  check('默认进入群体画像', !!doc.querySelector('[data-act="nav"][data-view="cohort"]'));

  // 3) 群体画像从服务端加载真实聚合
  const cohortOk = await until(() => {
    const box = doc.getElementById('cohortBody');
    return box && (box.querySelector('table.tbl') || box.querySelector('.guard-note'));
  }, 80, 200);
  check('群体画像加载完成', cohortOk);
  const cbox = doc.getElementById('cohortBody');
  check('展示群体均值表', cbox && cbox.querySelector('table.tbl') && /群体均值/.test(cbox.innerHTML));
  check('聚合样本量 n=6', cbox && /n=6/.test(cbox.innerHTML));

  // 4) 家长端：直接走云端层验证孩子摘要（演示 parent01 绑定 stu01）
  const plogin = await window.LX.cloud.login('parent01', 'demo1234');
  check('家长登录成功', plogin && plogin.role === 'parent');
  const child = await window.LX.cloud.child('stu01');
  check('家长查到孩子摘要', child && child.assessed === true && child.summary && child.summary._raw_excluded === true);
  // 模拟 psum 视图 + 查询点击：先登出回到登录屏，再以家长身份登录
  doc.querySelector('[data-act="logout"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await until(() => doc.querySelector('#app .auth-card'));
  doc.getElementById('authUser').value = 'parent01';
  doc.getElementById('authPass').value = 'demo1234';
  doc.getElementById('authRole').value = 'parent';
  doc.querySelector('[data-act="doLogin"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await until(() => doc.querySelector('#roles'));
  // 切到 psum（家长 NAV 含 psum）
  const psumNav = doc.querySelector('[data-act="nav"][data-view="psum"]');
  check('家长端有成长摘要入口', !!psumNav);
  if (psumNav) {
    psumNav.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await wait(300);
    const cu = doc.getElementById('childUser');
    check('摘要页有孩子用户名输入', !!cu);
    if (cu) {
      cu.value = 'stu01';
      doc.querySelector('[data-act="fetchChild"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      const cOk = await until(() => {
        const b = doc.getElementById('childBox');
        return b && /整体投入|未绑定|尚未完成/.test(b.innerHTML);
      }, 60, 200);
      check('家长摘要查询返回', cOk);
      const cb = doc.getElementById('childBox');
      check('摘要展示(脱敏)', cb && /整体投入/.test(cb.innerHTML));
    }
  }

  // 5) 学生提交同步云端（stu01 已 seed；再注册一个新学生提交，验证 cohort n 变化）
  const reg = await window.LX.cloud.register('stu_jsdom_1', 'x123456', 'student', 'J测');
  check('新学生注册', reg && reg.role === 'student');
  const ans = {}; for (let i = 1; i <= 24; i++) ans[i] = (i % 5) + 1;
  const sub = await window.LX.cloud.submitAssessment(ans);
  check('学生提交24题', sub && sub.scores && Object.keys(sub.scores).length === 6);

  console.log('\n=== ' + pass + ' PASS / ' + fail + ' FAIL ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
