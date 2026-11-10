#!/usr/bin/env bash
# Called from ~/.bashrc (same pattern as kraken-paper's ensure_watcher.sh): start the supervisor if it isn't running.
D=/workspace/.fl-live; P=$(cat "$D/supervisor.pid" 2>/dev/null)
if [ -n "$P" ] && ps -p "$P" -o args= 2>/dev/null | grep -q "frontline/scripts/live.sh"; then exit 0; fi
setsid nohup /workspace/frontline/scripts/live.sh >/dev/null 2>&1 < /dev/null &
