# Déploiement du frontend sur Hostinger

Préparation vérifiée le 3 novembre 2026. Aucun déploiement Hostinger effectué.

## Configuration

Le frontend utilise Create React App. `src/services/apiConfig.js` centralise
`REACT_APP_API_URL`, qui désigne l'origine du backend **sans `/api`**.
Le suffixe `/api` est ajouté une seule fois et les barres finales sont retirées.

Le fichier local `.env.production`, ignoré par Git, contient uniquement cette
configuration publique (sa copie locale est conservée après retrait du suivi) :

```dotenv
REACT_APP_API_URL=https://cloud-campus-backend-rd4h.onrender.com
```

Cette valeur est intégrée aux fichiers JavaScript pendant le build. Après une
modification, reconstruire puis transférer le nouveau build. Vérifier qu'aucune
variable du terminal ni aucun `.env.local` ou `.env.production.local` ne remplace
cette valeur. Le `.env` à la racine de `exam1` ne doit pas être copié dans le
frontend. Ne jamais préfixer un secret serveur avec `REACT_APP_`.

Sur un clone neuf, définir explicitement `REACT_APP_API_URL` dans le terminal
avant `npm run build`, ou recréer ce fichier local. La CI fournit directement
l'URL publique ; elle ne dépend pas du fichier ignoré. Le build Docker local
utilise un argument public du même nom, avec `http://localhost:5000` par défaut.

Pour le développement local, copier `.env.example` vers `.env.local` si besoin.
Sans configuration, le mode développement conserve `http://localhost:5000`.
Le mode production refuse une URL absente au chargement de la configuration.
La Gateway ne reçoit aucun appel depuis le frontend actuel.

## Inventaire des requêtes

Tous les chemins ci-dessous sont ajoutés à l'URL centrale suivie de `/api`.

| Appel | Utilisation | Authentification conservée |
| --- | --- | --- |
| `GET /products` | Catalogue et administration | JWT pour le service admin |
| `POST /auth/login` | Connexion | Stockage du JWT, du rôle et du nom après succès |
| `POST /auth/register` | Inscription | Aucun rôle privilégié envoyé |
| `GET /auth/me` | Vérification du rôle par `AdminRoute` | JWT ; rôle confirmé par le serveur |
| `POST /orders` | Commande depuis le panier | JWT et `Idempotency-Key` |
| `GET /orders` | Administration des commandes | JWT |
| `PUT /orders/:id/status` | Changement de statut | JWT |
| `PUT /orders/:id/validate` | Service de validation existant | JWT |
| `DELETE /orders/:id` | Suppression administrative | JWT |
| `PUT /products/:id/stock` | Modification du stock | JWT |

Les cinq fichiers qui contenaient des URL API locales étaient `services/api.js`,
`services/adminApi.js`, `components/AdminRoute.js`, `pages/Login.js` et
`pages/Register.js`. Ils importent désormais la même configuration.

## Vérifications réellement exécutées

Depuis `exam1/frontend`, sous PowerShell :

```powershell
$env:CI = 'true'
$env:REACT_APP_API_URL = 'https://cloud-campus-backend-rd4h.onrender.com'
npm.cmd test -- --watchAll=false --runInBand --silent
```

Build exécuté dans un terminal séparé, sans définir `REACT_APP_API_URL` dans le
terminal, pour utiliser `.env.production` :

```powershell
npm.cmd run build
npm.cmd audit --omit=dev --json
```

- Tests finaux : **25 tests réussis dans 4 suites**, avec Axios simulé. Couverture
  des URL, du JWT, des rôles, de l'inscription, du panier et de la commande.
  Les tests de commande vérifient le vidage du panier après succès et sa
  conservation avec réutilisation de la clé d'idempotence après échec réseau.
- Build : **Compiled successfully**, hébergement à la racine `/`.
- Build contrôlé : URL Render présente, aucun endpoint de service local dans
  le JavaScript exécutable, aucun fichier `.env` publié, aucune configuration
  serveur privée et aucune des 10 valeurs sensibles contrôlées dans les `.env`
  locaux du backend, de la Gateway, des notifications et de `exam1`.
  Les fichiers déclarés dans le manifeste existent et le `.htaccess` est copié.
- Les sources et leurs source maps conservent le repli de développement local.
  Axios contient aussi une origine technique `http://localhost` sans port ; ce
  n'est pas l'adresse utilisée pour les requêtes API configurées.
- Apache 2.4 local dans un conteneur temporaire, build monté en lecture seule,
  avec `mod_rewrite` et `AllowOverride All` : `/`, `/login`, `/register`, `/cart`,
  `/order`, `/admin` et `/shippig_payment` renvoient tous **200** et le contenu
  exact de `index.html`. Les assets JS et CSS gardent leur contenu exact.
  Ce test HTTP ne remplace pas un test navigateur après déploiement.
- Précontrôle `OPTIONS /api/orders` sur Render depuis l'origine
  `https://projet-scolaire.online` : **204**, origine autorisée, ainsi que les
  en-têtes `authorization`, `content-type` et `idempotency-key`.
- `git diff --check` : réussi. Backend, Gateway, microservices et preuves
  historiques inchangés.

**Contrôle de dépendances non validé :** l'audit npm signale **75 vulnérabilités**
(13 élevées, 51 modérées, 11 faibles ; aucune critique). Il inclut des dépendances
d'outillage car `react-scripts` est déclaré dans `dependencies`, ainsi que
`react-router-dom` comme dépendance directe signalée. Certaines corrections
proposées par npm impliquent des changements majeurs, dont `react-scripts@0.0.0`.
Aucun `npm audit fix --force` ni migration d'outillage n'a été appliqué.
Conformément à la condition de publication demandée, **aucun commit ni push**
n'est effectué tant que le contrôle de sécurité ne réussit pas.

## Fichiers à transférer

Dossier généré : **`exam1/frontend/build/`**.

Dans le gestionnaire de fichiers Hostinger du domaine
`https://projet-scolaire.online`, transférer **le contenu** de ce dossier dans
`public_html/` : `index.html`, `static/`, `.htaccess`, le manifeste et les autres
assets. Ne pas placer le dossier `build` lui-même sous `public_html`.
Activer l'affichage des fichiers cachés pour inclure `.htaccess`.
Si un `.htaccess` existe déjà sur Hostinger, conserver ses règles utiles et
intégrer le repli React. Les fichiers et dossiers existants sont servis tels
quels ; les autres chemins reviennent vers `index.html`.

Transférer uniquement le build, jamais le dépôt, `node_modules` ou les `.env`.
Le build contient déjà l'URL publique de production.

Après transfert, vérifier dans un navigateur le catalogue, la connexion,
l'inscription, les rôles, le panier, les commandes et le rafraîchissement des
routes. Ces vérifications sur Hostinger restent à effectuer.

## Références

- [Variables publiques et fichiers d'environnement Create React App](https://create-react-app.dev/docs/adding-custom-environment-variables/)
- [Déploiement et repli des routes Create React App](https://create-react-app.dev/docs/deployment/)
- [Fichier .htaccess dans public_html chez Hostinger](https://www.hostinger.com/support/1583307-how-to-create-an-htaccess-file-at-hostinger/)
