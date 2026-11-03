# Vérification Docker — Cloud Campus

Date : 3 novembre 2026 (Europe/Paris). Environnement : Windows 11, Docker Engine 29.8.0, Docker Compose v5.5.1.

## Résultat

La stack Docker complète **se construit et démarre** : 6 conteneurs (MongoDB, backend, API Gateway, notifications, stock-management, frontend). Toutes les vérifications ci-dessous ont été **réellement exécutées**. Leurs sorties brutes sont dans [docker-verification/](docker-verification/).

Les huit problèmes bloquants de l'audit Docker (B1 à B8) sont corrigés. Le code métier n'a pas été modifié, pas plus que les corrections de sécurité de Codex ou les preuves E27/E28.

| # | Problème bloquant | Correction |
|---|---|---|
| B1 | Aucun Dockerfile | 5 Dockerfiles créés |
| B2 | Le dossier de build de chaque service n'incluait pas `shared/` ni `backend/` | Tous les builds partent de `exam1/` (`context: .`), avec un `dockerfile:` propre à chaque service |
| B3 | API Gateway absente du Compose | Service `gateway` ajouté, port interne 8000 |
| B4 | Ports 3001/3002 ne correspondant pas au code | Notifications 4002, stock 4003 (réseau interne uniquement) |
| B5 | Variables d'environnement manquantes, URL en `localhost` | `env_file` + surcharges avec les noms de services Docker |
| B6 | Démarrage via `nodemon`, absent des dépendances | `CMD ["node", ...]` |
| B7 | `dotenv` et `mongoose` absents des dépendances de stock-management | Le Dockerfile installe les dépendances du backend et ajoute `dotenv` avec `--no-save`, sans toucher à `package.json` |
| B8 | Démarrage avant que MongoDB soit prêt | Healthcheck `mongosh ping`, `depends_on: condition: service_healthy`, `restart: unless-stopped` |

## Fichiers créés ou modifiés

Tous les chemins sont relatifs à `exam1/`.

| Fichier | Action |
|---|---|
| `docker-compose.yml` | Réécrit : `version` supprimé, 6 services, healthcheck, volume `mongo-data`, variables d'environnement, ports |
| `.dockerignore` | Créé : exclut `**/.env*`, `**/node_modules`, `**/.git`, `frontend/build`, `tests`, `*.log` |
| `backend/Dockerfile` | Créé : `node:22-alpine`, `npm ci --omit=dev`, copie `shared/`, utilisateur `node` |
| `gateway/Dockerfile` | Créé : même principe |
| `microservices/notifications/Dockerfile` | Créé : même principe |
| `microservices/stock-management/Dockerfile` | Créé : dépendances backend + service, `dotenv@16` ajouté avec `--no-save` |
| `frontend/Dockerfile` | Créé : build en deux étapes, `npm run build` puis `nginx:1.27-alpine` |
| `frontend/nginx.conf` | Créé : sert les fichiers statiques, renvoie `index.html` pour les routes React Router |

**Fichiers non modifiés** : code source, `package.json`, `package-lock.json`, `.env`, tests, `docs/` historiques.

## Architecture Docker

```
Navigateur ──► frontend (nginx)       hôte :3000  → 80
          └──► backend (Express)      hôte :5000  → 5000 ──► mongo:27017 (exam1Db)
                    │ NOTIFICATION_GATEWAY_URL=http://gateway:8000
                    ▼
               gateway                hôte :${GATEWAY_HOST_PORT:-8000} → 8000
                 ├─ /notify       ──► notifications:4002     (interne uniquement)
                 └─ /update-stock ──► stock-management:4003  ──► mongo:27017
mongo:7                               hôte :27018 → 27017, volume nommé exam1_mongo-data
```

- **Réseau** : réseau Compose par défaut `exam1_default`. Les services se joignent par leur nom (DNS Docker).
- **Exposition** : notifications et stock ne sont **pas publiés** sur l'hôte. Seuls le Gateway et les services internes peuvent les appeler, et ils exigent le jeton interservices.
- **Secrets** : ils sont injectés au démarrage. Backend, gateway et notifications les lisent dans leur `.env` via `env_file`. Stock-management reçoit seulement `NOTIFICATION_SERVICE_TOKEN`, lu dans `exam1/.env` par interpolation : il n'a pas accès à `JWT_SECRET`.
- **Variables surchargées dans le Compose** : `MONGO_URI=mongodb://mongo:27017/exam1Db`, `NOTIFI_SERVICE_URL=http://notifications:4002`, `STOCK_SERVICE_URL=http://stock-management:4003`, `NOTIFICATION_GATEWAY_URL=http://gateway:8000`, ainsi que les ports.

### Port hôte du Gateway

Le port interne du Gateway est **8000**. Le port hôte est configurable : `${GATEWAY_HOST_PORT:-8000}`, soit 8000 par défaut.

Pendant ce test, le port hôte 8000 était **déjà occupé par un processus Node local** (`node gateway/server.js`, PID 26340, lancé hors Docker). Pour ne pas l'interrompre, la stack a été démarrée avec `GATEWAY_HOST_PORT=8080`. Une fois ce processus arrêté, un simple `docker compose up -d` publie le Gateway sur 8000.

## Commandes exécutées et résultats réels

Toutes les commandes sont lancées depuis `exam1/`.

| Commande | Résultat |
|---|---|
| `docker compose config --quiet` | Code 0, plus d'avertissement sur `version` |
| `docker compose config --services` | 6 services : mongo, backend, gateway, notifications, stock-management, frontend |
| `docker compose build --progress=plain` | Code 0, 5 images construites, build React « Compiled successfully » ([build.log](docker-verification/build.log)) |
| `GATEWAY_HOST_PORT=8080 docker compose up -d` | Code 0, mongo `Healthy` avant le démarrage du backend et du stock ([up.log](docker-verification/up.log)) |
| `docker compose ps` | 6 conteneurs `Up`, mongo `(healthy)` ([ps.log](docker-verification/ps.log)) |
| `docker compose logs` | Aucun crash ni redémarrage ([logs.log](docker-verification/logs.log)) |

### État des conteneurs (`docker compose ps`)

```
NAME                       STATUS                        PORTS
exam1-backend-1            Up About a minute             0.0.0.0:5000->5000/tcp
exam1-frontend-1           Up About a minute             0.0.0.0:3000->80/tcp
exam1-gateway-1            Up About a minute             0.0.0.0:8080->8000/tcp
exam1-mongo-1              Up About a minute (healthy)   0.0.0.0:27018->27017/tcp
exam1-notifications-1      Up About a minute             4002/tcp
exam1-stock-management-1   Up About a minute             4003/tcp
```

### Logs de démarrage des services

```
notifications-1     | Service de notification démarré.
stock-management-1  | Service de gestion des stocks démarré.
backend-1           | Serveur en écoute sur le port 5000
backend-1           | MongoDB connecté
gateway-1           | Gateway opérationnel sur le port 8000
```

Stock-management attend la connexion à MongoDB (`openUri`) avant d'écouter : son message de démarrage prouve donc que la connexion a réussi.

### Tests fonctionnels

Les sorties complètes sont dans [tests.log](docker-verification/tests.log).

| Test | Attendu | Obtenu |
|---|---|---|
| `GET http://localhost:3000/` (frontend nginx) | 200 | **200** |
| `GET http://localhost:3000/admin` (route React Router) | 200 | **200** |
| `GET http://localhost:5000/api/products` | 200 JSON | **200** `[]` (nouvelle base vide) |
| Préflight CORS depuis l'origine `http://localhost:3000` | Origine autorisée | **204**, `Access-Control-Allow-Origin: http://localhost:3000` |
| CORS depuis l'origine `http://evil.example` | Pas d'en-tête CORS | **0 en-tête** |
| `POST :8080/notify` sans jeton (hôte → Gateway) | 401 | **401** « Authentification interservices requise. » |
| `POST :8080/update-stock` sans jeton | 401 | **401** |
| Ports 4002/4003 depuis l'hôte | Injoignables | **Injoignables** (HTTP 000) |
| backend → `gateway:8000/notify` avec jeton, contenu invalide | 400 renvoyé par notifications | **400** « Champs to, subject et text invalides. » |
| backend → `gateway:8000/update-stock` avec jeton, produit inexistant | Erreur métier renvoyée par stock | **400** « Réservation invalide. » |
| gateway → `notifications:4002` en direct sans jeton | 401 | **401** |
| gateway → `stock-management:4003` en direct sans jeton | 401 | **401** |
| Inscription d'un utilisateur synthétique (Origin frontend) | 201 | **201** |
| Connexion de cet utilisateur | 200 + JWT | **200**, JWT reçu (valeur masquée) |
| `GET /api/auth/me` avec ce JWT | 200 | **200** `{"role":"user",...}` |
| `GET /api/orders` sans JWT | 401 | **401** |
| `GET /api/orders` avec un JWT d'utilisateur ordinaire | 403 | **403** |
| Le bundle React appelle `localhost:5000/api` | Présent | **Présent** dans `main.*.js` |

Trois points à noter sur ces tests :

- **Requête de connexion corrigée.** Le premier essai envoyait `email` au lieu de `username` : c'était une erreur du script de test, pas de l'application. Il est conservé et annoté dans `tests.log`, et le second essai réussit.
- **Aucun email envoyé.** Le test des notifications utilise volontairement un contenu invalide : il prouve que la chaîne backend → Gateway → notifications fonctionne, jeton compris.
- **Aucune donnée existante touchée.** L'utilisateur synthétique est créé dans la **nouvelle** base Docker (`exam1_mongo-data`), pas dans `exam1-mongo`.

### Secrets

| Vérification | Résultat |
|---|---|
| Fichiers `.env*` présents dans les 5 images (`find /`) | **0** dans chaque image |
| Variables figées dans les images (`Config.Env`) | Seulement `PATH`, `NODE_VERSION`, `YARN_VERSION`, `NODE_ENV` (ou les variables nginx) |
| Noms de secrets dans `docker history` | **0** occurrence |
| Valeurs du jeton et de `JWT_SECRET` dans les logs générés | **0** occurrence |
| `node_modules` | Installés dans l'image (Linux), pas copiés depuis l'hôte Windows |
| Utilisateur d'exécution des conteneurs Node | `node` (pas root) |

Les secrets ne sont présents qu'en mémoire dans les conteneurs en cours d'exécution, injectés par Compose. Ils n'ont été ni affichés ni écrits dans ce rapport. Leur présence a été vérifiée par un simple `present`.

### Préservation des données

- Le conteneur `exam1-mongo` (lancé avec `docker run`, `mongo:7`, port hôte 27017) est **toujours `Up`**. Il n'appartient pas au projet Compose et ses volumes `/data/db` et `/data/configdb` sont **inchangés**.
- La stack Compose utilise sa **propre** instance `exam1-mongo-1`, sur le port hôte 27018, avec le volume nommé `exam1_mongo-data`. Il n'y a aucun conflit de nom ni de port.
- **Non exécuté :** `seeder.js` (non lancé, en attente de ton accord), `docker compose down -v`, toute suppression de volume ou de conteneur, tout push ou déploiement.

## Problèmes restants (non bloquants)

1. **Catalogue vide dans la stack Docker.** La base Docker est neuve. Pour la remplir, deux options :
   - lancer `docker compose exec backend node seeder.js`, **avec ton accord**, après analyse : ce script peut réinitialiser les produits, mais uniquement dans la base Docker ;
   - ou pointer `MONGO_URI` vers les données de `exam1-mongo`, par exemple `mongodb://host.docker.internal:27017/exam1Db`.
2. **Port hôte 8000** occupé par le Gateway local hors Docker (voir plus haut).
3. **URL du frontend.** Les URL `http://localhost:5000` sont écrites en dur. Ça fonctionne en local parce que c'est le navigateur qui appelle le backend publié. Pour un déploiement, il faudrait une variable `REACT_APP_API_URL` ou un reverse proxy nginx.
4. **Le frontend n'utilise pas le Gateway.** L'API Gateway sert aux échanges entre services : notifications et stock. Le service `auth-gateway` reste vide et n'est pas déployé.
5. **Dépendances npm dépréciées** pendant le build React (CRA 5) : avertissements uniquement. Les 79 signalements d'audit npm restent ceux décrits dans [AUDIT_COMPLEMENTAIRE_FINAL.md](AUDIT_COMPLEMENTAIRE_FINAL.md).
6. **Pas de healthcheck HTTP** sur les services Node (seul MongoDB en a un). `restart: unless-stopped` compense une sortie en erreur.
7. **Identifiants Gmail réels** injectés dans le conteneur notifications. Aucun email n'a été envoyé pendant ces tests.

## Commandes pour rejouer la vérification

```powershell
cd C:\Users\mrkar\Documents\Project\final-exam-cloud\exam1
docker compose config --quiet
docker compose build
docker compose up -d                       # ou : $env:GATEWAY_HOST_PORT='8080'; docker compose up -d
docker compose ps
docker compose logs --tail=30 backend gateway notifications stock-management
curl.exe -i http://localhost:3000/
curl.exe -i http://localhost:5000/api/products
curl.exe -i -X POST http://localhost:8000/notify          # 401 attendu (8080 si GATEWAY_HOST_PORT=8080)
docker compose down                        # arrêt SANS -v : le volume Mongo est conservé
```
