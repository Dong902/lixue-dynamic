import requests, time, random, json

BASE = "http://127.0.0.1:8014"
ok = 0; fail = 0
def check(name, cond, extra=""):
    global ok, fail
    if cond: ok += 1; print("PASS", name)
    else: fail += 1; print("FAIL", name, extra)

for _ in range(40):
    try:
        r = requests.get(BASE + "/api/teacher/cohort", timeout=2)
        if r.status_code in (200, 401, 403): break
    except Exception: time.sleep(0.5)

# 1) 教师登录 → 聚合
r = requests.post(BASE + "/api/login", json={"username":"teacher01","password":"demo1234"})
check("teacher login", r.status_code==200, r.text[:120])
tk = r.json()["token"]
h = {"Authorization":"Bearer "+tk}
r = requests.get(BASE + "/api/teacher/cohort", headers=h)
d = r.json()
check("cohort 200", r.status_code==200, r.text[:120])
check("cohort n==6", d.get("n")==6, d)
check("cohort not suppressed", d.get("suppressed")==False, d)
check("cohort has avg+weak", "avg" in d and "weak" in d and len(d["weak"])==2, d.get("weak"))
check("cohort avg 6 dims", len(d.get("avg",{}))==6, d.get("avg"))

# 2) 家长登录 → 孩子摘要
r = requests.post(BASE + "/api/login", json={"username":"parent01","password":"demo1234"})
tkp = r.json()["token"]
hp = {"Authorization":"Bearer "+tkp}
r = requests.get(BASE + "/api/parent/child?student=stu01", headers=hp)
d = r.json()
check("parent child 200", r.status_code==200, r.text[:120])
check("parent child assessed", d.get("assessed")==True, d)
check("parent summary desensitized", d.get("summary",{}).get("_raw_excluded")==True, d.get("summary"))

# 3) 新学生注册 → 提交 24 题
uname = "stu_test_%d" % random.randint(1000,9999)
r = requests.post(BASE + "/api/register", json={"username":uname,"password":"x123456","role":"student","display_name":"测试生"})
check("student register", r.status_code==200, r.text[:120])
tks = r.json()["token"]
hs = {"Authorization":"Bearer "+tks}
ans = {i: random.randint(1,5) for i in range(1,25)}
r = requests.post(BASE + "/api/assessment", headers=hs, json={"answers":ans})
check("student submit 24", r.status_code==200 and len(r.json().get("scores",{}))==6, r.text[:120])

# 4) 教师聚合 n 应变为 7
r = requests.get(BASE + "/api/teacher/cohort", headers=h)
d = r.json()
check("cohort n==7 after submit", d.get("n")==7, d.get("n"))

print("\n=== %d PASS / %d FAIL ===" % (ok, fail))
