#!/bin/sh
exec java $JAVA_OPTS \
  --add-opens=java.base/java.io=ALL-UNNAMED \
  --add-opens=java.base/java.util=ALL-UNNAMED \
  --add-opens=java.base/java.lang=ALL-UNNAMED \
  --add-opens=java.base/java.lang.reflect=ALL-UNNAMED \
  --add-opens=java.base/java.text=ALL-UNNAMED \
  -cp /app/mage-proxy.jar org.mage.proxy.Main \
  --host "$XMAGE_HOST" --port "$XMAGE_PORT" \
  --wsPort "$WS_PORT" --httpPort "$HTTP_PORT" \
  --bind "$BIND" --webDir /app/web \
  --allowedOrigins "$ALLOWED_ORIGINS" \
  --adminToken "$ADMIN_TOKEN"
