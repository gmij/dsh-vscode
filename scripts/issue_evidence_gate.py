"""Idempotent evidence status update for DSH Issue workflow runs.

Never equates a green build, generated design or prototype to functional acceptance.
No automatic checkbox edits or issue closure.
"""
import json,os,re,urllib.request,urllib.error
BASE="https://api.github.com/repos/"+os.environ["GITHUB_REPOSITORY"]
TOKEN=os.environ["GH_TOKEN"]
RUN_ID=int(os.environ["SOURCE_RUN_ID"])
HEAD={"Authorization":"Bearer "+TOKEN,"Accept":"application/vnd.github+json","User-Agent":"dsh-evidence-gate","X-GitHub-Api-Version":"2022-11-28"}
def api(path):
 req=urllib.request.Request(BASE+path,headers=HEAD)
 with urllib.request.urlopen(req,timeout=30) as res:return json.load(res)
def post(path,payload):
 req=urllib.request.Request(BASE+path,headers={**HEAD,"Content-Type":"application/json"},method="POST",data=json.dumps(payload).encode())
 with urllib.request.urlopen(req,timeout=30) as res:return json.load(res)
def collect(run,jobs,artifacts):
 names={a["name"] for a in artifacts if not a.get("expired")}
 complete=run["status"]=="completed"
 results={j["name"]:j.get("conclusion") for j in jobs}
 return {
  "complete":complete,
  "workflow":run.get("conclusion") or "unknown",
  "agent":results.get("agent","missing"),
  "issue_comment":results.get("publish","missing"),
  "design_artifact":"design-deliverable" in names,
  "prototype_artifact":"prototype-deliverable" in names,
  "screenshots":"prototype-screenshots" in names,
 }
def outstanding(body):
 return [m.group(1).strip() for line in (body or '').splitlines() if (m:=re.match(r'^\\s*[-*]\\s*\\[\\s\\]\\s*(.+)
 marker=f"<!-- dsh-evidence-gate:run-{run_id} -->"
 def yn(v):return "有" if v else "无"
 return f"""{marker}
## DSH 执行证据与验收门禁

来源：[Actions Run {run_id}](https://github.com/{os.environ['GITHUB_REPOSITORY']}/actions/runs/{run_id}) · 目标 Issue #{issue}

| 检查 | 实际记录 |
|---|---|
| 工作流 | {record['workflow']} |
| Agent 作业 | {record['agent']} |
| 原有 Issue 结果回写 | {record['issue_comment']} |
| 设计 Artifact | {yn(record['design_artifact'])} |
| 原型 Artifact | {yn(record['prototype_artifact'])} |
| 截图 Artifact | {yn(record['screenshots'])} |

**门禁结论：仅确认以上工作流证据，不自动判定需求完成。**
概要/详细设计、模拟原型或 VSIX 构建成功不代表连续对话、工具调用、集成测试及业务验收通过。

**尚未通过的 Issue 验收项（读取 Issue 当前清单，不替代人工验收）**：\n{chr(10).join('- [ ] '+x for x in outstanding(body)) if outstanding(body) else '当前 Issue 未定义勾选式验收清单；必须按需求逐项补充实际验收证据。'}\n\n真实运行证据、测试覆盖、依赖、人工确认和剩余阻断必须逐项记录后才能关闭。此自动回写不改勾选、不关闭 Issue、不覆盖人工审核。"""
def main():
 repo=os.environ["GITHUB_REPOSITORY"]
 run=api(f"/actions/runs/{RUN_ID}")
 if run.get("repository",{}).get("full_name")!=repo or run.get("path")!=".github/workflows/dsh-issue-agent.yml" or run.get("status")!="completed" or run.get("event") not in ("issues","workflow_dispatch"):
  raise ValueError("Untrusted or unfinished source run")
 issue=run.get("event")=="issues" and (run.get("display_title") or "")
 # For dispatch and labeled runs read the trusted route job's uploaded metadata.
 artifact_list=api(f"/actions/runs/{RUN_ID}/artifacts?per_page=100")["artifacts"]
 import re
 match=re.search(r"DSH Issue #(\d+)",run.get("display_title",""))
 if not match:raise ValueError("Issue number cannot be validated from run title")
 number=int(match.group(1))
 if number<=0:raise ValueError("Invalid issue number")
 source_issue=api(f"/issues/{number}")
 if source_issue.get("pull_request"):raise ValueError("Source is a PR")
 jobs=api(f"/actions/runs/{RUN_ID}/jobs?per_page=100")["jobs"]
 if not any(j["name"]=="route" and j.get("conclusion")=="success" for j in jobs):raise ValueError("Source route did not succeed")
 record=collect(run,jobs,artifact_list)
 body=comment(number,RUN_ID,record,source_issue.get('body') or '')
 marker=f"<!-- dsh-evidence-gate:run-{RUN_ID} -->"
 for page in range(1,11):
  comments=api(f"/issues/{number}/comments?per_page=100&page={page}")
  if any(marker in (c.get("body") or "") for c in comments):
   print("Already recorded evidence for run",RUN_ID);return
  if len(comments)<100:break
 res=post(f"/issues/{number}/comments",{"body":body})
 print("Evidence recorded:",res.get("html_url"))
if __name__=="__main__":main()
,line))][:30]
def comment(issue,run_id,record,body=''):
 marker=f"<!-- dsh-evidence-gate:run-{run_id} -->"
 def yn(v):return "有" if v else "无"
 return f"""{marker}
## DSH 执行证据与验收门禁

来源：[Actions Run {run_id}](https://github.com/{os.environ['GITHUB_REPOSITORY']}/actions/runs/{run_id}) · 目标 Issue #{issue}

| 检查 | 实际记录 |
|---|---|
| 工作流 | {record['workflow']} |
| Agent 作业 | {record['agent']} |
| 原有 Issue 结果回写 | {record['issue_comment']} |
| 设计 Artifact | {yn(record['design_artifact'])} |
| 原型 Artifact | {yn(record['prototype_artifact'])} |
| 截图 Artifact | {yn(record['screenshots'])} |

**门禁结论：仅确认以上工作流证据，不自动判定需求完成。**
概要/详细设计、模拟原型或 VSIX 构建成功不代表连续对话、工具调用、集成测试及业务验收通过。

**未关闭验收项**：以当前 Issue 中尚未勾选的验收项为准；真实运行证据、测试覆盖、依赖、人工确认和剩余阻断必须逐项记录后才能关闭。此自动回写不改勾选、不关闭 Issue、不覆盖人工审核。"""
def main():
 repo=os.environ["GITHUB_REPOSITORY"]
 run=api(f"/actions/runs/{RUN_ID}")
 if run.get("repository",{}).get("full_name")!=repo or run.get("path")!=".github/workflows/dsh-issue-agent.yml" or run.get("status")!="completed" or run.get("event") not in ("issues","workflow_dispatch"):
  raise ValueError("Untrusted or unfinished source run")
 issue=run.get("event")=="issues" and (run.get("display_title") or "")
 # For dispatch and labeled runs read the trusted route job's uploaded metadata.
 artifact_list=api(f"/actions/runs/{RUN_ID}/artifacts?per_page=100")["artifacts"]
 import re
 match=re.search(r"DSH Issue #(\d+)",run.get("display_title",""))
 if not match:raise ValueError("Issue number cannot be validated from run title")
 number=int(match.group(1))
 if number<=0:raise ValueError("Invalid issue number")
 source_issue=api(f"/issues/{number}")
 if source_issue.get("pull_request"):raise ValueError("Source is a PR")
 jobs=api(f"/actions/runs/{RUN_ID}/jobs?per_page=100")["jobs"]
 if not any(j["name"]=="route" and j.get("conclusion")=="success" for j in jobs):raise ValueError("Source route did not succeed")
 record=collect(run,jobs,artifact_list)
 body=comment(number,RUN_ID,record)
 marker=f"<!-- dsh-evidence-gate:run-{RUN_ID} -->"
 for page in range(1,11):
  comments=api(f"/issues/{number}/comments?per_page=100&page={page}")
  if any(marker in (c.get("body") or "") for c in comments):
   print("Already recorded evidence for run",RUN_ID);return
  if len(comments)<100:break
 res=post(f"/issues/{number}/comments",{"body":body})
 print("Evidence recorded:",res.get("html_url"))
if __name__=="__main__":main()
