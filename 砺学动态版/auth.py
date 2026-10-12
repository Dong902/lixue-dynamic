"""认证与凭据：PBKDF2 密码哈希、JWT、SHA-256 假名"""
import hashlib
import hmac
import os
import jwt
import datetime

SECRET = os.environ.get("LX_SECRET", "dev-secret-change-in-production")
ALGO = "HS256"
PBKDF2_ROUNDS = 100000


def hash_password(pw: str):
    salt = os.urandom(16).hex()
    h = hashlib.pbkdf2_hmac("sha256", pw.encode("utf-8"), bytes.fromhex(salt), PBKDF2_ROUNDS).hex()
    return h, salt


def verify_password(pw: str, h: str, salt: str) -> bool:
    calc = hashlib.pbkdf2_hmac("sha256", pw.encode("utf-8"), bytes.fromhex(salt), PBKDF2_ROUNDS).hex()
    return hmac.compare_digest(calc, h)


def pseudonym_of(username: str) -> str:
    digest = hashlib.sha256(username.encode("utf-8")).hexdigest()[:8].upper()
    return "SX-" + digest


def make_token(user_id: int, role: str) -> str:
    payload = {
        "uid": user_id,
        "role": role,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=7),
    }
    return jwt.encode(payload, SECRET, algorithm=ALGO)


def decode_token(tok: str):
    try:
        return jwt.decode(tok, SECRET, algorithms=[ALGO])
    except Exception:
        return None
