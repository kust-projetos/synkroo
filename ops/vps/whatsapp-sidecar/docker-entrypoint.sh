#!/bin/sh
set -eu

Xvfb :99 -screen 0 1280x800x24 -ac +extension GLX +render -noreset &

while [ ! -S /tmp/.X11-unix/X99 ]; do
  sleep 0.1
done

fluxbox &
x11vnc -display :99 -forever -shared -nopw -localhost -rfbport 5900 &
websockify --web /usr/share/novnc 6080 localhost:5900 &

exec node dist/index.js
