"""Shared helper: boot the Java backend (+ optional mock AI) on temp data for browser scripts."""
import os, shutil, subprocess, sys, tempfile, time
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent

def ensure_built():
    """Compile the backend if needed. Uses javac when present, else the JDK's compiler module (works on a JRE-only box)."""
    out = ROOT / "backend" / "out"
    if (out / "setu" / "Main.class").exists(): return
    srcs = [str(p) for p in (ROOT / "backend" / "src" / "main" / "java").rglob("*.java")]
    cmd = ["javac"] if shutil.which("javac") else ["java", "-m", "jdk.compiler/com.sun.tools.javac.Main"]
    subprocess.run(cmd + ["-d", str(out)] + srcs, check=True)

def boot(port=8830, ai=False, ai_port=8831, data=None):
    ensure_built()
    tmp = data or tempfile.mkdtemp()
    env = {**os.environ, "PORT": str(port), "KS_DATA": tmp, "KS_QUIET": "1", "ADMIN_PHONE": "9000000000", "ADMIN_PIN": "482913"}
    procs = []
    if ai:
        env.update(ANTHROPIC_API_KEY="test-key", ANTHROPIC_BASE_URL=f"http://127.0.0.1:{ai_port}")
        procs.append(subprocess.Popen([sys.executable, str(ROOT / "tools" / "mock_ai.py"), str(ai_port)]))
    procs.append(subprocess.Popen(["java", "-cp", f"{ROOT}/backend/out:{ROOT}/backend/src/main/resources", "setu.Main"], env=env, stdout=subprocess.DEVNULL))
    import urllib.request
    for _ in range(80):                                   # poll until the server answers (up to ~10 s)
        try: urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health", timeout=1); break
        except Exception: time.sleep(0.125)
    return procs, f"http://127.0.0.1:{port}", tmp

def stop(procs):
    for p in procs: p.terminate()
    for p in procs:
        try: p.wait(timeout=8)
        except Exception: p.kill()
