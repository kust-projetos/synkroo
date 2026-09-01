FROM mcr.microsoft.com/playwright:v1.62.1-noble AS builder

WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build

FROM mcr.microsoft.com/playwright:v1.62.1-noble AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV DISPLAY=:99
USER root
RUN apt-get update && apt-get install -y --no-install-recommends x11vnc novnc websockify fluxbox && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN sed -i 's/\r$//' ./docker-entrypoint.sh && chmod +x ./docker-entrypoint.sh

VOLUME ["/app/.whatsapp-session"]
EXPOSE 3030
EXPOSE 6080

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:3030/health || exit 1

CMD ["./docker-entrypoint.sh"]
