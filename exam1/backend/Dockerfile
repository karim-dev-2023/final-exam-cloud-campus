# Contexte de build : exam1/ (accès à shared/)
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app

COPY backend/package.json backend/package-lock.json backend/
RUN npm --prefix backend ci --omit=dev --ignore-scripts --no-audit --no-fund

COPY shared shared
COPY backend backend

WORKDIR /app/backend
USER node
EXPOSE 5000
CMD ["node", "server.js"]
