#!/usr/bin/env python3
"""Captures docs/screens/*.png from the running React app (mock AI used for the photo result; labelled as such in the docs)."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from serve_test import boot, stop
from e2e_ui import make_leaf
from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent.parent / "docs" / "screens"; OUT.mkdir(parents=True, exist_ok=True)
T = lambda i: f'[data-testid="{i}"]'

def main():
    procs, URL, tmp = boot(8860, ai=True, ai_port=8861)
    leaf = Path(tmp) / "leaf.jpg"; make_leaf(leaf)
    try:
        with sync_playwright() as p:
            b = p.chromium.launch()
            def mk(theme="light"):
                c = b.new_context(viewport={"width": 390, "height": 800}, device_scale_factor=2, is_mobile=True, has_touch=True, color_scheme=theme)
                c.add_init_script("localStorage.setItem('ks_lang','en')"); return c
            ctx = mk(); pg = ctx.new_page()
            def shot(n, wait=1300, full=False): pg.wait_for_timeout(wait); pg.screenshot(path=str(OUT / f"{n}.png"), full_page=full)
            pg.goto(URL); pg.wait_for_selector(T("tile-scan")); shot("01_home", 2200)
            pg.click(T("tool-theme")); shot("02_home_dark", 900); pg.click(T("tool-theme"))
            pg.goto(f"{URL}/#/scan"); pg.wait_for_selector(T("crop-tomato")); shot("03_crops")
            pg.goto(f"{URL}/#/scan/symptoms?crop=tomato"); pg.click(T("sym-spots")); pg.click(T("sym-yellow")); shot("04_symptoms")
            pg.click(T("sym-done")); pg.wait_for_selector(T("problem-name")); shot("05_result", 1800)
            pg.goto(f"{URL}/#/place"); pg.click(T("city-Ongole"))
            pg.goto(f"{URL}/#/prices"); pg.click(T("chip-chilli")); pg.wait_for_selector(T("area-chart")); shot("06_prices", 1800)
            pg.goto(f"{URL}/#/buyers"); pg.wait_for_selector(T("buyer-card")); shot("07_buyers")
            pg.goto(f"{URL}/#/storage"); pg.wait_for_selector(T("storage-card")); shot("08_storage")
            pg.goto(f"{URL}/#/transport"); pg.fill(T("tq"), "18"); pg.select_option(T("td"), "Guntur"); pg.wait_for_selector(T("estimate")); shot("09_transport")
            pg.goto(f"{URL}/#/profile"); pg.fill(T("reg-name"), "Ravi Kumar"); pg.fill(T("reg-village"), "Demo Village"); pg.fill(T("phone"), "9876543210"); pg.fill(T("pin"), "12"); shot("10_signup", 500)
            pg.fill(T("pin"), "1234"); pg.click(T("submit")); pg.wait_for_selector(T("tile-scan"))
            pg.goto(f"{URL}/#/scan/photo?crop=tomato"); pg.set_input_files(T("file-gal"), str(leaf)); pg.wait_for_selector(T("photo-preview")); shot("11_photo", 900)
            pg.click(T("photo-check")); pg.wait_for_selector(T("verdict"), timeout=20000); shot("12_result_photo", 2000)
            ctx.set_offline(True); pg.goto(f"{URL}/#/scan/photo?crop=paddy"); pg.set_input_files(T("file-cam"), str(leaf)); pg.wait_for_selector(T("photo-preview")); pg.click(T("photo-check"))
            pg.wait_for_selector(T("result-pending")); shot("13_offline", 1200)
            pg.goto(f"{URL}/#/sell"); pg.select_option(T("sell-crop"), "chilli"); pg.fill(T("sell-qty"), "25"); pg.fill(T("sell-price"), "14000"); shot("14_sell", 700)
            ctx.set_offline(False)
            d = b.new_context(viewport={"width": 1440, "height": 900}); d.add_init_script("localStorage.setItem('ks_lang','en')")
            dp = d.new_page(); dp.goto(URL); dp.wait_for_selector(T("tile-scan")); dp.wait_for_timeout(3000); dp.screenshot(path=str(OUT / "00_desktop.png"))
            a = b.new_context(viewport={"width": 1280, "height": 900}); ap = a.new_page(); ap.goto(f"{URL}/admin")
            ap.fill(T("admin-phone"), "9000000000"); ap.fill(T("admin-pin"), "482913"); ap.click(T("admin-go")); ap.wait_for_selector(T("stats")); ap.wait_for_timeout(1400); ap.screenshot(path=str(OUT / "15_admin.png"))
            b.close()
    finally:
        stop(procs)
    print(sorted(x.name for x in OUT.glob("*.png")))

if __name__ == "__main__":
    main()
