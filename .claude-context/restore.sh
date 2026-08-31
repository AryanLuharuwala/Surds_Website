#!/usr/bin/env bash
# Rebuild the archived Claude Code transcripts into this machine's session
# store so they can be resumed with `claude --resume <session-id>`.
#
#   ./.claude-context/restore.sh              restore every session
#   ./.claude-context/restore.sh <session-id> restore just one
#   ./.claude-context/restore.sh --list       list what is available
#   ./.claude-context/restore.sh --no-rewrite keep original absolute paths
set -euo pipefail
CTX="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$CTX/.." && pwd)"
exec python3 - "$CTX" "$REPO" "$@" <<'PYEOF'
import gzip, json, os, re, sys

ctx, repo, *args = sys.argv[1:]
rewrite = "--no-rewrite" not in args
args = [a for a in args if not a.startswith("--")]
want = set(args)
listing = "--list" in sys.argv

with open(os.path.join(ctx, "manifest.json"), encoding="utf-8") as fh:
    man = json.load(fh)

base = os.environ.get("CLAUDE_CONFIG_DIR") or os.path.join(os.path.expanduser("~"), ".claude")
projects = os.path.join(base, "projects")
roots = list(man.get("repo_roots") or [])
if man.get("origin_repo_root") and man["origin_repo_root"] not in roots:
    roots.append(man["origin_repo_root"])
# Longest first, so a nested path is not half-rewritten by its parent.
roots = sorted({r for r in roots if r and r != repo}, key=len, reverse=True)

def encode_path(p):
    return re.sub(r"[^A-Za-z0-9]", "-", p)

sessions = man.get("sessions", {})
if listing:
    for sid, s in sessions.items():
        print(f"{sid}  {len(s.get('chunks', []))} chunk(s)  {s.get('title') or '(untitled)'}")
    raise SystemExit(0)

if not sessions:
    print("restore: no sessions in manifest")
    raise SystemExit(0)

restored = []
seeds = {}
for sid, s in sessions.items():
    if want and sid not in want:
        continue
    local_cwd = os.path.normpath(os.path.join(repo, s.get("rel", ".")))
    target_dir = os.path.join(projects, encode_path(local_cwd))
    os.makedirs(target_dir, exist_ok=True)
    target = os.path.join(target_dir, sid + ".jsonl")
    if os.path.exists(target):
        print(f"restore: SKIP {sid} - already present at {target}")
        continue

    parts = []
    for chunk in s.get("chunks", []):
        path = os.path.join(ctx, chunk["file"])
        if not os.path.exists(path):
            print(f"restore: WARN missing chunk {chunk['file']}")
            continue
        with gzip.open(path, "rt", encoding="utf-8", errors="replace") as fh:
            parts.append(fh.read())
    text = "".join(parts)
    if rewrite:
        for old in roots:
            text = text.replace(old, repo)
    with open(target, "w", encoding="utf-8") as fh:
        fh.write(text)
    # Seed this machine's read offset to the end of what we just wrote, so the
    # commit hook does not re-archive someone else's transcript as new work.
    # Anything appended *after* this point is a genuine continuation and will
    # be archived normally.
    seeds[sid] = len(text.encode("utf-8"))
    restored.append((sid, target, s.get("title")))
    print(f"restore: {sid} -> {target}")

if seeds:
    import subprocess
    p = subprocess.run(["git", "-C", repo, "rev-parse", "--git-dir"],
                       stdout=subprocess.PIPE, text=True)
    git_dir = p.stdout.strip()
    if git_dir:
        if not os.path.isabs(git_dir):
            git_dir = os.path.join(repo, git_dir)
        lp = os.path.join(git_dir, "claude-context-local.json")
        state = {"offsets": {}}
        if os.path.exists(lp):
            try:
                with open(lp, encoding="utf-8") as fh:
                    state = json.load(fh)
                state.setdefault("offsets", {})
            except (OSError, ValueError):
                state = {"offsets": {}}
        state["offsets"].update(seeds)
        with open(lp, "w", encoding="utf-8") as fh:
            json.dump(state, fh, indent=2, sort_keys=True)

if restored:
    print("\nResume with:")
    for sid, _t, title in restored:
        print(f"  claude --resume {sid}     # {title or '(untitled)'}")
    print("\nRun claude from the matching directory, then use /resume if the id is not offered.")
PYEOF
