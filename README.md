# Cloud Campus — application e-commerce

React et Node.js/Express : inscription, connexion JWT, catalogue, panier,
commandes et administration. État documenté le **3 novembre 2026**.
La production est déclarée fonctionnelle par son auteur. Les modifications
de cette session restent locales, sans push ni déploiement.

## Architecture réelle

```text
Navigateur → React (Hostinger) → backend Express (Render) → MongoDB Atlas
                                    ↓
                               Gateway (Render)
                                ↙           ↘
                      notifications       stock-management → Atlas
                          (Render)             (Render)
```

Le frontend appelle le backend directement avec le suffixe `/api`. La Gateway
sert aux notifications et aux réservations de stock interservices, protégées
par un jeton partagé. Le navigateur ne reçoit aucun secret serveur.

| Dossier | Rôle | Ports Docker Compose |
|---|---|---|
| `exam1/frontend/` | React, React Router, Tailwind ; Apache sur Hostinger, nginx en local | 3000 → 80 |
| `exam1/backend/` | API Express, JWT, produits, commandes, modèles Mongoose | 5000 |
| `exam1/gateway/` | Proxy HTTP vers notifications et stock | 8000 |
| `exam1/microservices/notifications/` | Nodemailer, transport Gmail | 4002 interne |
| `exam1/microservices/stock-management/` | Réservation du stock, modèles partagés du backend | 4003 interne |
| `exam1/shared/` | Authentification interservices, erreurs HTTP, observabilité | — |
| `exam1/microservices/auth-gateway/` | Emplacement sans implémentation active, non utilisé | — |
| `exam1/tests/`, `docs/` | Tests, audits et preuves | — |

URL publiques connues :

- Frontend : <https://projet-scolaire.online>
- Backend : <https://cloud-campus-backend-rd4h.onrender.com>
- Catalogue : <https://cloud-campus-backend-rd4h.onrender.com/api/products>

Le backend, la Gateway et les microservices sont hébergés sur Render, la base
sur Atlas. Les URL exactes des autres services restent dans la configuration
de l'hébergeur et ne sont pas inventées ici. Les ports ci-dessus concernent
Compose local, pas les adresses externes Render.

## Démarrage local Docker Compose

Prérequis : Docker Engine et Compose ; ports 3000, 5000, 27018 et 8000 libres.
Créer ces fichiers locaux ignorés par Git :

| Fichier | Variables nécessaires |
|---|---|
| `exam1/.env` | `NOTIFICATION_SERVICE_TOKEN` |
| `exam1/backend/.env` | `JWT_SECRET`, `NOTIFICATION_SERVICE_TOKEN`, `ORDER_NOTIFICATION_EMAIL` |
| `exam1/gateway/.env` | `NOTIFICATION_SERVICE_TOKEN` |
| `exam1/microservices/notifications/.env` | `NOTIFICATION_SERVICE_TOKEN`, `EMAIL_USER`, `EMAIL_APPLICATION_PASSWORD` |

Générer deux secrets distincts, par exemple en exécutant deux fois
`node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`.
Employer l'un pour JWT et l'autre pour les échanges interservices. Recopier le
même jeton interservices dans les quatre fichiers ; il doit contenir 43 à 128
caractères base64url. Utiliser un destinataire autorisé et un compte Gmail de
test avec mot de passe d'application. Voir [le modèle backend](exam1/backend/.env.example).

Compose fournit les ports, les URL internes et
`MONGO_URI=mongodb://mongo:27017/exam1Db`. La base locale est distincte d'Atlas.
Les variables de production existantes restent inchangées.

```powershell
cd exam1
docker compose config --quiet
docker compose build
docker compose up -d
docker compose ps
docker compose logs --tail=100 backend gateway notifications stock-management
docker compose logs --follow --tail=50 backend
docker compose down
```

Frontend : <http://localhost:3000> ; catalogue : <http://localhost:5000/api/products>.
Une base neuve peut répondre `[]`. MongoDB est publié sur 27018 et persiste dans
le volume `exam1_mongo-data`. `down` conserve les données ; ne pas utiliser
`down -v` pour un arrêt habituel. Le seeder, potentiellement destructif pour les
produits, n'est pas lancé. Si 8000 est occupé, définir
`$env:GATEWAY_HOST_PORT='8080'` avant le démarrage.

Le build Docker du frontend accepte l'argument public `REACT_APP_API_URL`,
par défaut `http://localhost:5000` pour Compose, sans copier de `.env` dans l'image :

```powershell
docker compose build --build-arg REACT_APP_API_URL=http://localhost:5000 frontend
```

## CI et tests — E24

[Le workflow GitHub Actions](.github/workflows/ci.yml) se lance sur push,
pull request ou lancement manuel : Node 22, installations `npm ci` à partir
des lockfiles, MongoDB 7 temporaire, contrôle des fichiers sensibles, tests
Node/React et compilation frontend. Aucun déploiement ni secret supplémentaire
n'est configuré ; le dépôt est accessible en lecture seule par le workflow.
La configuration Node/cache suit la [documentation officielle de setup-node](https://github.com/actions/setup-node/tree/v4).

Depuis la racine, installer puis vérifier (utiliser `npm` sous Linux et
`npm.cmd` sous PowerShell si `npm.ps1` est bloqué) :

```powershell
npm.cmd ci --prefix exam1
npm.cmd ci --prefix exam1/backend
npm.cmd ci --prefix exam1/gateway
npm.cmd ci --prefix exam1/microservices/notifications
npm.cmd ci --prefix exam1/microservices/stock-management
npm.cmd ci --prefix exam1/frontend
node scripts/check-secrets.cjs
node scripts/verify-ci.cjs
```

MongoDB doit écouter sur **127.0.0.1:27017** pour les tests. Le lanceur exécute
les suites `order-notification-email`, `notifications`, `final-business-current`,
`complementary`, `observability`, les deux régressions UI de `exam1/tests/` et les
tests habituels dans `frontend/src/`. Les tests métier créent puis suppriment
leurs propres bases locales à noms aléatoires contrôlés ; SMTP est simulé en
mémoire. Aucun appel à Atlas ni à l'API de production n'est nécessaire.
Les anciens scripts d'audit et anciennes suites ne sont pas tous destinés à la
CI actuelle. Les scripts `npm test` des services affichant « no test specified »
sont des emplacements historiques ; les vraies suites Node sont lancées explicitement.
Dans `notifications.test.cjs`, la sélection existante de `run-complementary.cjs`
est reprise : elle exclut trois TODO et un ancien scénario qui attendait un
stock inchangé après commande. Le comportement actuel de réservation est
vérifié par `final-business-current.test.cjs`, exécuté intégralement.

L'environnement des tests est isolé des secrets locaux. Les anciens tests UI
reçoivent l'URL localhost attendue. Le build de vérification est temporaire et
supprimé à la fin ; le dossier `frontend/build/` existant est préservé.
Build Hostinger manuel, sans transfert automatique :

```powershell
cd exam1/frontend
$env:REACT_APP_API_URL='https://cloud-campus-backend-rd4h.onrender.com'
npm.cmd test -- --watchAll=false --runInBand
npm.cmd run build
```

Cette URL publique, sans `/api`, est intégrée au build. Le `.env.production`
local est conservé mais retiré du suivi Git ; sur un clone neuf, définir
explicitement cette variable avant le build manuel. Voir
[les instructions Hostinger](exam1/frontend/DEPLOYMENT_HOSTINGER.md).
Aucun push n'a été réalisé pour exécuter Actions dans cette session.

## Journalisation et supervision — E25/E26

Les logs existants signalent les démarrages et certaines erreurs MongoDB,
SMTP, Gateway et reprise de commandes, avec des messages génériques.
Les nouveaux logs HTTP JSON stdout/stderr ajoutent `timestamp`, `level`,
`event`, `service`, `method`, `status` et `durationMs` ; les 4xx sont marqués
`warn`, les 5xx `error`. Aucun corps, URL, paramètre, en-tête ou identifiant
utilisateur n'est journalisé. Un échec du logger ne modifie pas la réponse.
Les sondes sont exclues de ces logs pour limiter le bruit.

| Service | Route ajoutée | Signification |
|---|---|---|
| Backend | `GET /health` | Processus HTTP vivant : 200 |
| Backend | `GET /ready` | Connexion Mongoose ouverte : 200 ; sinon 503 |
| Gateway | `GET /health` | Processus HTTP vivant : 200 |
| Notifications | `GET /health` | Processus HTTP vivant : 200 |
| Stock | `GET /health`, `GET /ready` | Processus vivant et état de connexion Mongoose |

Ces routes publiques, minimales et sans cache ne déclenchent ni requête MongoDB,
ni email, ni opération métier. Elles ne seront disponibles en production
qu'après un futur déploiement autorisé. Les routes métier et l'authentification
restent inchangées. Après démarrage local du code modifié :

```powershell
curl.exe -f http://localhost:5000/health
curl.exe -f http://localhost:5000/ready
curl.exe -f http://localhost:8000/health
docker compose exec -T notifications node -e "fetch('http://localhost:4002/health').then(async r=>{console.log(await r.text());process.exitCode=r.ok?0:1})"
docker compose exec -T stock-management node -e "fetch('http://localhost:4003/ready').then(async r=>{console.log(await r.text());process.exitCode=r.ok?0:1})"
```

Sur Render, consulter les logs de chaque service et examiner les statuts 5xx,
les niveaux `error` et les durées anormales. En cas de 503 sur `/ready`, vérifier
les événements de connexion et l'accessibilité d'Atlas avant de modifier la
configuration. Examiner les erreurs SMTP dans les notifications : une commande
peut être créée même si son email échoue.

Limites : aucune centralisation, rotation/rétention applicative, métrique,
alerte automatique, sonde externe périodique ou trace distribuée configurée ici.
La rétention Render dépend du compte et n'a pas été contrôlée. `/health` ne
teste pas les dépendances ; `/ready` vérifie un état de connexion sans ping actif.
La Gateway ne teste pas ses services aval ; la sonde notifications ne valide pas
la délivrabilité SMTP. Le healthcheck Compose existant concerne MongoDB ; aucun
paramètre de sonde Render n'est changé.

## Documentation et preuves — E29

- [Bilan E24/E25/E26/E29 et vérifications de cette session](docs/BILAN_E24_E29.md)
- [Changelog](CHANGELOG.md)
- [Vérification Docker antérieure](docs/VERIFICATION_DOCKER.md)
- [Audit complémentaire antérieur](docs/AUDIT_COMPLEMENTAIRE_FINAL.md)
- [Corrections E27/E28 antérieures](docs/CORRECTIONS_E27_E28_FINAL.md)

Les audits historiques conservent aussi leurs tentatives et échecs. L'audit
de dépendances documenté dans les instructions Hostinger reste une limite
connue ; aucune migration ni `npm audit fix --force` n'est appliqué. Le contrôle
de secrets couvre les fichiers actuels suivis et les ajouts de cette session,
pas tout l'historique Git ni les paramètres des hébergeurs.
