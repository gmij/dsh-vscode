"""Real ACP capability probe; never upgrades a failure to success or emits model text."""
import json, os, selectors, subprocess, time
from pathlib import Path

root=Path(os.environ.get("RUNNER_TEMP","/tmp"))
out=root/"dsh-acp-e2e";out.mkdir(exist_ok=True)
binary=root/"dsh/node_modules/.bin/dsh"
workspace=root/"acp-test-project";workspace.mkdir(exist_ok=True)
(workspace/"README.md").write_text("ACP read-only integration probe. Unique token: ACPTASK01READONLY.")
patch_file=root/"acp-model.patch.json"
patch=[
 {"id":"acp","config":{"provider":"github-copilot","model":"gpt-6.1-sol"}},
 {"id":"agent-default-model","config":{"provider":"github-copilot","model":"gpt-6.1-sol"}},
 {"id":"llm-pi-ai","config":{"providers":{"github-copilot":{"apiKeyEnv":"GITHUB_TOKEN","baseURL":"https://api.githubcopilot.com","api":"openai-responses","headers":{"Copilot-Integration-Id":"agentic-workflows"},"models":[{"id":"gpt-6.1-sol","maxTokens":8192}],"retryPolicy":{"mode":"normal","maxRetries":0}}}}}
]
patch_file.write_text(json.dumps(patch))
evidence={"package_version":"0.2.1-alpha.2","tests":{},"status":"incomplete"}
home=root/"acp-e2e-home"
class ACP:
 def __init__(self):
  self.proc=subprocess.Popen([str(binary),"--profile","acp","--patch",str(patch_file)],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,bufsize=0,env={**os.environ,"DSH_HOME":str(home)})
  self.sel=selectors.DefaultSelector();self.sel.register(self.proc.stdout,selectors.EVENT_READ);self.buf=b"";self.events=[];self.next_id=0
 def send(self,method,params,timeout=110):
  self.next_id+=1;key=self.next_id
  self.proc.stdin.write((json.dumps({"jsonrpc":"2.0","id":key,"method":method,"params":params})+"\n").encode());self.proc.stdin.flush()
  deadline=time.monotonic()+timeout
  while time.monotonic()<deadline:
   for result,_ in self.sel.select(max(0,min(0.5,deadline-time.monotonic()))):
    chunk=os.read(result.fd,65536)
    if not chunk: return {"error":"stdout closed","exit":self.proc.poll()}
    self.buf+=chunk
    while b"\n" in self.buf:
     line,self.buf=self.buf.split(b"\n",1)
     try:msg=json.loads(line)
     except (ValueError,UnicodeError):continue
     if msg.get("id")==key:return msg
     if msg.get("method")=="session/update":
      self.events.append({"method":"session/update","updateType":msg.get("params",{}).get("update",{}).get("sessionUpdate")})
     elif msg.get("id") is not None and msg.get("method")=="session/request_permission":
      # Reject by default: tests do not authorize destructive or unexpected tools
      self.proc.stdin.write((json.dumps({"jsonrpc":"2.0","id":msg["id"],"result":{"outcome":{"outcome":"cancelled"}}})+"\n").encode());self.proc.stdin.flush()
     elif msg.get("method"): self.events.append({"method":msg["method"]})
   if self.proc.poll() is not None:return {"error":"process ended","exit":self.proc.returncode}
  return {"error":"timeout"}
 def close(self):
  self.proc.terminate()
  try:self.proc.communicate(timeout=5)
  except subprocess.TimeoutExpired:self.proc.kill();self.proc.communicate()

def record(name,response):
 evidence["tests"][name]={"ok":"result" in response,"error":response.get("error"),"result_keys":sorted(response.get("result",{})) if isinstance(response.get("result"),dict) else []}
 return response.get("result") if isinstance(response.get("result"),dict) else None

first=ACP()
try:
 if not record("initialize",first.send("initialize",{"protocolVersion":1,"clientCapabilities":{},"clientInfo":{"name":"dsh-vscode-e2e","version":"0.1"}})):raise RuntimeError("ACP initialize failed")
 session=record("session/new",first.send("session/new",{"cwd":str(workspace.resolve()),"mcpServers":[]}))
 if not session or not session.get("sessionId"):raise RuntimeError("ACP session/new returned no sessionId")
 sid=session["sessionId"];evidence["session_id_present"]=True
 def prompt_payload(value):return {"sessionId":sid,"prompt":[{"type":"text","text":value}]}
 record("prompt1",first.send("session/prompt",prompt_payload("Reply with exactly one word: ALPHA"),timeout=170))
 record("prompt2",first.send("session/prompt",prompt_payload("Reply with exactly one word: BETA"),timeout=170))
 evidence["first_process_updates"]=first.events
finally:first.close()
second=ACP()
try:
 record("initialize_after_restart",second.send("initialize",{"protocolVersion":1,"clientCapabilities":{},"clientInfo":{"name":"dsh-vscode-e2e","version":"0.1"}}))
 listed=record("session/list",second.send("session/list",{"cwd":str(workspace.resolve())}))
 evidence["list_contains_original"]=sid in json.dumps(listed) if listed else False
 resumed=record("session/resume",second.send("session/resume",{"sessionId":sid,"cwd":str(workspace.resolve()),"mcpServers":[]}))
 evidence["resume_original_session"]=resumed is not None
 evidence["second_process_updates"]=second.events
finally:
 second.close()
 evidence["status"]="passed" if all(evidence["tests"].get(k,{}).get("ok") for k in ["initialize","session/new","prompt1","prompt2","initialize_after_restart","session/list","session/resume"]) and evidence.get("list_contains_original") else "partial_or_failed"
 (out/"evidence.json").write_text(json.dumps(evidence,indent=2))
 print(json.dumps({"status":evidence["status"],"tests":evidence["tests"],"list_contains_original":evidence.get("list_contains_original")}))
if evidence["status"]!="passed":raise SystemExit(1)
