"""演示数据播种：仅在库为空时创建脱敏模拟账号与测评（非真实学生数据）"""
import json
import random
import db
import auth
import scoring


def seed_if_empty():
    conn = db.get_conn()
    cur = conn.cursor()
    if cur.execute("SELECT COUNT(*) FROM users").fetchone()[0] > 0:
        conn.close()
        return

    demo = [
        ("teacher01", "teacher", "李老师"),
        ("peer01", "peer", "王学长"),
        ("parent01", "parent", "家长-甲"),
        ("stu01", "student", "学生-甲"),
        ("stu02", "student", "学生-乙"),
        ("stu03", "student", "学生-丙"),
        ("stu04", "student", "学生-丁"),
        ("stu05", "student", "学生-戊"),
        ("stu06", "student", "学生-己"),
    ]
    uid = {}
    for uname, role, dn in demo:
        h, salt = auth.hash_password("demo1234")
        pn = auth.pseudonym_of(uname)
        cur.execute(
            "INSERT INTO users(username,role,pw_hash,pw_salt,pseudonym,display_name) VALUES(?,?,?,?,?,?)",
            (uname, role, h, salt, pn, dn),
        )
        uid[uname] = cur.lastrowid

    cur.execute(
        "INSERT OR IGNORE INTO relations(mentor_id,student_id,kind) VALUES(?,?,?)",
        (uid["parent01"], uid["stu01"], "parent"),
    )
    cur.execute(
        "INSERT OR IGNORE INTO relations(mentor_id,student_id,kind) VALUES(?,?,?)",
        (uid["peer01"], uid["stu02"], "mentor"),
    )

    random.seed(42)
    for uname in ["stu01", "stu02", "stu03", "stu04", "stu05", "stu06"]:
        answers = {}
        for it_id, _ in scoring.ITEMS:
            base = random.uniform(1.5, 4.8)
            answers[it_id] = max(1, min(5, round(base)))
        scores = scoring.compute_scores(answers)
        cur.execute(
            "INSERT INTO assessments(student_id,answers_json,scores_json) VALUES(?,?,?)",
            (uid[uname], json.dumps(answers), json.dumps(scores)),
        )

    conn.commit()
    conn.close()
