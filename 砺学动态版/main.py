"""砺学动态版 MVP · FastAPI 入口
- 四角色账号 / JWT / 测评提交 / 脱敏聚合（教师群体 k-匿名、家长孩子摘要）
- 挂载 static/ 前端（改造后的四端原型）
- 监听 $PORT（部署沙箱注入），本地默认 8000
"""
import os
import json
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import db
import auth
import scoring
import privacy
import seed

app = FastAPI(title="砺学动态版 MVP")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    db.init_db()
    seed.seed_if_empty()


def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing token")
    payload = auth.decode_token(authorization[7:])
    if not payload:
        raise HTTPException(status_code=401, detail="invalid token")
    conn = db.get_conn()
    u = conn.execute(
        "SELECT id,username,role,pseudonym,display_name FROM users WHERE id=?",
        (payload["uid"],),
    ).fetchone()
    conn.close()
    if not u:
        raise HTTPException(status_code=401, detail="user not found")
    return dict(u)


class RegisterIn(BaseModel):
    username: str
    password: str
    role: str
    display_name: str = ""


class LoginIn(BaseModel):
    username: str
    password: str


class AssessmentIn(BaseModel):
    answers: dict


@app.post("/api/register")
def register(body: RegisterIn):
    if body.role not in ("student", "teacher", "peer", "parent"):
        raise HTTPException(status_code=400, detail="invalid role")
    conn = db.get_conn()
    if conn.execute("SELECT 1 FROM users WHERE username=?", (body.username,)).fetchone():
        conn.close()
        raise HTTPException(status_code=409, detail="username exists")
    h, salt = auth.hash_password(body.password)
    pn = auth.pseudonym_of(body.username)
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO users(username,role,pw_hash,pw_salt,pseudonym,display_name) VALUES(?,?,?,?,?,?)",
        (body.username, body.role, h, salt, pn, body.display_name),
    )
    uid = cur.lastrowid
    conn.commit()
    conn.close()
    return {
        "token": auth.make_token(uid, body.role),
        "role": body.role,
        "pseudonym": pn,
        "display_name": body.display_name,
    }


@app.post("/api/login")
def login(body: LoginIn):
    conn = db.get_conn()
    u = conn.execute("SELECT * FROM users WHERE username=?", (body.username,)).fetchone()
    conn.close()
    if not u or not auth.verify_password(body.password, u["pw_hash"], u["pw_salt"]):
        raise HTTPException(status_code=401, detail="invalid credentials")
    return {
        "token": auth.make_token(u["id"], u["role"]),
        "role": u["role"],
        "pseudonym": u["pseudonym"],
        "display_name": u["display_name"],
    }


@app.get("/api/me")
def me(user=Depends(get_current_user)):
    return user


@app.post("/api/assessment")
def submit_assessment(body: AssessmentIn, user=Depends(get_current_user)):
    if user["role"] != "student":
        raise HTTPException(status_code=403, detail="only student can submit")
    try:
        ans = {int(k): int(v) for k, v in body.answers.items()}
    except Exception:
        raise HTTPException(status_code=400, detail="bad answers")
    if len(ans) != 24:
        raise HTTPException(status_code=400, detail="need 24 answers")
    for v in ans.values():
        if v < 1 or v > 5:
            raise HTTPException(status_code=400, detail="value must be 1-5")
    scores = scoring.compute_scores(ans)
    conn = db.get_conn()
    conn.execute(
        "INSERT INTO assessments(student_id,answers_json,scores_json) VALUES(?,?,?)",
        (user["id"], json.dumps(ans), json.dumps(scores)),
    )
    conn.commit()
    conn.close()
    return {"scores": scores, "band": scoring.band_of_scores(scores)}


@app.get("/api/assessment/me")
def my_assessment(user=Depends(get_current_user)):
    if user["role"] != "student":
        raise HTTPException(status_code=403, detail="only student")
    conn = db.get_conn()
    row = conn.execute(
        "SELECT answers_json,scores_json,created_at FROM assessments "
        "WHERE student_id=? ORDER BY id DESC LIMIT 1",
        (user["id"],),
    ).fetchone()
    conn.close()
    if not row:
        return {"exists": False}
    return {
        "exists": True,
        "answers": json.loads(row["answers_json"]),
        "scores": json.loads(row["scores_json"]),
        "created_at": row["created_at"],
    }


@app.get("/api/teacher/cohort")
def teacher_cohort(user=Depends(get_current_user)):
    if user["role"] not in ("teacher", "peer"):
        raise HTTPException(status_code=403, detail="forbidden")
    conn = db.get_conn()
    rows = conn.execute(
        "SELECT a.scores_json FROM assessments a "
        "WHERE a.id IN (SELECT MAX(id) FROM assessments GROUP BY student_id)"
    ).fetchall()
    conn.close()
    scores_list = [json.loads(r["scores_json"]) for r in rows]
    n = len(scores_list)
    k = 5
    if n < k:
        return {
            "n": n, "k": k, "suppressed": True,
            "note": "当前群体样本量 %d 低于 k=%d，依据 k-匿名原则整体抑制，不返回任何个体数据" % (n, k),
        }
    avg = {}
    for d in scoring.DIMS:
        vals = [s.get(d) for s in scores_list if s.get(d) is not None]
        avg[d] = round(sum(vals) / len(vals), 2) if vals else None
    weak = scoring.weak_dims({d: avg[d] for d in scoring.DIMS}, 2)
    bands = {}
    for s in scores_list:
        b = scoring.engagement_band(s)
        bands[b] = bands.get(b, 0) + 1
    return {
        "n": n, "k": k, "suppressed": False,
        "avg": avg, "weak": weak, "bands": bands,
        "note": "已满足 k=%d 匿名，仅返回群体聚合（不含任何个体身份或分值）" % k,
    }


@app.get("/api/parent/child")
def parent_child(student: str, user=Depends(get_current_user)):
    if user["role"] != "parent":
        raise HTTPException(status_code=403, detail="forbidden")
    conn = db.get_conn()
    child = conn.execute(
        "SELECT id,pseudonym,display_name FROM users WHERE username=? AND role=?",
        (student, "student"),
    ).fetchone()
    if not child:
        conn.close()
        raise HTTPException(status_code=404, detail="student not found")
    rel = conn.execute(
        "SELECT 1 FROM relations WHERE mentor_id=? AND student_id=? AND kind=?",
        (user["id"], child["id"], "parent"),
    ).fetchone()
    if not rel:
        conn.close()
        raise HTTPException(status_code=403, detail="not your child (bind first)")
    row = conn.execute(
        "SELECT scores_json,created_at FROM assessments WHERE student_id=? ORDER BY id DESC LIMIT 1",
        (child["id"],),
    ).fetchone()
    conn.close()
    if not row:
        return {"bound": True, "assessed": False, "pseudonym": child["pseudonym"]}
    sc = json.loads(row["scores_json"])
    return {
        "bound": True,
        "assessed": True,
        "pseudonym": child["pseudonym"],
        "summary": privacy.desensitize_for_parent(sc),
        "created_at": row["created_at"],
    }


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app.mount("/", StaticFiles(directory=os.path.join(BASE_DIR, "static"), html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)

