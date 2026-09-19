#!/usr/bin/env python3
"""Records demo/kisan-setu-demo.mp4: a captioned walkthrough of the real React app on the real Java backend.
The AI service is a STAND-IN here (tools/mock_ai.py), and the video says so on screen. Use --real-ai with ANTHROPIC_API_KEY set to record against the real service."""
import os, shutil, subprocess, sys, tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from serve_test import boot, stop, ROOT
from e2e_ui import make_leaf
from playwright.sync_api import sync_playwright

T = lambda i: f'[data-testid="{i}"]'
CAP = """t => { let e = document.getElementById('cap');
  if (!e) { e = document.createElement('div'); e.id = 'cap';
    e.style.cssText = 'position:fixed;left:5vw;bottom:64px;z-index:99999;max-width:36vw;background:rgba(6,18,13,.92);color:#c8f169;padding:16px 24px;border-radius:24px;font:800 22px/1.3 system-ui,sans-serif;border:1px solid rgba(200,241,105,.55);box-shadow:0 24px 50px rgba(0,0,0,.6)';
    document.body.appendChild(e); }
  e.textContent = t; e.style.display = t ? 'block' : 'none'; }"""

def main():
    real = "--real-ai" in sys.argv
    procs, URL, tmp = boot(8870, ai=not real, ai_port=8871)
    leaf = Path(tmp) / "leaf.jpg"; make_leaf(leaf)
    vids = Path(tmp) / "vid"; out = ROOT / "demo"; out.mkdir(exist_ok=True)
    try:
        with sync_playwright() as p:
            b = p.chromium.launch()
            ctx = b.new_context(viewport={"width": 1440, "height": 900}, record_video_dir=str(vids), record_video_size={"width": 1440, "height": 900},
                                permissions=["geolocation"], geolocation={"latitude": 15.5057, "longitude": 80.0499})
            pg = ctx.new_page()
            cap = lambda s: pg.evaluate(CAP, s)
            w = pg.wait_for_timeout
            pg.goto(URL); pg.wait_for_selector(T("lang-en")); w(1800)
            cap("1. Pick a language once: English, Telugu, Hindi, Tamil, Kannada"); w(2500)
            pg.click(T("lang-en")); pg.wait_for_selector(T("tile-scan")); w(1500)
            cap("2. Home shows live numbers before you tap: best price, free cold storage, rate per km (sample data)"); 
            pg.hover(T("tile-prices")); w(1200); pg.hover(T("tile-storage")); w(1200); pg.hover(T("tile-scan")); w(1500)
            cap("3. Check my crop: tap the pictures you see. Works with no internet"); pg.click(T("tile-scan")); w(1200)
            pg.click(T("crop-tomato")); w(900); pg.click(T("go-symptoms")); w(1000)
            pg.click(T("sym-spots")); w(800); pg.click(T("sym-yellow")); w(1000); pg.click(T("sym-done")); pg.wait_for_selector(T("verdict")); w(3200)
            cap("4. Result: how sure we are, and advice by cost. No cost first, spray only if it spreads"); w(3000)
            pg.goto(f"{URL}/#/place"); w(700); pg.click(T("city-Ongole")); w(900)
            cap("5. Prices: highest and nearest market. Drag the chart to read each day"); pg.goto(f"{URL}/#/prices"); pg.click(T("chip-chilli")); pg.wait_for_selector(T("area-chart")); w(1800)
            box = pg.locator(T("area-chart") + " svg").bounding_box()
            for f in (0.12, 0.3, 0.5, 0.7, 0.9, 0.5, 0.2):
                pg.mouse.move(box["x"] + box["width"] * f, box["y"] + box["height"] / 2, steps=8); w(350)
            cap("6. Transport: cost estimate from load and distance"); pg.goto(f"{URL}/#/transport"); pg.fill(T("tq"), "18"); w(500); pg.select_option(T("td"), "Guntur"); w(3000)
            cap("7. Ctrl+K jumps anywhere"); pg.goto(f"{URL}/#/home"); w(800); pg.keyboard.press("Control+k"); w(1000); pg.keyboard.type("sell", delay=140); w(900); pg.keyboard.press("Enter"); w(1500)
            cap("8. Create an account: name, mobile number and a 4-dot secret number"); pg.goto(f"{URL}/#/profile"); w(800)
            pg.fill(T("reg-name"), "Ravi Kumar"); pg.fill(T("reg-village"), "Demo Village"); pg.fill(T("phone"), "9876543210"); pg.click(T("pin")); pg.keyboard.type("1234", delay=350); w(900)
            pg.click(T("submit")); pg.wait_for_selector(T("tile-scan")); w(1200)
            cap("9. Photo check: viewfinder, then AI. NOTE: the AI is a stub in this recording"); pg.goto(f"{URL}/#/scan/photo?crop=tomato"); w(800)
            pg.set_input_files(T("file-gal"), str(leaf)); pg.wait_for_selector(T("photo-preview")); w(2600); pg.click(T("photo-check")); pg.wait_for_selector(T("verdict"), timeout=20000); w(3200)
            cap("10. The signal drops. Nothing typed is lost"); ctx.set_offline(True); pg.goto(f"{URL}/#/sell"); w(1500)
            pg.select_option(T("sell-crop"), "chilli"); pg.fill(T("sell-qty"), "25"); pg.fill(T("sell-price"), "14000"); w(900); pg.click(T("sell-post")); w(2600)
            cap("11. Saved on the phone. The banner says one item is waiting"); pg.goto(f"{URL}/#/home"); w(2600)
            cap("12. Signal is back: it sends by itself, once, with no duplicates"); ctx.set_offline(False); pg.evaluate("() => window.dispatchEvent(new Event('online'))"); w(3800)
            cap("13. Admin control room: approve buyers, review photos, export CSV"); pg.goto(f"{URL}/admin"); pg.fill(T("admin-phone"), "9000000000"); pg.fill(T("admin-pin"), "482913"); pg.click(T("admin-go")); pg.wait_for_selector(T("stats")); w(3800)
            pg.click('nav button[data-t="cases"]'); w(2600); cap("Kisan Setu: Java 21 backend, React app, works offline. Directory data is sample data."); w(3000)
            path = pg.video.path(); ctx.close(); b.close()
        webm = Path(path); mp4 = out / "kisan-setu-demo.mp4"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(webm), "-c:v", "libx264", "-preset", "veryfast", "-crf", "27", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(mp4)], check=True)
        print("wrote", mp4, round(mp4.stat().st_size / 1e6, 1), "MB")
    finally:
        stop(procs)

if __name__ == "__main__":
    main()
