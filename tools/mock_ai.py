#!/usr/bin/env python3
"""TEST-ONLY stand-in for the Anthropic Messages API.

Lets you exercise the server's photo-diagnosis pipeline (request format, JSON
parsing, id validation) without a network or API key:

    python3 tools/mock_ai.py 9911 &
    ANTHROPIC_API_KEY=test ANTHROPIC_BASE_URL=http://127.0.0.1:9911 python3 server/server.py

It returns a canned answer chosen from the crop named in the prompt. It does
NOT analyse the image — never use it as a real diagnosis engine.
"""
import json, re, sys
from http.server import BaseHTTPRequestHandler, HTTPServer

CANNED = {
    "tomato": {"crop_seen": "tomato", "match_id": "tomato_early", "confidence": 0.86, "alternatives": ["tomato_late"],
               "observation": "Brown round spots with rings on the older leaves; some yellowing around the spots."},
    "paddy": {"crop_seen": "paddy", "match_id": "paddy_blast", "confidence": 0.81, "alternatives": ["paddy_blb"],
              "observation": "Diamond-shaped grey spots with brown edges on the leaf."},
    "chilli": {"crop_seen": "chilli", "match_id": "chilli_anthra", "confidence": 0.78, "alternatives": [],
               "observation": "Sunken dark spots on the fruit."},
}
DEFAULT = {"crop_seen": "unknown", "match_id": "not-a-real-id", "confidence": 1.7, "alternatives": ["x"], "observation": "Unclear photo."}

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        req = json.loads(self.rfile.read(n))
        assert self.headers.get("x-api-key"), "missing key"
        assert req["messages"][0]["content"][0]["type"] == "image", "image block missing"
        text = req["messages"][0]["content"][1]["text"]
        m = re.search(r"crop is: (\w+)", text)
        out = CANNED.get(m.group(1) if m else "", DEFAULT)
        body = json.dumps({"content": [{"type": "text", "text": "Here you go:\n" + json.dumps(out)}]}).encode()
        self.send_response(200); self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)

if __name__ == "__main__":
    HTTPServer(("127.0.0.1", int(sys.argv[1]) if len(sys.argv) > 1 else 9911), H).serve_forever()
