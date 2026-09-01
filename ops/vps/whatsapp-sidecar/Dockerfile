FROM mcr.microsoft.com/playwright:v1.62.1-noble AS builder

WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build

FROM mcr.microsoft.com/playwright:v1.62.1-noble AS runner

WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist

VOLUME ["/app/.whatsapp-session"]
EXPOSE 3030

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:3030/health || exit 1

CMD ["node", "dist/index.js"]
