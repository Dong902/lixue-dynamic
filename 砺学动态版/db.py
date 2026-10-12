"""SQLite 数据层（MVP：单文件库，生产须替换为加密/托管数据库）"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "app.db")


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            role TEXT NOT NULL,
            pw_hash TEXT NOT NULL,
            pw_salt TEXT NOT NULL,
            pseudonym TEXT NOT NULL,
            display_name TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        )"""
    )
    cur.execute(
        """CREATE TABLE IF NOT EXISTS relations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mentor_id INTEGER NOT NULL,
            student_id INTEGER NOT NULL,
            kind TEXT NOT NULL,
            UNIQUE(mentor_id, student_id, kind)
        )"""
    )
    cur.execute(
        """CREATE TABLE IF NOT EXISTS assessments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            answers_json TEXT NOT NULL,
            scores_json TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        )"""
    )
    conn.commit()
    conn.close()
