FROM node:24-slim AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
COPY scripts/gen-splash-i18n.mjs /src/scripts/
RUN npm run build

FROM eclipse-temurin:17-jre
RUN useradd -r -m -d /data nexus
WORKDIR /data
COPY Mage.Proxy/target/mage-proxy-1.4.61.jar /app/mage-proxy.jar
COPY --from=web /src/web/dist /app/web
COPY docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh && chown nexus /data
USER nexus
ENV XMAGE_HOST=beta.xmage.today XMAGE_PORT=17171 \
    WS_PORT=8787 HTTP_PORT=8788 BIND=0.0.0.0 \
    ALLOWED_ORIGINS="" ADMIN_TOKEN="" JAVA_OPTS="-XX:MaxRAMPercentage=60 -XX:+UseSerialGC"
VOLUME /data
EXPOSE 8787 8788
ENTRYPOINT ["/app/entrypoint.sh"]
