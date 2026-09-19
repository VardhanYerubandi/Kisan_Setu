#!/usr/bin/env python3
"""Draws docs/architecture.png (system architecture)."""
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

G, GD, LEAF, GOLD, INK, MUTE, RED, SKY = "#1f5f3b", "#16472c", "#e2efe0", "#f2b01e", "#1c2541", "#55607a", "#c0392b", "#dcebf5"
fig, ax = plt.subplots(figsize=(16, 9.2), dpi=150); ax.set_xlim(0, 160); ax.set_ylim(0, 92); ax.axis("off")
fig.patch.set_facecolor("white")

def box(x, y, w, h, title=None, fc="white", ec=G, lw=1.6, tc=INK, fs=10.5, bold=True, r=1.6):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle=f"round,pad=0,rounding_size={r}", fc=fc, ec=ec, lw=lw))
    if title: ax.text(x + w / 2, y + h / 2, title, ha="center", va="center", fontsize=fs, color=tc, weight="bold" if bold else "normal", linespacing=1.35)

def group(x, y, w, h, title, fc):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0,rounding_size=2.2", fc=fc, ec=G, lw=2))
    ax.text(x + 2.5, y + h - 3, title, ha="left", va="center", fontsize=13, color=GD, weight="bold")

def arrow(a, b, label=None, color=G, both=True, lx=0, ly=0, rad=0.0, fs=9):
    ax.add_patch(FancyArrowPatch(a, b, arrowstyle="<|-|>" if both else "-|>", mutation_scale=16, lw=2, color=color, connectionstyle=f"arc3,rad={rad}"))
    if label: ax.text((a[0] + b[0]) / 2 + lx, (a[1] + b[1]) / 2 + ly, label, ha="center", va="center", fontsize=fs, color=color, weight="bold",
                      bbox=dict(fc="white", ec="none", pad=1.5))

ax.text(80, 88.3, "Kisan Setu — system architecture", ha="center", fontsize=18, weight="bold", color=INK)

# ---- farmer phone
group(2, 5, 52, 77, "Farmer's phone (PWA, works offline)", LEAF)
box(5, 63, 46, 9, "React app, 5 languages, dark mode\nlisten-aloud and voice crop pick", fs=9)
box(5, 51, 22, 9, "Service worker\napp shell + data cache", fs=8.3)
box(29, 51, 22, 9, "On-device knowledge\nbase (12 problems)", fs=8.3)
box(5, 36, 46, 12, "IndexedDB\ncases, listings, requests, outbox,\ncached prices and directories", fs=8.6)
box(5, 23, 46, 10, "Sync engine: sends the outbox when online\nand signed in; client_id makes retries safe", fc=GOLD, ec="#d99a0c", fs=8.3)
box(5, 9, 46, 10, "Device: camera, GPS, speech,\ntel and WhatsApp links", fc=SKY, ec="#5a8fb0", fs=8.8)

# ---- server
group(72, 5, 50, 77, "Kisan Setu server (Java 21)", LEAF)
box(75, 63, 44, 9, "Static host + security headers\n(CSP, nosniff, no-store on API)", fs=8.8)
box(75, 52, 44, 9, "REST API  /api/*\nJSON, size limits, input validation", fs=8.8)
box(75, 41, 21, 9, "Auth + roles\nPBKDF2 PIN, HMAC token\n5-try lockout", fs=7.6)
box(98, 41, 21, 9, "Idempotent writes\nUNIQUE(user, client_id)", fs=7.6)
box(75, 30, 44, 9, "AI orchestrator: photo to Claude vision\nids checked against KB, confidence\nclamped, daily limit per user", fc=GOLD, ec="#d99a0c", fs=8)
box(75, 19, 21, 9, "Directory + prices\nbuyers, storage,\ntransport", fs=7.6)
box(98, 19, 21, 9, "Admin API\nstats, approvals,\nCSV export", fs=7.6)
box(75, 8, 44, 9, "Atomic JSON store + photo files\n(photos readable by admin only)", fc="white", ec=INK, fs=8.6)

# ---- right column
box(137, 58, 21, 14, "Admin web\nconsole /admin\n(FPO team)", fc=SKY, ec="#5a8fb0", fs=8.6)
box(137, 31, 21, 13, "Claude vision\nAPI (Anthropic)", fc="white", ec=INK, fs=8.8)
box(137, 14, 21, 13, "Agmarknet prices\n(data.gov.in)", fc="white", ec=INK, fs=8.8)

# ---- arrows (one straight arrow per link)
arrow((54, 56.5), (72, 56.5), None)
ax.text(63, 62, "HTTPS + JSON\nqueued offline", ha="center", va="center", fontsize=8, color=G, weight="bold")
arrow((122, 36), (137, 36), None, color=RED)
ax.text(129.5, 41, "photo,\nKB ids", ha="center", va="center", fontsize=7.6, color=RED, weight="bold")
ax.text(129.5, 31, "JSON", ha="center", va="center", fontsize=7.6, color=RED, weight="bold")
arrow((137, 22), (122, 22), None, color=MUTE, both=False)
ax.text(129.5, 26.5, "daily\nprices", ha="center", va="center", fontsize=7.6, color=MUTE, weight="bold")
arrow((137, 64), (122, 56.5), None, color=MUTE)
fig.savefig("docs/architecture.png", bbox_inches="tight", facecolor="white")
print("ok")
