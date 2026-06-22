@echo off
setlocal
set "ROOT=%~dp0"
set "WT_DIR=%ROOT%."

if not exist "%ROOT%planner.bat" (
  >"%ROOT%planner.bat" (
    echo set PI_PEER_ID=planner
    echo pi
  )
)

if not exist "%ROOT%worker1.bat" (
  >"%ROOT%worker1.bat" (
    echo set PI_PEER_ID=worker1
    echo pi
  )
)

wt new-tab -d "%WT_DIR%" --title "planner" cmd /k ""%ROOT%planner.bat"" ^
  ; new-tab -d "%WT_DIR%" --title "coder" cmd /k ""%ROOT%worker1.bat""
