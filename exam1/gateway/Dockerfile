# Contexte de build : exam1/ (accès à shared/)
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app

COPY gateway/package.json gateway/package-lock.json gateway/
RUN npm --prefix gateway ci --omit=dev --ignore-scripts --no-audit --no-fund

COPY shared shared
COPY gateway gateway

WORKDIR /app/gateway
USER node
EXPOSE 8000
CMD ["node", "server.js"]
