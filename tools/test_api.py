#!/usr/bin/env python3
"""End-to-end API tests. Boots the real server (temp data dir) plus the mock AI, then exercises
auth, roles, lockout, idempotent sync, AI validation, admin and CSV export.

    python3 tools/test_api.py
"""
import base64, io, json, os, subprocess, sys, tempfile, time, urllib.error, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from serve_test import ensure_built
ensure_built()
PORT, AI_PORT = 8791, 8792
BASE = f"http://127.0.0.1:{PORT}"
passed = failed = 0

def call(method, path, body=None, token=None, raw=False):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None)
    req.add_header("Content-Type", "application/json")
    if token: req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            data = r.read()
            return r.status, (data if raw else json.loads(data)), r.headers
    except urllib.error.HTTPError as e:
        data = e.read()
        return e.code, (data if raw else json.loads(data)), e.headers

def check(name, cond, extra=""):
    global passed, failed
    if cond: passed += 1; print(f"  ok   {name}")
    else: failed += 1; print(f"  FAIL {name} {extra}")

def jpeg_b64():
    from PIL import Image
    buf = io.BytesIO(); Image.new("RGB", (64, 64), (60, 140, 60)).save(buf, "JPEG")
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()

def main():
    tmp = tempfile.mkdtemp()
    env = {**os.environ, "PORT": str(PORT), "KS_DATA": tmp, "KS_QUIET": "1", "ADMIN_PHONE": "9000000000", "ADMIN_PIN": "482913",
           "ANTHROPIC_API_KEY": "test-key", "ANTHROPIC_BASE_URL": f"http://127.0.0.1:{AI_PORT}", "AI_DAILY_LIMIT": "3"}
    mock = subprocess.Popen([sys.executable, str(ROOT / "tools" / "mock_ai.py"), str(AI_PORT)])
    srv = subprocess.Popen(["java", "-cp", f"{ROOT}/backend/out:{ROOT}/backend/src/main/resources", "setu.Main"], env=env, stdout=None)
    try:
        for _ in range(40):
            try: call("GET", "/api/health"); break
            except Exception: time.sleep(0.15)

        print("health / directory / static")
        s, d, h = call("GET", "/api/health"); check("health ok, ai on", s == 200 and d["ai"] is True)
        check("security headers", h.get("X-Content-Type-Options") == "nosniff" and "default-src 'self'" in h.get("Content-Security-Policy", ""))
        s, d, _ = call("GET", "/api/prices"); check("prices seeded", s == 200 and len(d["prices"]) == 48)
        s, d, _ = call("GET", "/api/buyers"); check("buyers seeded", len(d["buyers"]) == 12 and isinstance(d["buyers"][0]["crops"], list))
        s, d, _ = call("GET", "/api/storage"); check("storage seeded", len(d["storage"]) == 10)
        s, d, _ = call("GET", "/api/transporters"); check("transporters seeded", len(d["transporters"]) == 10)
        s, _, _ = call("GET", "/../server/server.py", raw=True); check("path traversal blocked", s == 404)
        s, _, _ = call("GET", "/api/nope"); check("unknown api 404", s == 404)

        print("registration / login")
        s, d, _ = call("POST", "/api/register", {"name": "Ravi", "phone": "1234567890", "pin": "1234"}); check("bad phone rejected", s == 400)
        s, d, _ = call("POST", "/api/register", {"name": "Ravi", "phone": "9876543210", "pin": "12"}); check("bad pin rejected", s == 400)
        s, d, _ = call("POST", "/api/register", {"name": "Ravi Kumar", "phone": "98765 43210", "pin": "1234", "village": "Test Village", "lang": "te"})
        check("farmer registers", s == 200 and d["user"]["role"] == "farmer"); ftok = d["token"]
        s, d, _ = call("POST", "/api/register", {"name": "Ravi Kumar", "phone": "9876543210", "pin": "1234"}); check("duplicate phone 409", s == 409)
        s, d, _ = call("POST", "/api/register", {"name": "Meena", "phone": "9123456780", "pin": "4321", "role": "buyer"}); check("buyer needs business name", s == 400)
        s, d, _ = call("POST", "/api/register", {"name": "Meena", "phone": "9123456780", "pin": "4321", "role": "buyer", "business": "Meena Traders"})
        check("buyer registers unverified", s == 200 and d.get("user",{}).get("verified") is False, str(s)+str(d)); btok = d.get("token")
        s, d, _ = call("POST", "/api/register", {"name": "X", "phone": "9123456781", "pin": "4321", "role": "admin"}); check("cannot self-register as admin", s == 400)
        s, d, _ = call("POST", "/api/login", {"phone": "9876543210", "pin": "1234"}); check("login ok", s == 200 and "token" in d)
        s, d, _ = call("GET", "/api/me", token=ftok); check("/me works", d["user"]["name"] == "Ravi Kumar")
        s, d, _ = call("GET", "/api/me", token=ftok + "x"); check("tampered token rejected", s == 401)
        for i in range(4): call("POST", "/api/login", {"phone": "9123456780", "pin": "0000"})
        s, d, _ = call("POST", "/api/login", {"phone": "9123456780", "pin": "0000"}); check("5th wrong PIN locks", s == 429 and d["error"] == "locked")
        s, d, _ = call("POST", "/api/login", {"phone": "9123456780", "pin": "4321"}); check("locked even with right PIN", s == 429)

        print("crop cases")
        s, d, _ = call("POST", "/api/cases", {"client_id": "abc"}, ftok); check("bad client_id", s == 400)
        cid = "case-photo-0001"
        body = {"client_id": cid, "crop": "tomato", "source": "photo", "image": jpeg_b64(), "lang": "en"}
        s, d, _ = call("POST", "/api/cases", body); check("cases need auth", s == 401)
        s, d, _ = call("POST", "/api/cases", body, ftok)
        r = d.get("case", {}).get("result") or {}
        check("photo diagnosed via AI", s == 200 and d["case"]["problem_id"] == "tomato_early" and r.get("engine") == "claude-vision", str(d))
        check("AI output validated", r.get("alternatives") == ["tomato_late"] and 0 <= r.get("confidence", 9) <= 1)
        s, d2, _ = call("POST", "/api/cases", body, ftok); check("sync is idempotent", d2.get("duplicate") is True and d2["case"]["id"] == d["case"]["id"])
        s, d, _ = call("POST", "/api/cases", {"client_id": "case-photo-0002", "crop": "cotton", "source": "photo", "image": jpeg_b64()}, ftok)
        check("junk AI output sanitised to unknown", d["case"]["result"]["match_id"] == "unknown" and d["case"]["result"]["confidence"] == 0.0 and d["case"]["problem_id"] is None, str(d))
        s, d, _ = call("POST", "/api/cases", {"client_id": "case-photo-0003", "source": "photo", "image": "data:image/jpeg;base64," + base64.b64encode(b"not an image").decode()}, ftok)
        check("non-image rejected", s == 400)
        s, d, _ = call("POST", "/api/cases", {"client_id": "case-photo-0004", "crop": "paddy", "source": "photo", "image": jpeg_b64()}, ftok); check("3rd photo ok", s == 200)
        s, d, _ = call("POST", "/api/cases", {"client_id": "case-photo-0005", "crop": "paddy", "source": "photo", "image": jpeg_b64()}, ftok)
        check("daily AI limit enforced", s == 429 and d["error"] == "ai_limit")
        s, d, _ = call("POST", "/api/cases", {"client_id": "case-sym-00001", "crop": "paddy", "source": "symptoms", "symptoms": ["spots", "bogus"],
                                              "local_result": {"matches": [{"id": "paddy_blast", "confidence": 0.71}, {"id": "hacked", "confidence": 1}]}}, ftok)
        check("symptom case stored", d["case"]["problem_id"] == "paddy_blast" and len(d["case"]["result"]["matches"]) == 1)
        s, d, _ = call("GET", "/api/cases", token=ftok); check("my cases listed", len(d["cases"]) == 4)

        print("listings / requests / roles")
        s, d, _ = call("POST", "/api/listings", {"client_id": "list-0000001", "crop": "chilli", "qty_qtl": 25, "price_expected": 14000, "ready_date": "2026-10-01"}, ftok)
        check("listing created", s == 200 and "id" in d)
        s, d2, _ = call("POST", "/api/listings", {"client_id": "list-0000001", "crop": "chilli", "qty_qtl": 25}, ftok); check("listing idempotent", d2.get("duplicate") is True)
        s, d, _ = call("POST", "/api/listings", {"client_id": "list-0000002", "crop": "diamonds", "qty_qtl": 1}, ftok); check("bad crop rejected", s == 400)
        s, d, _ = call("POST", "/api/listings", {"client_id": "list-0000003", "crop": "chilli", "qty_qtl": -5}, ftok); check("negative qty rejected", s == 400)
        s, d, _ = call("GET", "/api/listings", token=ftok); check("farmer cannot browse all listings", s == 403)
        s, d, _ = call("GET", "/api/listings", token=btok); check("unverified buyer sees listings, phones hidden", s == 200 and d["listings"][0]["farmer_phone"] is None and d["verified"] is False)
        s, d, _ = call("POST", "/api/requests", {"client_id": "req-00000001", "kind": "transport", "target_id": "t1", "target_name": "Sample Transport - Guntur", "payload": {"qty": 25, "km": 120}}, ftok)
        check("request stored", s == 200)
        s, d, _ = call("POST", "/api/requests", {"client_id": "req-00000002", "kind": "wire_money", "target_id": "t1"}, ftok); check("bad request kind rejected", s == 400)

        print("admin")
        s, d, _ = call("GET", "/api/admin/stats", token=ftok); check("farmer blocked from admin", s == 403)
        s, d, _ = call("POST", "/api/login", {"phone": "9000000000", "pin": "482913"}); check("admin login", s == 200 and d["user"]["role"] == "admin"); atok = d["token"]
        s, d, _ = call("GET", "/api/admin/stats", token=atok)
        check("stats", s == 200 and d["cases"] == 4 and d["users"].get("farmer") == 1 and d["pending_buyers"] == 1 and d["listings"] == 1, str(d)[:300])
        s, d, _ = call("GET", "/api/admin/users", token=atok); buyer = [u for u in d["users"] if u["role"] == "buyer"][0]
        s, d, _ = call("POST", "/api/admin/verify", {"user_id": buyer["id"], "verified": True}, atok); check("admin verifies buyer", s == 200)
        s, d, _ = call("GET", "/api/listings", token=btok); check("verified buyer sees phone", d["verified"] is True and d["listings"][0]["farmer_phone"] == "9876543210")
        s, d, _ = call("GET", "/api/admin/cases", token=atok); cid_db = [c for c in d["cases"] if c["has_image"]][0]["id"]
        s, img, h = call("GET", f"/api/admin/image/{cid_db}", token=atok, raw=True); check("admin can fetch case image", s == 200 and img[:3] == b"\xff\xd8\xff")
        s, _, _ = call("GET", f"/api/admin/image/{cid_db}", token=ftok, raw=True); check("farmer cannot fetch images", s == 403)
        s, csvb, h = call("GET", "/api/admin/export/listings.csv", token=atok, raw=True); check("csv export", s == 200 and b"chilli" in csvb and b"text/csv" in h["Content-Type"].encode())
    finally:
        srv.terminate(); mock.terminate()
    print(f"\n{passed} passed, {failed} failed")
    sys.exit(1 if failed else 0)

if __name__ == "__main__":
    main()
