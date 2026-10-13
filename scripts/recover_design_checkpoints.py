"""Operator-selected, provenance-checked DSH staged-design checkpoint restoration.

Never automatically reuses an older design on a new issue or design level.
No credentials are written into checkpoint files.
"""
import json
import os
import pathlib
import re
import shutil
import urllib.request

ALLOWED = ("core", "tasks", "pages", "apis", "bindings", "channels", "prototype")
VALID_NAME = re.compile(r"stage-(?:core|tasks|pages|apis|bindings|channels|prototype|channels-index|channel-IPC-\d{2,3}|ipc-metrics)\.json")


def validate_origin(run, repository, issue_number):
    if run.get("repository", {}).get("full_name") != repository:
        raise ValueError("Checkpoint Run belongs to another repository")
    if run.get("path") != ".github/workflows/dsh-issue-agent.yml":
        raise ValueError("Checkpoint Run was not produced by trusted DSH workflow")
    if run.get("event") not in ("issues", "workflow_dispatch"):
        raise ValueError("Checkpoint Run has unsupported trigger")
    if run.get("status") != "completed":
        raise ValueError("Checkpoint Run is not complete")
    if run.get("head_branch") != "main":
        raise ValueError("Checkpoint Run must originate from main")
    match = re.fullmatch(r"DSH Issue #(\d+)", run.get("display_title", ""))
    if not match or int(match.group(1)) != issue_number:
        raise ValueError("Checkpoint Run belongs to another Issue")


def restore(folder, target, agent):
    folder, target = pathlib.Path(folder), pathlib.Path(target)
    if agent not in ("overview", "detailed"):
        raise ValueError("Only design agents may restore stage checkpoints")
    source_core = folder / "stage-core.json"
    if not source_core.is_file():
        raise ValueError("Checkpoint artifact has no completed core stage")
    core = json.loads(source_core.read_text())
    if core.get("level") != agent or core.get("schema_version") != 2:
        raise ValueError("Checkpoint level/version differs from selected design agent")
    target.mkdir(parents=True, exist_ok=True)
    restored = []
    for candidate in sorted(folder.glob("stage-*.json")):
        if not VALID_NAME.fullmatch(candidate.name):
            continue
        if candidate.is_symlink() or not candidate.is_file() or candidate.stat().st_size > 1000000:
            raise ValueError("Unsafe checkpoint file: " + candidate.name)
        payload = json.loads(candidate.read_text())
        if not isinstance(payload, dict):
            raise ValueError("Checkpoint must contain JSON object: " + candidate.name)
        shutil.copyfile(candidate, target / candidate.name)
        restored.append(candidate.name)
    print(json.dumps({"reused_checkpoints": restored}, ensure_ascii=False))
    return restored


def main():
    repo = os.environ["GITHUB_REPOSITORY"]
    run_id = os.environ["RESUME_RUN_ID"]
    if not run_id.isdecimal() or int(run_id) <= 0:
        raise ValueError("Invalid checkpoint Run ID")
    req = urllib.request.Request(
        f"https://api.github.com/repos/{repo}/actions/runs/{run_id}",
        headers={"Authorization": "Bearer " + os.environ["GH_TOKEN"],
                 "Accept": "application/vnd.github+json",
                 "User-Agent": "dsh-checkpoint-provenance"})
    with urllib.request.urlopen(req, timeout=20) as response:
        source = json.load(response)
    validate_origin(source, repo, int(os.environ["ISSUE_NUMBER"]))
    restore(os.environ["CHECKPOINT_DIR"], os.environ["TARGET_DIR"], os.environ["AGENT_ID"])


if __name__ == "__main__":
    main()
