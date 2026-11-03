# Contexte de build : exam1/
# Étape 1 : build React
FROM node:22-alpine AS build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY frontend ./
ARG REACT_APP_API_URL=http://localhost:5000
ENV REACT_APP_API_URL=${REACT_APP_API_URL}
RUN npm run build

# Étape 2 : service statique
FROM nginx:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/build /usr/share/nginx/html
EXPOSE 80
