---
name: rtx-render
description: Render a Blender scene (.blend, or a .py that builds one) on the team's remote RTX 4090 (rtxserver) as if it rendered locally - packs it, uploads only a diff, renders, syncs frames or just the mp4 back, with monitor/status/cancel/clean. Works on campus (rtxserver) and from anywhere (rtx-remote, Cloudflare tunnel). Use when someone says render this on the server / rtx / 4090, a local Blender render is too slow, or asks to monitor/cancel a remote render.
---

# rtx-render — Blender renders on the team's RTX 4090

`rtx-render` (the script next to this file; stdlib Python, no deps) sends a Blender scene to the shared
render box and brings the result back. Link it onto your PATH once:

```bash
ln -sf "$PWD/.claude/skills/rtx-render/rtx-render" ~/.local/bin/rtx-render
```

```bash
rtx-render scene.blend                  # pack -> upload diff -> render -> frames in ./out/scene/
rtx-render build.py [--base b.blend]    # runs build.py LOCALLY in headless Blender, renders the result remotely
rtx-render scene.blend --video-only     # far away / slow link: the server encodes the mp4, only that comes back
rtx-render scene.blend -s 1 -e 120 -o out/x --mp4 --detach

rtx-render monitor [JOB] [--mp4]        # progress, f/min, ETA, GPU; keeps syncing; Ctrl-C only detaches
rtx-render status                       # all jobs
rtx-render cancel [JOB]                 # kill its workers (by recorded pid)
rtx-render clean [JOB]                  # delete a finished job on the server (local frames kept)
rtx-render clean --cache                # drop the cached scene uploads on the server
```
JOB defaults to the newest. The host is picked automatically: `rtxserver` (direct, campus network) if it
answers, else `rtx-remote` (Cloudflare tunnel, anywhere). `RTX_HOST=...` forces one.

## Access (one-time, per person)

The box is a shared university machine; you need the owner to let you in. Never copy someone else's
private key.

1. Make your own key: `ssh-keygen -t ed25519 -f ~/.ssh/rtx_id` and send **only** `~/.ssh/rtx_id.pub` to
   the box owner (Aryan), who adds it to the account's `~/.ssh/authorized_keys`.
2. Install `cloudflared` (https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/).
3. Add to `~/.ssh/config`:
   ```
   Host rtx-remote
       HostName ssh.gpunet.in
       User nishkal
       IdentityFile ~/.ssh/rtx_id
       ProxyCommand cloudflared access ssh --hostname %h
       ServerAliveInterval 30
   ```
   (On the campus network you can also add `Host rtxserver` / `HostName 10.171.18.104` with the same user
   and key; it is faster.)
4. Check: `ssh rtx-remote 'echo ok; nvidia-smi --query-gpu=name,memory.used --format=csv,noheader'`.
5. You also need Blender 4.5 locally (`blender` on PATH, or `BLENDER=/path/to/blender`) - it packs the
   scene before upload - plus `rsync` and `ffmpeg` (only for `--mp4`).

## Be a good neighbour on the GPU

The 4090 is shared with other people's jobs. **Default is one Blender process; keep ~20 GB of the GPU
free.** Check `ssh rtx-remote nvidia-smi` before passing `-w` above 1, and never above ~4 when someone
else is on it. The shared home disk is often nearly full: clean up finished jobs (`rtx-render clean`).

## What it does

1. **Pack locally**: `blender -b` opens the .blend (or runs the .py, optionally on `--base`), then
   `pack_all()` and saves an uncompressed copy. Render output is forced to `//frames/f_####` (movie formats
   become PNG). A .py keeps all its local paths working; only the render goes remote. A .py should
   *build* the scene, not render it itself.
2. **Upload as a diff**: the server keeps the last upload of every file in
   `~/tmp/rtx-render/cache/<name>-<hash>.blend`, where the hash is of the file's **path inside the git
   repo** - so everyone rendering e.g. `source/surds-city.blend` shares one cache and each upload is a
   diff against whoever sent it last (outside a repo: the absolute path). `rsync -az --no-whole-file`
   sends only the changed blocks; the job dir gets a hard link to the result, and rsync replaces the cache
   by rename, so older jobs keep their version. The pack is saved **uncompressed** on purpose: a
   compressed .blend changes every byte after the first edit and defeats the diff. Blender rewrites
   internal pointers on each save, so a re-pack is never byte-identical, but the bulk (packed images,
   meshes) matches. Refuses to start with < ~2 GB free on the server.
3. **Render** with `-w` Blender processes (default 1) over the frame range, each with
   `use_overwrite=False` + `use_placeholder=True`: a worker claims the next free frame with an empty
   file, so several workers balance themselves and rerunning in the same job dir resumes. `device.py`
   turns on OptiX/CUDA for Cycles (Cycles reads its device from user prefs, which a background run lacks).
   With `--video-only`, `run.sh` encodes `video.mp4` (libx264) on the server after the last frame.
4. **Monitor/sync**: one ssh poll every 8 s through a ControlMaster connection. Normally rsync copies
   frames untouched for 3 s (never a half-written PNG) into the out folder, and `--mp4` encodes
   `<out>.mp4` locally (libx264, else h264_nvenc). With `--video-only` nothing but the mp4 comes back.

## Running it from Claude Code

- ssh/rsync to the box need `dangerouslyDisableSandbox: true` (the sandbox blocks the campus subnet and
  breaks DNS for cloudflared).
- For a long render, run the monitor as a background Bash task and filter its output:
  `rtx-render monitor JOB --mp4 2>&1 | tr '\r' '\n' | grep -E "finished|encoded|missing|Error|gone|failed"`.
- "Not freed memory blocks" and Freestyle "strokes set empty" log errors are harmless.
- The detached launch over ssh sometimes never returns; the tool fires it with a 20 s timeout and then
  checks the `pids` file.
- Freestyle builds its view map from *every* visible mesh, not just its lineset's collections: dense
  wireframe/tube geometry in view can stall a frame for minutes. Put such objects on a separate view
  layer with Freestyle off (holdout the rest) and alpha-over it in the compositor (the SURDS city does
  this for its trees and blueprint ghosts).

## Numbers (2026-10-27)

- Upload ~8 MB/s from the campus laptop. SURDS city: 136 MB packed; first upload sent 76 MB,
  re-upload after moving one building sent **1.9 MB** (122 MB matched).
- SURDS city, EEVEE Next 1080p / 64 samples + Freestyle: ~6.4 s/frame per process (mostly
  single-threaded CPU Freestyle). 1 worker, 320 frames: ~25 min. Workers vs throughput: 3 -> ~16 f/min,
  8 -> ~20, 12 -> ~25 (15 GB VRAM). ~1.2-1.9 GB VRAM per EEVEE worker.

## Files

- Local state: `~/.cache/rtx-render/jobs.json` (job -> remote dir, out dir, frame count). Jobs are per
  person; `status` shows only yours.
- Remote job dir `~/tmp/rtx-render/<name>-<MMDD-HHMMSS>/`: `scene.blend`, `run.sh`, `device.py`, `pids`,
  `started`, `done`, `frames/`, `logs/`, `video.mp4` (with `--video-only`).
