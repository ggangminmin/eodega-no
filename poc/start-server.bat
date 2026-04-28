@echo off
chcp 65001 >nul
title 어데가노 Dev Server
cd /d "%~dp0"

echo ================================================
echo   어데가노 개발 서버 시작 스크립트
echo ================================================
echo.
echo [1/4] 현재 폴더:
echo   %CD%
echo.

echo [2/4] Node.js 설치 확인...
where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo ERROR: Node.js가 PATH에서 발견되지 않습니다.
  echo.
  echo 해결 방법:
  echo   1^) https://nodejs.org 에서 Node.js LTS 설치
  echo   2^) 설치 후 이 창을 닫고 이 .bat을 다시 실행
  echo.
  echo ------------------------------------------------
  echo [이 창은 자동으로 닫히지 않습니다. 확인 후 닫으세요]
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node --version') do echo   Node: %%v

echo.
echo [3/4] 포트 3000 점유 프로세스 정리...
set KILLED=0
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
  taskkill /F /PID %%a >nul 2>&1
  if not errorlevel 1 (
    echo   PID %%a 종료 완료
    set KILLED=1
  )
)
if %KILLED%==0 echo   (점유 프로세스 없음^)

echo.
echo [4/4] 서버 실행...
echo ------------------------------------------------
echo   URL: http://localhost:3000
echo   종료: 이 창 닫기 또는 Ctrl+C
echo ------------------------------------------------
echo.

node dev-server.js
set EXITCODE=%ERRORLEVEL%

echo.
echo ================================================
echo 서버가 종료되었습니다. (exit code: %EXITCODE%)
echo ================================================
echo.
echo [이 창은 자동으로 닫히지 않습니다. 확인 후 닫으세요]
pause
