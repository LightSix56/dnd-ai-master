@echo off
setlocal

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting Administrator privileges to configure Windows Firewall...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

echo Adding Windows Firewall rules for TCP ports 3000, 3001, and 3123...
netsh advfirewall firewall delete rule name="DnD 5e Server (Port 3000)" >nul 2>&1
netsh advfirewall firewall add rule name="DnD 5e Server (Port 3000)" dir=in action=allow protocol=TCP localport=3000 profile=any >nul

netsh advfirewall firewall delete rule name="DnD 5e Server (Port 3001)" >nul 2>&1
netsh advfirewall firewall add rule name="DnD 5e Server (Port 3001)" dir=in action=allow protocol=TCP localport=3001 profile=any >nul

netsh advfirewall firewall delete rule name="DnD 5e Server (Port 3123)" >nul 2>&1
netsh advfirewall firewall add rule name="DnD 5e Server (Port 3123)" dir=in action=allow protocol=TCP localport=3123 profile=any >nul

if exist "%~dp0scripts\firewall-helper.js" (
    node "%~dp0scripts\firewall-helper.js"
) else (
    echo Windows Firewall rules successfully added for ports 3000, 3001, and 3123.
)

echo.
pause
