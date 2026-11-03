# Contexte de build : exam1/ (accès à shared/)
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app

COPY microservices/notifications/package.json microservices/notifications/package-lock.json microservices/notifications/
RUN npm --prefix microservices/notifications ci --omit=dev --ignore-scripts --no-audit --no-fund

COPY shared shared
COPY microservices/notifications microservices/notifications

WORKDIR /app/microservices/notifications
USER node
EXPOSE 4002
CMD ["node", "index.js"]
