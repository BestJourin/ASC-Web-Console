@echo off
setlocal
cd /d "%~dp0"
echo Starting the local RIGOL MHO 5054 scope bridge...
echo Scope IP: 192.168.110.10
echo Video: H.264 on port 9001 through the local bridge
echo Generator: DG4102 at 192.168.110.11 via SCPI port 5555
echo Keep this window open while using the live scope display.
python "%~dp0scope_bridge.py" --scope-ip 192.168.110.10 --scope-port 5025
echo.
echo The scope bridge has stopped.
pause
