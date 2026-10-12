"""本地 API 验证：注册/登录/测评提交/脱敏聚合全链路（标准库，无额外依赖）"""
import json
import time
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:8011"


def call(method, path, token=None, data=None):
    url = BASE + path
    headers = {}
    if token:
        headers["Authorization"] = "Bearer " + token
    body = json.dumps(data).encode() if data is not None else None
    if body is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())
    except Exception as e:  # 连接失败等
        return None, {"detail": str(e)}


def wait_up():
    for _ in range(40):
        try:
            urllib.request.urlopen(BASE + "/api/me", timeout=2)
            return True
        except urllib.error.HTTPError:
            return True
        except Exception:
            time.sleep(1)
    return False


def check(label, cond, extra=""):
    print(("  PASS " if cond else "  FAIL ") + label + ("  " + extra if extra else ""))


if not wait_up():
    print("SERVER NOT UP")
    raise SystemExit(1)

print("== 1. 教师登录 + 群体 k-匿名聚合 ==")
s, t = call("POST", "/api/login", data={"username": "teacher01", "password": "demo1234"})
check("教师登录", s == 200 and t.get("role") == "teacher", "role=%s" % t.get("role"))
tok_t = t["token"]
s, c = call("GET", "/api/teacher/cohort", token=tok_t)
check("群体聚合返回", s == 200)
check("k-匿名未抑制(n>=5)", c.get("n", 0) >= 5 and c.get("suppressed") is False,
      "n=%s rows=%s" % (c.get("n"), len(c.get("rows", []))))

print("== 2. 学生登录 + 自查 + 提交 ==")
s, t = call("POST", "/api/login", data={"username": "stu01", "password": "demo1234"})
tok_s = t["token"]
s, m = call("GET", "/api/assessment/me", token=tok_s)
check("学生自查存在", s == 200 and m.get("exists") is True)
ans = {i: 3 for i in range(1, 25)}
ans[7] = 2  # 反向题设低分 -> 实际高（检验反向计分）
s, r = call("POST", "/api/assessment", token=tok_s, data={"answers": ans})
check("提交测评", s == 200 and "scores" in r)
# time 维度含 id5,6,7,8；id7 为反向题，设 2 -> 实得 4；其余 3 题为 3
# 期望均分 = (3+3+4+3)/4 = 3.25，证明反向计分已生效
check("反向计分生效(time id7=2->实得4)", abs(r["scores"]["time"] - 3.25) < 1e-6,
      "time=%s" % r["scores"]["time"])

print("== 3. 家长查绑定孩子（脱敏摘要） ==")
s, t = call("POST", "/api/login", data={"username": "parent01", "password": "demo1234"})
tok_p = t["token"]
s, p = call("GET", "/api/parent/child?student=stu01", token=tok_p)
check("家长查绑定孩子", s == 200 and p.get("assessed") is True)
check("家长摘要不含原始分(_raw_excluded)", p.get("summary", {}).get("_raw_excluded") is True)
s, p2 = call("GET", "/api/parent/child?student=stu02", token=tok_p)
check("家长查未绑定孩子被拒(403)", s == 403, "detail=%s" % p2.get("detail"))

print("== 4. 越权防护 ==")
s, bad = call("POST", "/api/assessment", token=tok_t, data={"answers": ans})
check("教师提交测评被拒(403)", s == 403)
s, bad = call("GET", "/api/teacher/cohort")
check("无 token 访问被拒(401)", s == 401)

print("== DONE ==")
