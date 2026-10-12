# -*- coding: utf-8 -*-
"""生成《砺学动态版 · 阿里云部署指南（零代码）》Word 文档。"""
import os
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

OUT = r"C:\Users\董燕艳\WorkBuddy\2026-10-11-22-18-20\砺学动态版\砺学动态版_阿里云部署指南.docx"

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


def warn(text):
    p = doc.add_paragraph(); pf = p.paragraph_format
    pf.left_indent = Cm(0.4); pf.space_before = Pt(4); pf.space_after = Pt(8)
    r = p.add_run(text); _sfmt(r, size=10.5, color=RGBColor(0xA3, 0x2D, 0x2D))
    pPr = p._p.get_or_add_pPr(); pbdr = OxmlElement("w:pBdr")
    left = OxmlElement("w:left"); left.set(qn("w:val"), "single"); left.set(qn("w:sz"), "24")
    left.set(qn("w:space"), "6"); left.set(qn("w:color"), "A32D2D"); pbdr.append(left); pPr.append(pbdr)
    return p


def add_page_number():
    footer = doc.sections[0].footer; p = footer.paragraphs[0]; p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(); _sfmt(r, size=9)
    fld1 = OxmlElement("w:fldChar"); fld1.set(qn("w:fldCharType"), "begin")
    it = OxmlElement("w:instrText"); it.set(qn("xml:space"), "preserve"); it.text = "PAGE"
    fld2 = OxmlElement("w:fldChar"); fld2.set(qn("w:fldCharType"), "end")
    r._r.append(fld1); r._r.append(it); r._r.append(fld2)


# ============================ 封面 ============================
p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(90)
r = p.add_run("砺学动态版\n阿里云部署指南"); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
_sfmt(r, name=HEAD, size=26, bold=True, color=ACCENT)
para("（零代码 · 纯点选操作）", size=14, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, name=HEAD, space_before=8, space_after=30, color=ACCENT)
para("面向无编程基础用户：把「砺学」四端动态系统部署到阿里云轻量应用服务器，拿到可访问的网址。数据存放于国内服务器，更贴合境内合规要求。",
     size=12, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=60, color=GREY)

# ============================ 一、方案概览与费用 ============================
h1("一、方案概览与费用提示")
para("本文使用「阿里云轻量应用服务器」托管系统。它是阿里云里最省心的云服务器：自带浏览器内的网页终端（无需下载 PuTTY/Xshell），自带图形化防火墙，适合无运维基础的用户。")

h2("1.1 与免费云主机（Render）的区别")
table(
    ["对比项", "阿里云轻量应用服务器（本文）", "Render 免费层（旧方案）"],
    [
        ["是否付费", "需要购买（最低配置约每年几十元）", "免费"],
        ["是否需实名", "必须完成实名认证（国内云规定）", "不需要"],
        ["数据位置", "中国大陆境内服务器", "境外（如新加坡）"],
        ["国内访问速度", "快", "可能较慢"],
        ["合规倾向", "数据不出境，更契合《个人信息保护法》", "数据在境外，需另行评估"],
        ["操作门槛", "稍高（需买服务器、开防火墙）", "较低（连 GitHub 点一下）"],
    ],
    widths=[2.6, 6.6, 5.4], size=9.5)
para("说明：项目文件夹里另有一个 render.yaml 文件，那是给另一种免费云主机（Render）用的蓝图，本文阿里云方案用不到它，可忽略，不影响部署。", size=10.5, color=GREY)

h2("1.2 费用预估（重要：以下为量级参考，未经核实）")
table(
    ["项目", "说明", "参考费用"],
    [
        ["阿里云账号", "注册免费，但必须完成实名认证", "免费"],
        ["轻量应用服务器 2核2G", "本项目最低够用配置", "约 60–100 元/年（活动价，以官网实时为准，待核实）"],
        ["域名（可选）", "用 IP 直接访问可不选；想要好记网址需另购并备案", "几十元/年"],
    ],
    widths=[3.4, 7.2, 4.0], size=9.5)
warn("本指南中的价格仅为量级参考，未经逐条核实。阿里云活动价随时间和地域波动较大，最终金额请以阿里云官网下单页实时显示为准。")

# ============================ 二、准备工作 ============================
h1("二、准备工作：注册阿里云并购买服务器")
h2("2.1 注册并完成实名认证")
num(1, "打开浏览器访问 aliyun.com，点击右上角「免费注册」，用手机号注册账号。")
num(2, "登录后，按页面提示完成「实名认证」（国内云服务的强制要求，需提供身份证信息，通常几分钟可过）。")

h2("2.2 购买轻量应用服务器")
num(3, "在阿里云控制台进入「轻量应用服务器」产品页，点击「创建实例 / 购买」。")
num(4, "按下表配置（其余保持默认即可）：")
table(
    ["配置项", "选择", "说明"],
    [
        ["地域", "离您最近的国内节点（如华东1 杭州）", "影响访问速度"],
        ["镜像", "系统镜像 → Ubuntu 22.04", "务必选系统镜像，不要选应用镜像"],
        ["套餐", "最低「2核2G」", "本项目足够，费用最低"],
        ["购买时长", "建议 1 年", "年付通常比月付便宜"],
        ["实例密码", "设置 root 密码并记牢", "后面登录服务器要用"],
    ],
    widths=[2.6, 6.0, 6.4], size=9.5)
num(5, "提交并支付。购买完成后，在实例列表里能看到一台服务器，请记录它的「公网 IP 地址」（形如 8.152.xx.xx）。")

# ============================ 三、第一步：上传代码 ============================
h1("三、第一步：把代码传到 GitHub（约 3 分钟）")
para("为了让服务器能下载到代码，我们先把本地的「砺学动态版」文件夹传到 GitHub（免费的代码仓库，相当于网盘）。这一步不需要写代码，纯网页操作。")
note("如果您不想注册 GitHub，也可以改用「阿里云控制台直接上传文件」的方式（见本文附录），但 GitHub 这条路最稳定，建议优先。")

h2("3.1 注册并新建仓库")
num(6, "访问 github.com，点击右上角 Sign up 注册（可用 Google 账号一键登录）。")
num(7, "登录后点右上角「+」→ New repository，仓库名填：lixue-dynamic；可见性选 Public（公开）。")
num(8, "点击 Create repository 完成创建。")

h2("3.2 上传项目文件夹")
num(9, "进入刚建好的仓库，点「Add file」→ Upload files。")
num(10, "把您电脑上的「砺学动态版」整个文件夹拖到上传区（里面的 static 子文件夹会自动保留）。")
num(11, "上传完成后点「Commit changes」提交。至此代码已在云端。")
note("请确认上传的是整套文件：main.py、db.py、auth.py、scoring.py、privacy.py、seed.py、requirements.txt、deploy_aliyun.sh，以及 static 文件夹。本地测试库 app.db 不在此列（项目里已自动排除）。")

# ============================ 四、第二步：连接服务器 ============================
h1("四、第二步：登录服务器网页终端（免装软件）")
h2("4.1 打开阿里云网页终端")
num(12, "回到阿里云控制台 → 轻量应用服务器 → 点击您的实例。")
num(13, "点击「远程连接」，在弹出的方式里选择「Workbench」（这是浏览器内的终端，无需下载任何软件）。")
num(14, "登录方式选「密码认证」，用户名填 root，密码填您购买时设置的实例密码，进入黑色终端界面。")

h2("4.2 下载并一键部署（只需粘贴两行命令）")
note("若您的服务器位于中国大陆，访问 github.com 有时较慢甚至受限。若 git clone 长时间卡住或失败，请改用本文附录的「阿里云控制台上传」方式，完全不依赖 GitHub。")
num(15, "在终端里粘贴下面两行（把「您的用户名」换成您在 GitHub 的用户名），按回车：")
para("    git clone https://github.com/您的用户名/lixue-dynamic.git", size=11, bold=True, color=ACCENT)
para("    cd lixue-dynamic", size=11, bold=True, color=ACCENT)
sub("这会把代码下载到服务器。若提示输入 GitHub 用户名/密码，按提示填（或用右上角生成的 Personal Access Token 当密码）。")
num(16, "继续在终端粘贴下面这行，按回车运行一键部署脚本：")
para("    bash deploy_aliyun.sh", size=11, bold=True, color=ACCENT)
num(17, "脚本会自动完成：安装 Python 环境 → 安装项目依赖 → 配置开机自启 → 放行系统端口。看到「完成 ✅」及后续提示即成功。")
warn("整个脚本运行约 1–3 分钟，期间终端会滚动大量安装日志，属正常现象，请勿中途关闭。若中途报错变红，请把红色文字截图保存，回到 WorkBuddy 发给我协助排查。")

# ============================ 五、第三步：放行端口 ============================
h1("五、第三步：在阿里云防火墙放行端口")
para("服务器内部虽已放行端口，但阿里云平台还有一道「防火墙」默认挡住外部访问。必须手动放通，外网才能打开网页。")
num(18, "回到阿里云控制台 → 轻量应用服务器 → 您的实例 →「防火墙」标签页。")
num(19, "点击「添加规则」：应用类型选「自定义」；协议选「TCP」；端口填 8010；策略选「允许」。")
num(20, "点击「确定」保存。规则立即生效。")
note("端口号 8010 与部署脚本里设定的一致。如果您改过脚本里的 PORT，这里要填相同的数字。")

# ============================ 六、第四步：打开并使用 ============================
h1("六、第四步：打开系统并使用")
para("在任意浏览器的地址栏输入： http://您的公网IP:8010 （把「您的公网IP」换成第二步记下的那串数字）。回车即可打开登录界面。", size=11.5)
para("系统内置演示账号，可直接体验四端协同：", size=11.5)
table(
    ["角色", "登录用户名", "密码", "说明"],
    [
        ["学生端（青砺）", "stu01 ～ stu06", "demo1234", "六名演示学生，可做 24 题测评"],
        ["教师端（砺学）", "teacher01", "demo1234", "查看群体聚合画像（不暴露个体）"],
        ["朋辈端（伴砺）", "peer01", "demo1234", "绑定学生 stu02，可查看帮扶对象"],
        ["家长端（砺伴）", "parent01", "demo1234", "绑定学生 stu01，查看孩子脱敏摘要"],
    ],
    widths=[3.2, 3.6, 2.4, 6.4], size=9.5)
para("使用流程示例：用 stu01 登录学生端完成测评 → 退出后用 teacher01 登录教师端，即可看到该班的群体六维均分与最弱维度；用 parent01 登录家长端，可看到 stu01 的脱敏成长摘要。", size=11.5)

# ============================ 七、重要注意事项 ============================
h1("七、重要注意事项（请务必阅读）")
warn("1. 需要付费：与免费方案不同，阿里云轻量服务器是付费资源。若不再使用，请在控制台及时释放实例，避免持续计费。")
note("2. 开机自启已配置：脚本已把服务设为开机自启 + 崩溃自动重启。服务器重启后系统会自动恢复，无需手动再跑脚本。查看状态可用：sudo systemctl status lixue")
note("3. 公网 IP 一般固定：轻量应用服务器在未释放的情况下，公网 IP 通常保持不变，可长期用此地址访问。若您主动释放实例，IP 会回收。")
note("4. 链接是公开的：该网址任何人拿到都能打开。当前内置的是脱敏模拟数据与演示密钥，仅供流程演示。正式用于真实学生前，请务必替换校本口径（K1 校情校规、K4 校园资源占位内容），并通过学校伦理审查与信息化主管部门审批。")
note("5. 安全边界：服务端不存储学生测评明文，仅保存聚合/脱敏结果；家长端遵循最小必要且须经授权。直接用 IP:端口 访问为 http（非加密），正式上线建议后续绑定域名并启用阿里云免费 SSL 证书（HTTPS）。")

# ============================ 八、卡住怎么办 ============================
h1("八、如果中途卡住")
bullet("终端连不上：确认实例处于「运行中」、密码正确；或改用同一种远程连接里的「VNC」方式登录。")
bullet("git clone 要账号密码：用 GitHub 右上角生成的 Personal Access Token 代替密码输入。")
bullet("脚本运行报错：把终端里的红色报错文字截图，回到 WorkBuddy 发给我，我帮您定位。")
bullet("网页打不开：确认第三步防火墙已放行 8010；在服务器终端执行 sudo systemctl status lixue 看服务是否运行。")
bullet("不想自己折腾：可待 WorkBuddy 内置「发布为应用」功能恢复后，由我直接一键生成链接，您无需自行操作。")

# ============================ 附录 ============================
h1("附录：不注册 GitHub 的替代上传法（阿里云控制台上传）")
para("如果您希望完全不碰 GitHub，可改用阿里云自带的「文件上传」把代码传上去：", size=11.5)
num(1, "在电脑上把「砺学动态版」文件夹压缩成 zip（如 lixue.zip）。")
num(2, "阿里云控制台 → 轻量应用服务器 → 实例 →「远程连接 / 文件管理」，上传该 zip 到服务器 /root 目录。")
num(3, "在 Workbench 终端里解压：unzip lixue.zip -d /root/lixue-app；再 cd /root/lixue-app。")
num(4, "执行：bash deploy_aliyun.sh（其余步骤同正文第四、五步）。")
note("此方式少了 GitHub 注册环节，但需自行压缩/解压，且文件管理上传大文件夹可能不如 GitHub 稳定，故正文主推 GitHub 方案。")

add_page_number()
doc.save(OUT)
print("已生成:", OUT)
