# Contexte de build : exam1/ (accès à shared/ et aux modèles/services du backend)
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app

# Le service réutilise backend/models et backend/services : mongoose est résolu
# depuis backend/node_modules.
COPY backend/package.json backend/package-lock.json backend/
RUN npm --prefix backend ci --omit=dev --ignore-scripts --no-audit --no-fund

# dotenv est requis par index.js mais absent du package.json du service :
# installé ici sans modifier le manifeste.
COPY microservices/stock-management/package.json microservices/stock-management/package-lock.json microservices/stock-management/
RUN npm --prefix microservices/stock-management ci --omit=dev --ignore-scripts --no-audit --no-fund \
 && npm --prefix microservices/stock-management install --no-save --omit=dev --ignore-scripts --no-audit --no-fund dotenv@16

COPY shared shared
COPY backend backend
COPY microservices/stock-management microservices/stock-management

WORKDIR /app/microservices/stock-management
USER node
EXPOSE 4003
CMD ["node", "index.js"]
