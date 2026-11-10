#!/usr/bin/env bash
# Frontline fast lane supervisor (no AI): keeps scripts/live.py running, restarting it if it exits.
# Stop: kill the PID in /workspace/.fl-live/supervisor.pid (check `ps -fp` first). Log: /workspace/.fl-live/live.log
D=/workspace/.fl-live; mkdir -p "$D"; cd /workspace/frontline || exit 1
exec 9>"$D/supervisor.lock"; flock -n 9 || exit 0
echo $$ > "$D/supervisor.pid"
while true; do
  /workspace/.fl-venv/bin/python scripts/live.py >> "$D/live.log" 2>&1 &
  echo $! > "$D/poller.pid"; wait $!
  echo "$(date '+%F %T %Z') poller exited ($?), restarting in 15s" >> "$D/live.log"
  [ "$(wc -c < "$D/live.log")" -gt 500000 ] && tail -n 2000 "$D/live.log" > "$D/live.log.tmp" && mv "$D/live.log.tmp" "$D/live.log"
  sleep 15
done
