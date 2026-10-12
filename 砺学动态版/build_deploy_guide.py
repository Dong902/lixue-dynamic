# -*- coding: utf-8 -*-
"""生成《砺学动态版 · 免费云主机部署指南（零代码）》Word 文档。"""
import os
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

OUT = r"C:\Users\董燕艳\WorkBuddy\2026-10-11-22-18-20\砺学动态版\砺学动态版_免费云主机部署指南.docx"

BODY = "宋体"
HEAD = "黑体"
ACCENT = RGBColor(0x1F, 0x3A, 0x5F)
GREY = RGBColor(0x44, 0x44, 0x44)
HDR_FILL = "DCE6F1"
ALT_FILL = "F5F7FA"

doc = Document()
sec = doc.sections[0]
sec.page_width = Cm(21.0); sec.page_height = Cm(29.7)
sec.left_margin = Cm(2.6); sec.right_margin = Cm(2.6)
sec.top_margin = Cm(2.4); sec.bottom_margin = Cm(2.4)
style = doc.styles["Normal"]
style.font.name = BODY; style.font.size = Pt(12)
style.element.rPr.rFonts.set(qn("w:eastAsia"), BODY)
style.paragraph_format.line_spacing = 1.5
style.paragraph_format.space_after = Pt(6)


def _sfmt(run, name=BODY, size=12, bold=False, color=None, italic=False):
    run.font.name = name; run.font.size = Pt(size); run.bold = bold; run.italic = italic
    if color is not None: run.font.color.rgb = color
    rPr = run._element.get_or_add_rPr(); rFonts = rPr.get_or_add_rFonts()
    rFonts.set(qn("w:eastAsia"), name); rFonts.set(qn("w:ascii"), name); rFonts.set(qn("w:hAnsi"), name)


def para(text, size=12, bold=False, align=None, name=BODY, space_before=0, space_after=6, color=None):
    p = doc.add_paragraph(); pf = p.paragraph_format
    pf.space_before = Pt(space_before); pf.space_after = Pt(space_after)
    if align is not None: p.alignment = align
    r = p.add_run(text); _sfmt(r, name=name, size=size, bold=bold, color=color)
    return p


def rich(segments, size=12, space_after=6):
    p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(space_after)
    for seg in segments:
        t = seg[0]; b = seg[1] if len(seg) > 1 else False; c = seg[2] if len(seg) > 2 else None
        r = p.add_run(t); _sfmt(r, size=size, bold=b, color=c)
    return p


def h1(text):
    p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(18); p.paragraph_format.space_after = Pt(10)
    r = p.add_run(text); _sfmt(r, name=HEAD, size=16, bold=True, color=ACCENT); return p


def h2(text):
    p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(12); p.paragraph_format.space_after = Pt(6)
    r = p.add_run(text); _sfmt(r, name=HEAD, size=13.5, bold=True, color=ACCENT); return p


def num(n, text, size=11.5):
    p = doc.add_paragraph(); pf = p.paragraph_format
    pf.left_indent = Cm(0.6); pf.first_line_indent = Cm(-0.6); pf.space_after = Pt(3)
    r0 = p.add_run("%d. " % n); _sfmt(r0, size=size, bold=True, color=ACCENT)
    r = p.add_run(text); _sfmt(r, size=size); return p


def sub(text, size=11):
    p = doc.add_paragraph(); pf = p.paragraph_format
    pf.left_indent = Cm(1.0); pf.space_after = Pt(2)
    r = p.add_run(text); _sfmt(r, size=size, color=GREY); return p


def bullet(text, size=11):
    p = doc.add_paragraph(); pf = p.paragraph_format
    pf.left_indent = Cm(1.0); pf.first_line_indent = Cm(-0.5); pf.space_after = Pt(2)
    r0 = p.add_run("· "); _sfmt(r0, size=size)
    r = p.add_run(text); _sfmt(r, size=size); return p


def shade(cell, color):
    tcPr = cell._tc.get_or_add_tcPr(); shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear"); shd.set(qn("w:color"), "auto"); shd.set(qn("w:fill"), color)
    tcPr.append(shd)


def table(headers, rows, widths=None, size=9.5):
    t = doc.add_table(rows=1, cols=len(headers)); t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER; t.autofit = False
    hdr = t.rows[0].cells
    for i, htxt in enumerate(headers):
        hdr[i].text = ""; p = hdr[i].paragraphs[0]; p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(2); p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.line_spacing = 1.15
        r = p.add_run(htxt); _sfmt(r, name=HEAD, size=size, bold=True); shade(hdr[i], HDR_FILL)
    for ri, row in enumerate(rows):
        cells = t.add_row().cells
        for ci, val in enumerate(row):
            cells[ci].text = ""; p = cells[ci].paragraphs[0]
            p.paragraph_format.space_after = Pt(2); p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.line_spacing = 1.15
            r = p.add_run(str(val)); _sfmt(r, size=size)
            if ri % 2 == 1: shade(cells[ci], ALT_FILL)
    if widths:
        for ci, w in enumerate(widths):
            for row in t.rows: row.cells[ci].width = Cm(w)
    doc.add_paragraph().paragraph_format.space_after = Pt(4)
    return t


def note(text):
    p = doc.add_paragraph(); pf = p.paragraph_format
    pf.left_indent = Cm(0.4); pf.space_before = Pt(4); pf.space_after = Pt(8)
    r = p.add_run(text); _sfmt(r, size=10.5, color=GREY)
    pPr = p._p.get_or_add_pPr(); pbdr = OxmlElement("w:pBdr")
    left = OxmlElement("w:left"); left.set(qn("w:val"), "single"); left.set(qn("w:sz"), "18")
    left.set(qn("w:space"), "6"); left.set(qn("w:color"), "9BB7D4"); pbdr.append(left); pPr.append(pbdr)
    return p


def add_page_number():
    footer = doc.sections[0].footer; p = footer.paragraphs[0]; p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(); _sfmt(r, size=9)
    fld1 = OxmlElement("w:fldChar"); fld1.set(qn("w:fldCharType"), "begin")
    it = OxmlElement("w:instrText"); it.set(qn("xml:space"), "preserve"); it.text = "PAGE"
    fld2 = OxmlElement("w:fldChar"); fld2.set(qn("w:fldCharType"), "end")
    r._r.append(fld1); r._r.append(it); r._r.append(fld2)


# ============================ 封面 ============================
p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(100)
r = p.add_run("砺学动态版\n免费云主机部署指南"); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
_sfmt(r, name=HEAD, size=26, bold=True, color=ACCENT)
para("（零代码 · 纯点选操作）", size=14, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, name=HEAD, space_before=8, space_after=40, color=ACCENT)
para("面向无编程基础用户的图文步骤：把「砺学」四端动态系统部署到免费云主机，拿到可分享的网址。",
     size=12, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=60, color=GREY)

# ============================ 一、准备工作 ============================
h1("一、您需要先准备的两个免费账号")
para("本指南使用 Render（免费云主机）托管系统，用 GitHub（代码仓库）存放代码。两者都提供免费套餐，且都支持用已有邮箱或微信/Google 一键注册，全程不需要写任何代码。")
table(
    ["账号", "用途", "注册地址", "费用"],
    [
        ["GitHub", "存放项目代码（相当于把文件传到网盘）", "github.com", "永久免费"],
        ["Render", "把代码变成可访问的网站（生成网址）", "render.com", "免费层可用（有限制）"],
    ],
    widths=[2.6, 7.2, 4.2, 2.6], size=10)
note("小提示：在 Render 注册时，直接选择“用 GitHub 登录”，可以省去单独注册和授权步骤。所以建议先注册 GitHub，再用 GitHub 登录 Render。")

# ============================ 二、第一步 GitHub ============================
h1("二、第一步：把代码上传到 GitHub（约 3 分钟）")
para("代码包已经为您做好，就是工作区里的「砺学动态版」文件夹。下面把它传到 GitHub。")

h2("2.1 注册 GitHub")
num(1, "打开浏览器，访问 github.com，点击右上角 Sign up（注册）。")
num(2, "按页面提示填写邮箱、设置密码、输入用户名，并完成邮箱验证。也可直接点“使用 Google 账号注册”一键登录。")

h2("2.2 新建仓库（Repository）")
num(3, "登录后，点击页面右上角的 “+” 号，选择 New repository（新建仓库）。")
num(4, "在 Repository name（仓库名）一栏填写：lixue-dynamic")
num(5, "可见性选择 Public（公开）；勾选 Add a README file（添加一个说明文件）也可以，不勾也行。")
num(6, "点击页面底部的 Create repository（创建仓库）按钮。")

h2("2.3 上传代码文件")
num(7, "进入刚建好的仓库页面，点击绿色按钮旁边的 “Add file”（添加文件），选择 Upload files（上传文件）。")
num(8, "把您电脑上的「砺学动态版」整个文件夹直接拖到上传区域。文件夹里的子文件夹（static）会自动保留结构。")
num(9, "上传完成后，页面底部会出现 Commit changes（提交更改）按钮，点击它即可。")
note("请注意：文件夹里的 app.db（本地测试库）请不要上传；其余文件（main.py、db.py、auth.py、scoring.py、privacy.py、seed.py、requirements.txt、render.yaml 以及 static 文件夹）都要上传。如果您是按本指南操作，文件夹里已经不含 app.db，直接整体拖入即可。")

# ============================ 三、第二步 Render ============================
h1("三、第二步：在 Render 上部署（约 5 分钟，含等待）")
para("这一步把 GitHub 上的代码变成真正能访问的网站，并自动生成网址。")

h2("3.1 注册并连接 GitHub")
num(10, "打开浏览器，访问 render.com，点击 Sign Up（注册）。")
num(11, "注册方式选择 “Continue with GitHub”（用 GitHub 继续），按提示授权登录。这样 Render 就能读取您刚才上传的代码。")

h2("3.2 新建 Web Service")
num(12, "登录 Render 后，进入 Dashboard（控制台），点击 New（新建） → 选择 Web Service（网页服务）。")
num(13, "在仓库列表里找到 lixue-dynamic，点击 Connect（连接）。")
num(14, "进入配置页，大部分内容已自动填好，您只需核对：")
bullet("Name（名称）：可随意，例如 lixue-dynamic")
bullet("Environment（运行环境）：Python 3（自动识别）")
bullet("Plan（套餐）：Free（免费）")
bullet("Build Command（构建命令）：自动为 pip install -r requirements.txt")
bullet("Start Command（启动命令）：自动为 uvicorn main:app --host 0.0.0.0 --port $PORT")
note("这些命令来自项目里的 render.yaml 文件，Render 会自动读取，您一般无需手动输入。只要确认 Plan 是 Free 即可。")
num(15, "确认无误后，点击页面底部的 Create Web Service（创建网页服务）。")

h2("3.3 等待构建并获取网址")
num(16, "Render 会开始自动构建（安装依赖、启动服务），通常需要 2–5 分钟。页面上会显示实时日志。")
num(17, "当状态变为 Live（运行中）或显示绿色可用标识后，点击页面顶部的网址（形如 https://lixue-dynamic.onrender.com），即可在浏览器打开系统。")
para("这个网址就是您要的“动态网页链接”，任何人打开都能使用（见下方账号说明）。", bold=False, color=GREY, size=11)

# ============================ 四、第三步 使用 ============================
h1("四、第三步：打开系统并使用")
para("在浏览器打开上一步拿到的网址，首页即为登录界面。系统内置了演示账号，可直接体验四端协同：")
table(
    ["角色", "登录用户名", "密码", "说明"],
    [
        ["学生端（青砺）", "stu01 ～ stu06", "demo1234", "六名演示学生，可做 24 题测评"],
        ["教师端（砺学）", "teacher01", "demo1234", "查看群体聚合画像（不暴露个体）"],
        ["朋辈端（伴砺）", "peer01", "demo1234", "绑定学生 stu02，可查看帮扶对象"],
        ["家长端（砺伴）", "parent01", "demo1234", "绑定学生 stu01，查看孩子脱敏摘要"],
    ],
    widths=[3.2, 3.6, 2.4, 6.4], size=10)
para("使用流程示例：用 stu01 登录学生端完成测评 → 退出后用 teacher01 登录教师端，即可看到该班的群体六维均分与最弱维度；用 parent01 登录家长端，可看到 stu01 的脱敏成长摘要。", size=11.5)

# ============================ 五、注意事项 ============================
h1("五、重要注意事项（请务必阅读）")
note("1. 免费层会休眠：Render 免费套餐在约 15 分钟无访问后会自动休眠，下次打开需等待约 30–60 秒冷启动，页面显示“正在唤醒”属正常现象，并非故障。")
note("2. 演示数据会重置：系统使用演示用 SQLite 数据库，重新部署或长时间休眠后，数据会重置为内置的种子数据（均为模拟数据，不含任何真实学生信息）。若要长期保存真实数据，需升级为付费数据库或接入托管数据库。")
note("3. 链接是公开的：生成的网址任何人拿到都能打开。当前内置的是脱敏模拟数据与演示密钥，仅供流程演示。正式用于真实学生前，请务必替换校本口径（K1 校情校规、K4 校园资源占位内容），并通过学校伦理审查与信息化主管部门审批。")
note("4. 安全边界：服务端不存储学生测评明文，仅保存加密/聚合结果；家长端遵循最小必要且须经授权。但免费公开链接不具备完整的企业级安全防护，正式上线建议启用 HTTPS 与密钥托管。")

# ============================ 六、回退 ============================
h1("六、如果中途卡住")
bullet("GitHub 上传失败或找不到按钮：确认已登录 GitHub，且进入的是仓库页面（地址含 /lixue-dynamic）。")
bullet("Render 找不到仓库：确认已用 GitHub 登录 Render 并完成授权；在 Render 的 Account Settings 里重新连接 GitHub 即可。")
bullet("打开网址显示错误：等待 5 分钟让构建完成；或在 Render 控制台查看日志（Logs）中的报错信息。")
bullet("仍无法解决：可回到 WorkBuddy，待其内置“发布为应用”功能恢复后，由我直接一键生成链接，您无需自行操作。")

add_page_number()
doc.save(OUT)
print("已生成:", OUT)
