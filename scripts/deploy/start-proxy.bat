@echo off
REM XMage Nexus - start the multi-tenant proxy that serves the web client and
REM bridges players to the target XMage server. See docs\deploy-playit.md.
REM
REM Required:
REM   ALLOWED_ORIGINS  exact public origin of the web page, e.g. http://abc.playit.gg:12345
REM Optional (defaults shown):
REM   JAR=mage-proxy-1.4.61.jar  WEB_DIR=web-dist
REM   XMAGE_HOST=beta.xmage.today  XMAGE_PORT=17171
REM   WS_PORT=8787                 HTTP_PORT=8788
REM   BIND=127.0.0.1               (playit agent runs on this same machine)
setlocal

if "%JAR%"=="" set JAR=mage-proxy-1.4.61.jar
if "%WEB_DIR%"=="" set WEB_DIR=web-dist
if "%XMAGE_HOST%"=="" set XMAGE_HOST=beta.xmage.today
if "%XMAGE_PORT%"=="" set XMAGE_PORT=17171
if "%WS_PORT%"=="" set WS_PORT=8787
if "%HTTP_PORT%"=="" set HTTP_PORT=8788
if "%BIND%"=="" set BIND=127.0.0.1

if not exist "%JAR%" (
  echo ERROR: proxy jar not found: %JAR%
  exit /b 1
)
if not exist "%WEB_DIR%" (
  echo ERROR: web dir not found: %WEB_DIR% ^(copy the contents of web\dist here^)
  exit /b 1
)
if "%ALLOWED_ORIGINS%"=="" (
  echo WARNING: ALLOWED_ORIGINS is empty - the proxy only accepts localhost origins.
  echo          Set it to your public web origin, e.g. set ALLOWED_ORIGINS=http://abc.playit.gg:12345
)

java ^
  --add-opens=java.base/java.io=ALL-UNNAMED ^
  --add-opens=java.base/java.util=ALL-UNNAMED ^
  --add-opens=java.base/java.lang=ALL-UNNAMED ^
  --add-opens=java.base/java.lang.reflect=ALL-UNNAMED ^
  --add-opens=java.base/java.text=ALL-UNNAMED ^
  -cp "%JAR%" org.mage.proxy.Main ^
  --host "%XMAGE_HOST%" --port "%XMAGE_PORT%" ^
  --wsPort "%WS_PORT%" --httpPort "%HTTP_PORT%" ^
  --bind "%BIND%" --webDir "%WEB_DIR%" ^
  --allowedOrigins "%ALLOWED_ORIGINS%"

endlocal
