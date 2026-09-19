#!/usr/bin/env python3
"""Durability: data must survive a server restart (users, cases, listings, admin, uploaded photos, PIN hashing)."""
import base64, io, json, sys, tempfile, urllib.request, urllib.error
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from serve_test import boot, stop

ok = True
def check(name, cond):
    global ok
    print(("  ok   " if cond else "  FAIL ") + name); ok = ok and cond

def call(url, path, body=None, token=None):
    r = urllib.request.Request(url + path, data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET", headers={"Content-Type": "application/json", **({"Authorization": "Bearer " + token} if token else {})})
    try:
        with urllib.request.urlopen(r, timeout=10) as x: return x.status, json.loads(x.read())
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read())

from PIL import Image
buf = io.BytesIO(); Image.new("RGB", (32, 32), (10, 120, 10)).save(buf, "JPEG"); img = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
data = tempfile.mkdtemp()
procs, url, _ = boot(8850, data=data)
_, r = call(url, "/api/register", {"name": "Durable", "phone": "9876500001", "pin": "2468"}); tok = r["token"]
call(url, "/api/listings", {"client_id": "persist-list-1", "crop": "maize", "qty_qtl": 12}, tok)
call(url, "/api/cases", {"client_id": "persist-case-1", "source": "photo", "crop": "maize", "image": img}, tok)
stop(procs)
files = sorted(p.name for p in Path(data).iterdir())
check("db.json and uploads folder exist on disk", "db.json" in files and "uploads" in files)
procs, url, _ = boot(8850, data=data)     # restart on the same folder
s, r = call(url, "/api/login", {"phone": "9876500001", "pin": "2468"})
check("user + PIN hash survive restart (login works)", s == 200 and r["user"]["name"] == "Durable")
tok = r["token"]
_, l = call(url, "/api/listings/mine", token=tok); check("listing survives restart", len(l["listings"]) == 1 and l["listings"][0]["crop"] == "maize")
_, c = call(url, "/api/cases", token=tok); check("case survives restart", len(c["cases"]) == 1 and c["cases"][0]["has_image"] is True)
s, r = call(url, "/api/login", {"phone": "9000000000", "pin": "482913"}); check("admin persisted (not re-created with a new PIN)", s == 200 and r["user"]["role"] == "admin")
s, dup = call(url, "/api/listings", {"client_id": "persist-list-1", "crop": "maize", "qty_qtl": 12}, tok); check("idempotency survives restart (no duplicate)", dup.get("duplicate") is True)
check("photo file kept on disk", len(list((Path(data) / "uploads").iterdir())) == 1)
stop(procs)
print("\n" + ("all durable" if ok else "FAILED")); sys.exit(0 if ok else 1)
