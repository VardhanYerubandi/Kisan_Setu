#!/usr/bin/env python3
"""Browser end-to-end test: React app + Java backend (Playwright/Chromium).  python3 tools/e2e_ui.py"""
import json, os, sys, tempfile, time, urllib.request
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from serve_test import boot, stop
from playwright.sync_api import sync_playwright

SHOTS = Path(os.environ.get("SHOTS", "/tmp/jshots")); SHOTS.mkdir(exist_ok=True, parents=True)
passed = failed = 0

def check(name, cond, extra=""):
    global passed, failed
    if cond: passed += 1; print(f"  ok   {name}")
    else: failed += 1; print(f"  FAIL {name} {extra}")

def make_leaf(path):
    from PIL import Image, ImageDraw
    im = Image.new("RGB", (900, 700), (196, 214, 176)); d = ImageDraw.Draw(im)
    d.polygon([(120, 560), (200, 260), (450, 90), (760, 130), (800, 330), (640, 560), (380, 640)], fill=(62, 128, 58))
    d.line([(150, 560), (760, 160)], fill=(120, 170, 100), width=8)
    for (x, y, r) in [(330, 300, 42), (520, 250, 34), (600, 380, 38), (430, 430, 30), (260, 430, 26)]:
        d.ellipse([x - r, y - r, x + r, y + r], fill=(122, 78, 36)); d.ellipse([x - r * .62, y - r * .62, x + r * .62, y + r * .62], fill=(160, 110, 50))
    im.save(path, quality=90)

def main():
    procs, URL, tmp = boot(8840, ai=True, ai_port=8841)
    leaf = Path(tmp) / "leaf.jpg"; make_leaf(leaf)
    def api(path, body=None, token=None):
        req = urllib.request.Request(URL + path, data=json.dumps(body).encode() if body else None, method="POST" if body else "GET")
        req.add_header("Content-Type", "application/json")
        if token: req.add_header("Authorization", "Bearer " + token)
        with urllib.request.urlopen(req, timeout=10) as r: return json.loads(r.read())
    errors = []
    try:
        with sync_playwright() as p:
            b = p.chromium.launch()
            ctx = b.new_context(viewport={"width": 390, "height": 800}, device_scale_factor=2, is_mobile=True, has_touch=True, permissions=["geolocation"], geolocation={"latitude": 15.5057, "longitude": 80.0499})
            ctx.add_init_script("sessionStorage.setItem('ks_x','1')")
            pg = ctx.new_page()
            pg.on("pageerror", lambda e: errors.append(str(e)))
            pg.on("console", lambda m: errors.append(m.text) if m.type == "error" and "Failed to load resource" not in m.text else None)
            T = lambda i: f'[data-testid="{i}"]'

            print("first launch, languages, guest symptom check")
            pg.goto(URL); pg.wait_for_selector(T("lang-en"))
            pg.screenshot(path=str(SHOTS / "lang.png"))
            pg.click(T("lang-te")); pg.wait_for_selector(T("tile-scan"))
            check("Telugu home renders", "పంటను పరీక్షించండి" in pg.inner_text(T("tile-scan")))
            pg.click(T("tool-lang")); pg.click(T("lang-en")); pg.wait_for_selector(T("tile-scan"))
            check("English home + live price tile", "Check my crop" in pg.inner_text(T("tile-scan")) and "₹" in pg.inner_text(T("tile-prices")))
            pg.evaluate("navigator.serviceWorker.ready.then(() => true)")
            pg.click(T("tile-scan")); pg.click(T("crop-paddy")); pg.click(T("go-symptoms")); pg.click(T("sym-spots")); pg.click(T("sym-done"))
            pg.wait_for_selector(T("problem-name"))
            check("paddy + spots -> Rice blast", pg.inner_text(T("problem-name")) == "Rice blast")
            check("three treatment tiers shown", pg.locator(T("tier-free")).count() == 1 and pg.locator(T("tier-chem")).count() == 1)
            check("no 'waiting to send' nag for guest", pg.locator(".strip").count() == 0)
            for name, sel in (("prices", "[data-testid=price-row]"), ("buyers", T("buyer-card")), ("storage", T("storage-card")), ("transport", T("transporter-card"))):
                pg.goto(f"{URL}/#/{name}"); pg.wait_for_selector(sel)   # also primes the offline cache

            print("prices, place, chart scrub, transport estimate")
            pg.goto(f"{URL}/#/place"); pg.click(T("city-Ongole")); pg.wait_for_selector(T("tile-scan")) if False else None
            pg.goto(f"{URL}/#/prices"); pg.click(T("chip-chilli")); pg.wait_for_selector(T("area-chart"))
            check("prices show distance once place is set", " km" in pg.inner_text(".page"))
            first = pg.inner_text(".chart-val b")
            box = pg.locator(T("area-chart") + " svg").bounding_box()
            pg.mouse.move(box["x"] + 20, box["y"] + box["height"] / 2); pg.mouse.down(); pg.mouse.move(box["x"] + 60, box["y"] + box["height"] / 2)
            second = pg.inner_text(".chart-val b"); pg.mouse.up()
            check("chart scrubbing changes the shown price", first != second, f"{first} vs {second}")
            pg.wait_for_timeout(900); pg.screenshot(path=str(SHOTS / "prices.png"))
            pg.goto(f"{URL}/#/transport"); pg.fill(T("tq"), "18"); pg.select_option(T("td"), "Guntur"); pg.wait_for_selector(T("estimate"))
            check("transport estimate (pickup for 18 q)", "Pickup" in pg.inner_text(T("estimate")) and "₹" in pg.inner_text(T("estimate")))

            print("register + photo diagnosis online")
            pg.goto(f"{URL}/#/profile"); pg.fill(T("reg-name"), "Ravi Kumar"); pg.fill(T("reg-village"), "Demo Village"); pg.fill(T("phone"), "9876543210"); pg.fill(T("pin"), "1234")
            pg.click(T("submit")); pg.wait_for_selector(T("tile-scan"))
            check("registered and logged in", pg.evaluate("!!localStorage.getItem('ks_token')"))
            pg.click(T("tile-scan")); pg.click(T("crop-tomato")); pg.set_input_files(T("file-gal"), str(leaf)); pg.wait_for_selector(T("photo-preview"))
            pg.screenshot(path=str(SHOTS / "photo.png"))
            pg.click(T("photo-check")); pg.wait_for_selector(T("problem-name"), timeout=20000)
            pg.wait_for_function("() => document.querySelector('[data-testid=problem-name]').innerText.length > 0")
            check("photo -> AI result rendered", pg.inner_text(T("problem-name")) == "Early blight" and "Checked from your photo" in pg.inner_text(T("problem-source")))
            check("AI observation shown", "Brown round spots" in pg.inner_text(T("problem-observation")))
            pg.wait_for_timeout(1400); pg.screenshot(path=str(SHOTS / "result.png"))

            print("OFFLINE: photo check, listing, two requests")
            ctx.set_offline(True); pg.goto(URL); pg.wait_for_selector(T("tile-scan"))
            check("app shell loads offline", pg.locator(T("tile-scan")).count() == 1)
            check("offline banner", "No internet" in pg.inner_text(".strip"))
            pg.click(T("tile-scan")); pg.click(T("crop-paddy")); pg.set_input_files(T("file-cam"), str(leaf)); pg.wait_for_selector(T("photo-preview")); pg.click(T("photo-check"))
            pg.wait_for_selector(T("result-pending"))
            check("offline photo saved + explained", "Waiting for internet" in pg.inner_text(T("result-pending")))
            pg.wait_for_timeout(600); pg.screenshot(path=str(SHOTS / "offline.png"))
            pg.goto(f"{URL}/#/sell"); pg.select_option(T("sell-crop"), "chilli"); pg.fill(T("sell-qty"), "25"); pg.fill(T("sell-price"), "14000"); pg.click(T("sell-post"))
            pg.wait_for_selector(T("my-listing"))
            check("listing saved offline", "Waiting to send" in pg.inner_text(T("my-listing")))
            pg.goto(f"{URL}/#/buyers"); pg.wait_for_selector(T("buyer-card"))
            check("buyers list loads offline (cached)", pg.locator(T("buyer-card")).count() >= 5)
            pg.locator(T("ask-buyer")).first.click(); pg.fill(T("ask-qty"), "25"); pg.click(T("ask-send")); pg.wait_for_selector(".toast")
            pg.goto(f"{URL}/#/storage"); pg.wait_for_selector(T("storage-card")); pg.locator(T("ask-storage")).first.click(); pg.fill(T("ask-qty"), "10"); pg.click(T("ask-send"))
            pg.wait_for_function("() => document.querySelector('.strip') && document.querySelector('.strip').innerText.includes('4 waiting')", timeout=6000)
            check("4 items queued offline (photo, listing, 2 requests)", "4 waiting" in pg.inner_text(".strip"))

            print("back ONLINE: automatic sync")
            ctx.set_offline(False); pg.evaluate("window.dispatchEvent(new Event('online'))")
            pg.wait_for_function("() => !document.querySelector('.strip')", timeout=30000)
            check("outbox drained, banner gone", pg.locator(".strip").count() == 0)
            admin = api("/api/login", {"phone": "9000000000", "pin": "482913"})["token"]
            st = api("/api/admin/stats", token=admin)
            check("server: 1 listing, 2 requests, 2 photo cases", st["listings"] == 1 and sum(st["requests_by_kind"].values()) == 2 and st["cases"] == 2, json.dumps(st)[:300])
            pg.goto(f"{URL}/#/cases"); pg.wait_for_selector(T("case-card"))
            check("history shows all three checks", pg.locator(T("case-card")).count() == 3)
            pg.goto(f"{URL}/#/profile"); pg.click(T("sync-now")); time.sleep(0.8)
            check("no duplicates after another sync", api("/api/admin/stats", token=admin)["listings"] == 1)

            print("command palette")
            pg.goto(f"{URL}/#/home"); pg.wait_for_selector(T("tile-scan")); pg.keyboard.press("Control+k"); pg.wait_for_selector(T("palette"))
            pg.keyboard.type("prices"); pg.keyboard.press("Enter"); pg.wait_for_function("() => location.hash.startsWith('#/prices')")
            check("Ctrl+K palette navigates", "#/prices" in pg.evaluate("location.hash"))

            print("buyer approval flow")
            bctx = b.new_context(viewport={"width": 390, "height": 800}, is_mobile=True, has_touch=True)
            bctx.add_init_script("localStorage.getItem('ks_lang') || localStorage.setItem('ks_lang','en')")
            bp = bctx.new_page(); bp.goto(f"{URL}/#/profile"); bp.click(T("role-buyer"))
            bp.fill(T("reg-name"), "Meena"); bp.fill(T("reg-business"), "Meena Traders"); bp.fill(T("phone"), "9123456780"); bp.fill(T("pin"), "4321"); bp.click(T("submit"))
            bp.wait_for_selector(T("tile-produce")); bp.click(T("tile-produce")); bp.wait_for_selector(T("verify-note"))
            check("unverified buyer: notice shown, no phone", "waiting for approval" in bp.inner_text(".page") and "Call" not in bp.inner_text(".page"))
            uid = [u for u in api("/api/admin/users", token=admin)["users"] if u["role"] == "buyer"][0]["id"]
            api("/api/admin/verify", {"user_id": uid, "verified": True}, admin)
            bp.reload(); bp.wait_for_selector(T("produce-card"))
            check("approved buyer sees farmer phone", "Call" in bp.inner_text(".page"))
            bp.screenshot(path=str(SHOTS / "buyer.png"))

            print("admin console")
            ap = ctx.new_page(); ap.goto(f"{URL}/admin"); ap.fill(T("admin-phone"), "9000000000"); ap.fill(T("admin-pin"), "482913"); ap.click(T("admin-go"))
            ap.wait_for_selector(T("stats")); check("admin overview renders", "Crop checks" in ap.inner_text("main"))
            ap.set_viewport_size({"width": 1180, "height": 900}); ap.wait_for_timeout(900); ap.screenshot(path=str(SHOTS / "admin.png"))
            ap.click('nav button[data-t="cases"]'); ap.wait_for_function("() => document.querySelectorAll('table tbody tr').length >= 2", timeout=8000); check("admin cases table lists both photo checks", ap.locator("table tbody tr").count() == 2)
            b.close()
    finally:
        stop(procs)
    check("no JS errors in console", not errors, "; ".join(errors)[:300])
    print(f"\n{passed} passed, {failed} failed"); sys.exit(1 if failed else 0)

if __name__ == "__main__":
    main()
