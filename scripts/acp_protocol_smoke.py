"""Evidence-only ACP smoke test against the exact installed DSH executable.

Never sends a model prompt or treats simulated output as protocol proof.
Records the package version, process status and genuine JSON-RPC responses.
"""
import json
import os
from pathlib import Path
import selectors
import subprocess
import sys
import time

root = Path(os.environ.get("RUNNER_TEMP", "/tmp"))
out = root / "dsh-acp-evidence"
out.mkdir(exist_ok=True)
binary = root / "dsh/node_modules/.bin/dsh"
evidence = {"package": "@deepseek-ai/dsh", "configured_version": "0.2.1-alpha.2",
            "binary_exists": binary.exists(), "probes": [], "status": "not_started"}
if not binary.exists():
    (out / "evidence.json").write_text(json.dumps(evidence, indent=2))
    raise SystemExit("Missing installed DSH binary")
process = subprocess.Popen([str(binary), "--profile", "acp"], cwd=str(root),
    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    bufsize=0, env={**os.environ, "DSH_HOME": str(root / "acp-home")})
selector = selectors.DefaultSelector()
selector.register(process.stdout, selectors.EVENT_READ)
buf = b""

def request(method, params, request_id, timeout=25):
    global buf
    message = {"jsonrpc": "2.0", "id": request_id, "method": method, "params": params}
    process.stdin.write((json.dumps(message) + "\n").encode())
    process.stdin.flush()
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if process.poll() is not None and not selector.select(0):
            break
        for key, _ in selector.select(min(1, deadline-time.monotonic())):
            block = os.read(key.fd, 65536)
            if not block:
                break
            buf += block
            while b"\n" in buf:
                line, buf = buf.split(b"\n", 1)
                try:
                    response = json.loads(line)
                except (UnicodeDecodeError, json.JSONDecodeError):
                    continue
                if response.get("id") == request_id:
                    return response
    return {"timeout": True, "process_exit": process.poll()}

try:
    init = request("initialize", {"protocolVersion": 1,
          "clientCapabilities": {}, "clientInfo": {"name": "dsh-vscode-probe", "version": "0.1.0"}}, 1)
    evidence["probes"].append({"method": "initialize", "response": init})
    if "result" not in init:
        evidence["status"] = "initialize_failed"
    else:
        evidence["status"] = "initialized"
        workspace = str(root.resolve())
        session = request("session/new", {"cwd": workspace, "mcpServers": []}, 2)
        evidence["probes"].append({"method": "session/new", "response": session})
        evidence["status"] = "session_created" if "result" in session else "session_new_failed"
finally:
    process.terminate()
    try:
        _, stderr = process.communicate(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        _, stderr = process.communicate()
    evidence["exit_after_terminate"] = process.returncode
    evidence["stderr_tail"] = stderr.decode("utf-8", "replace")[-1500:]
    (out / "evidence.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=2))
print("ACP evidence:", evidence["status"])
if evidence["status"] not in {"initialized", "session_created"}:
    sys.exit(1)
