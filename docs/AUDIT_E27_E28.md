# Audit E27 / E28 — application e-commerce MERN

Date : 3 novembre 2026, Europe/Paris. État : **avant correction**.

## Périmètre et méthode

Lecture du code applicatif de `exam1/backend`, `frontend`, `gateway`, des trois microservices, des sept manifestes/verrous npm et du Compose. Les dépendances tierces ont été évaluées par `npm audit`, sans installation ni `audit fix`. Les fichiers `.env` n'ont pas été affichés ; seuls des contrôles de présence ont été effectués. Aucun secret n'est reproduit dans ce rapport.

**Aucune correction applicative, modification de configuration, écriture dans MongoDB, création de compte, commande réelle, suppression, notification réelle, relance de service, opération de déploiement ou git push n'a été effectuée.** Seuls ce rapport et ses preuves dans `docs/audit-e27-e28/` ont été créés. Le build est sorti dans le répertoire temporaire Windows. Le fichier factice utilisé pour tester Nodemailer a été supprimé.

Trois niveaux de preuve sont distingués : **HTTP réel** pour les lectures/requêtes rejetées sans écriture ; **test isolé** pour les contrôleurs avec stockage/réseau simulés et les vrais validateurs Mongoose ; **lecture statique** pour les flux directement visibles. Une simulation ne démontre pas une persistance réelle ni une exploitation de bout en bout.

Les captures déjà présentes dans `docs/audit-initial/screenshots/` sont antérieures à cet audit. La capture `U09b_commande_refusee_listes.png` a été examinée et confirme visuellement les méthodes « Non spécifiée ». Aucune nouvelle capture navigateur n'a été prise. Les fiches indiquent celles à préparer, sans utiliser de secret ni de données personnelles réelles.

## Résultats des outils

| Contrôle | Résultat | Portée / preuve |
|---|---|---|
| `npm.cmd audit --json --ignore-scripts` | 7 audits terminés, tous avec alertes, code 1 | `audit-e27-e28/npm-*.json` |
| Jest existant : `CI=true npm.cmd test -- --watchAll=false --runInBand --no-cache` | Échec de la suite, **0 test exécuté** | Import ESM d'Axios rejeté ; fiche P2-10 |
| Jest d'audit isolé | **4 tests passés** documentant les anomalies actuelles | `ui.test.js`, `run-ui.cjs`, `jest-isolated.log` |
| Sondes applicatives/API | **26 observations vérifiées**, aucune sonde en échec | `probes.cjs`, `probes.json` |
| ESLint frontend : `node node_modules/eslint/bin/eslint.js src --no-cache` | Code 0, 0 erreur, 1 avertissement | `Register.js:12`, `setError` inutilisé |
| Syntaxe Node : `node --check` | 23 fichiers serveur valides | `syntax.json` ; ne remplace pas ESLint |
| Build React : `npm.cmd run build` | Code 0, compilation avec avertissements | `BUILD_PATH` fourni uniquement au processus, vers `%TEMP%/e27-e28-react-build` |

ESLint est installé dans le frontend uniquement ; aucune configuration ESLint serveur ni Supertest n'est présente. Aucun outil supplémentaire n'a été installé. L'API a été testée avec `fetch` fourni par Node et les dépendances existantes. Les tests Jest d'audit utilisent une configuration transmise sur la ligne de commande, le runtime JSX automatique et l'entrée CommonJS d'Axios ; cela **ne répare pas** la suite du projet.

Le build et les outils signalent aussi des données Browserslist anciennes et une dépendance Babel non déclarée par `babel-preset-react-app`. Les tests isolés produisent des avertissements React sur `select value=null` et `act`, et Jest signale un délai de fermeture. Leur exécution se termine avec le code 0 ; ces avertissements ne sont pas assimilés à une validation globale du projet.

### Dépendances : résultats complets par dossier

| Dossier sous `exam1/` | Faibles | Modérées | Élevées | Critiques | Total |
|---|---:|---:|---:|---:|---:|
| Racine | 0 | 3 | 0 | 0 | 3 |
| backend | 0 | 2 | 5 | 3 | 10 |
| frontend | 19 | 15 | 36 | 4 | 74 |
| gateway | 0 | 1 | 3 | 1 | 5 |
| microservices/auth-gateway | 0 | 1 | 3 | 1 | 5 |
| microservices/notifications | 0 | 1 | 4 | 1 | 6 |
| microservices/stock-management | 0 | 1 | 3 | 1 | 5 |

Total arithmétique : **108 signalements de paquets, dont 11 critiques**. Ce ne sont pas 108 failles distinctes : des dépendances se répètent entre services et npm propage certaines alertes aux paquets parents. Les dépendances de développement sont incluses. L'exploitabilité de chaque avis dans cette application n'a pas été démontrée.

## P0 — traiter en premier après autorisation

### P0-01 — Secret Gmail affiché au démarrage

- **Description / gravité : critique, E28.** Le secret applicatif Gmail est interpolé dans un `console.log` exécuté au démarrage.
- **Fichier :** `exam1/microservices/notifications/index.js:20`.
- **Reproduction :** lire cette instruction et constater qu'elle utilise `process.env.EMAIL_APPLICATION_PASSWORD`. Pour une démonstration dynamique, utiliser exclusivement un processus isolé avec une valeur factice et Nodemailer simulé. Ne pas redémarrer le service réel pour obtenir une capture.
- **Attendu :** aucune valeur d'authentification dans les journaux.
- **Obtenu :** instruction de journalisation inconditionnelle confirmée ; la présence d'un secret Gmail dans l'environnement racine a été vérifiée sans en afficher la valeur. La fuite déjà observée par l'utilisateur n'a pas été reproduite avec le vrai secret.
- **Correction proposée :** retirer la journalisation ; après autorisation, révoquer/remplacer le mot de passe applicatif exposé et traiter les copies de logs. Le retrait du log seul ne rend pas un secret déjà divulgué sûr.
- **Test de validation :** capturer stdout/stderr d'un démarrage isolé avec un marqueur synthétique et vérifier son absence ; contrôler ensuite la révocation côté fournisseur, sans afficher la nouvelle valeur.
- **Capture examen :** ligne source avant correction, puis résultat d'un test avec marqueur factice ; aucune capture d'un terminal contenant le vrai secret.

### P0-02 — Lecture de fichier via le corps d'email contrôlé par le client

- **Description / gravité : critique, E28.** `text` est transmis directement à Nodemailer, qui accepte aussi un objet `{ path: ... }`. L'API est dépourvue d'authentification. Un appelant peut faire intégrer un fichier lisible par le service dans un message destiné à une adresse de son choix.
- **Fichier :** `exam1/microservices/notifications/index.js:23` et construction de `mailOptions`.
- **Reproduction :** lancer la sonde `NOTIFICATION_ARBITRARY_FILE_CONTENT`. Elle transmet un objet `text.path` pointant uniquement vers un fichier factice, avec le vrai Nodemailer et un transport en mémoire.
- **Attendu :** refuser un `text` qui n'est pas une chaîne, sans lecture de fichier.
- **Obtenu :** statut 200 et contenu du fichier factice retrouvé dans le message généré. Aucun fichier sensible lu, aucun SMTP contacté. L'exfiltration réelle par Gmail n'a pas été testée.
- **Correction proposée :** valider strictement types et tailles, authentifier/autoriser les appelants et configurer `disableFileAccess` / `disableUrlAccess` comme défense supplémentaire. La documentation officielle décrit les objets acceptés par [`text`](https://nodemailer.com/message).
- **Test de validation :** `{ text: { path: fichierFactice } }` doit produire 400 ; vérifier qu'aucune lecture ni émission ne se produit. Tester également le refus des objets contenant une URL.
- **Capture examen :** résultat de la sonde avec `fileContentInMessage: true`, puis test de rejet après correction. Utiliser exclusivement le fichier factice.

## P1 — intégrité des commandes, accès et confidentialité

### P1-01 — Prix de commande contrôlé par le client

- **Description / gravité : élevée, E27/E28.** Le serveur calcule le total à partir du prix reçu sans lire le catalogue ; aucun minimum n'est défini pour le prix des lignes.
- **Fichiers :** `backend/controllers/orderController.js:34` et `backend/models/Order.js`, sous `exam1/`.
- **Reproduction :** sonde `ORDER_CLIENT_PRICE_AND_STOCK`, avec `price: -1`, quantité 999999 et un identifiant au format ObjectId.
- **Attendu :** charger les produits existants et appliquer leurs prix côté serveur ; refuser des données incohérentes.
- **Obtenu :** 201 et total -999999 dans le stockage simulé, avec validation du vrai modèle. Aucune recherche du produit n'est effectuée. Aucune commande réelle créée.
- **Correction proposée :** ne pas accepter le prix comme autorité, recalculer les montants à partir du catalogue et définir une représentation monétaire adaptée.
- **Test de validation :** modifier le prix envoyé ne doit jamais modifier le prix réel ; un produit absent doit être refusé.
- **Capture examen :** résultat de la sonde montrant le prix accepté et le total négatif, sans données réelles.

### P1-02 — Stock jamais décrémenté et succès fictif du microservice

- **Description / gravité : élevée, E27/E28.** La création de commande ne vérifie ni ne réserve le stock. Son appel stock est commenté. Le microservice se contente d'un log et d'une réponse de succès.
- **Fichiers :** `backend/controllers/orderController.js:72`, `microservices/stock-management/index.js:7`, `frontend/src/pages/ProductList.js`, `frontend/src/context/CartContext.js`, sous `exam1/`.
- **Reproduction :** sondes `ORDER_CLIENT_PRICE_AND_STOCK`, `STOCK_SERVICE_FALSE_SUCCESS`, `CART_REDUCER_MUTATION_AND_STOCK`.
- **Attendu :** refuser une quantité indisponible et effectuer une réservation/décrémentation atomique, y compris sous concurrence.
- **Obtenu :** quantité 999999 acceptée sans appel stock ; le microservice répond 200 à un produit inexistant et une quantité négative sans persistance. Le panier passe de 1 à 2 pour un stock de 1.
- **Correction proposée :** implémenter un propriétaire unique du stock, une mise à jour conditionnelle atomique, une stratégie de compensation/transaction et l'idempotence des commandes ; limiter aussi l'interface.
- **Test de validation :** sur une base de test, deux achats concurrents du dernier article doivent produire un seul succès ; vérifier stock final, rollback et rejeu d'une même commande.
- **Capture examen :** sondes actuelles ; après autorisation, comparaison commande/stock sur des données de test, jamais sur la base actuelle sans accord.

### P1-03 — API de notification utilisable sans authentification

- **Description / gravité : élevée, E28.** N'importe quel appelant réseau peut choisir destinataire, sujet et texte et atteindre l'envoi Gmail. Aucun contrôle d'appelant, de destinataire ou de débit n'est présent.
- **Fichiers :** `microservices/notifications/index.js:22`, `gateway/server.js`, `gateway/routes/notifi.js`, sous `exam1/`.
- **Reproduction :** `NOTIFICATION_EXPOSURE_AND_ERROR` exécute le gestionnaire sans en-tête d'authentification avec l'expéditeur simulé. `OPTIONS /notify` sur la Gateway réelle annonce POST.
- **Attendu :** autoriser uniquement les services/utilisateurs habilités ; encadrer destinataires et débit.
- **Obtenu :** `sendMail` simulé est atteint sans authentification. Aucun email réel envoyé. Risques d'abus d'envoi et de consommation du quota du compte.
- **Correction proposée :** authentification interservices, autorisation du type de notification, restriction réseau et limitation de débit.
- **Test de validation :** absence/invalidité d'identité → 401/403 sans appel SMTP ; charge excessive → rejet contrôlé.
- **Capture examen :** sortie de sonde `authenticationMiddleware: false`, `mockedSendReached: true`.

### P1-04 — JWT, mots de passe et données personnelles dans les logs

- **Description / gravité : élevée, E28.** Les JWT sont journalisés côté backend et navigateur. Les traces `debug` d'authentification incluent mots de passe, documents utilisateur et jetons lorsqu'elles sont activées. Les commandes/adresses et contenus d'emails sont également journalisés.
- **Fichiers :** `backend/middlewares/authMiddleware.js:7`, `backend/controllers/authController.js:12,17,24,35,42,50`, `backend/config/db.js:7`, `backend/controllers/orderController.js:12,57`, `frontend/src/services/api.js:11`, `microservices/notifications/index.js:24`, sous `exam1/`.
- **Reproduction :** inspection des instructions actives. Pour l'authentification en mode debug, utiliser seulement des identifiants/jetons synthétiques en environnement isolé. Le log de l'URI Mongo peut contenir des identifiants si l'URI en comporte ; leur présence effective n'est pas affirmée ici.
- **Attendu :** traces utiles avec identifiants de corrélation, sans secrets ni données personnelles superflues.
- **Obtenu :** journaux sensibles confirmés dans le code ; les traces debug sont conditionnelles, les `console.log` concernés ne le sont pas. Aucun vrai jeton capturé par l'audit.
- **Correction proposée :** supprimer/masquer les champs sensibles, centraliser la politique de journalisation et limiter accès/rétention.
- **Test de validation :** injecter des marqueurs synthétiques dans password/JWT/adresse et vérifier qu'aucun n'apparaît dans les sorties.
- **Capture examen :** instructions sources et résultats booléens de non-divulgation ; masquer toute donnée réelle.

### P1-05 — Dépendances vulnérables dans les sept périmètres npm

- **Description / gravité : critique à modérée selon paquet, E28 ; priorité opérationnelle P1.** Les sept audits identifient des versions connues vulnérables. La gravité npm ne prouve pas qu'un chemin exploitable est exposé ici.
- **Fichiers :** les sept `package.json` / `package-lock.json` de `exam1/`, du backend, frontend, Gateway et des trois microservices ; détails exhaustifs dans `audit-e27-e28/npm-*.json`.
- **Reproduction :** dans chacun des sept dossiers, exécuter `npm.cmd audit --json --ignore-scripts` sans `fix`.
- **Attendu :** absence d'alertes pertinentes non traitées, ou acceptation documentée avec conditions d'exploitation évaluées.
- **Obtenu :** tableau ci-dessus. Exemples : Mongoose 8.8.1, Axios 1.7.7, Express 4.21.1 ; Nodemailer 6.9.16 ; React Router DOM 6.4.5. Paquets critiques signalés : backend `mongoose`, `form-data`, `proxy-addr` ; frontend `form-data`, `proxy-addr`, `shell-quote`, `websocket-driver` ; `proxy-addr` dans la Gateway et les trois microservices. La racine présente des alertes modérées via `minimatch`.
- **Correction proposée :** examiner chaque chaîne et ses conditions, mettre à jour de façon ciblée puis tester. Les suggestions automatiques incluent des changements majeurs, voire `react-scripts@0.0.0` et des rétrogradations d'outils : **ne pas appliquer aveuglément `audit fix --force`**.
- **Test de validation :** refaire les sept audits, distinguer production/développement, puis inscription, connexion, commande, stock, tests et build. Comparer les mêmes périmètres.
- **Capture examen :** tableau avant correction et sortie `npm audit` par dossier ; conserver les sept JSON comme preuves. Sources complémentaires : [avis Mongoose](https://github.com/advisories/GHSA-vg7j-7cwx-8wgw), [avis Nodemailer](https://github.com/advisories/GHSA-rcmh-qjqh-p98v). Les autres avis sont liés dans les JSON.

### P1-06 — Opérateurs NoSQL acceptés dans les filtres d'authentification

- **Description / gravité : élevée, E28.** `username` et `email` issus du JSON sont utilisés dans `findOne` sans imposer une chaîne ni neutraliser les opérateurs.
- **Fichier :** `exam1/backend/controllers/authController.js:16,39`.
- **Reproduction :** sonde `AUTH_NOSQL_FILTER`, avec `username: { "$ne": null }`, modèle simulé, sans requête MongoDB réelle.
- **Attendu :** 400 avant construction du filtre pour tout objet/tableau au lieu d'une chaîne.
- **Obtenu :** l'opérateur atteint le filtre transmis à `User.findOne`. La comparaison bcrypt reste présente : **aucun contournement complet de connexion n'est démontré**. L'avis Mongoose de P1-05 est une alerte distincte ; aucune exécution de `$where` n'a été tentée.
- **Correction proposée :** validation typée stricte, normalisation des champs et protection des filtres en défense supplémentaire, avec mise à jour de Mongoose.
- **Test de validation :** objets `$ne`, `$regex`, tableaux et `null` → 400, sans appel au modèle ; identifiants valides toujours fonctionnels.
- **Capture examen :** `operatorReachedModel: true`, avec mention explicite de l'absence de contournement démontré.

### P1-07 — Inscription acceptant email invalide et mot de passe très faible

- **Description / gravité : élevée, E27/E28.** Les champs obligatoires n'ont ni validation de format email, ni suppression des espaces, ni politique minimale de mot de passe.
- **Fichiers :** `exam1/backend/models/User.js`, `exam1/backend/controllers/authController.js`.
- **Reproduction :** sonde `REGISTER_WEAK_FIELDS`, validation du vrai modèle sans sauvegarde : username composé d'espaces, email invalide, password d'un caractère.
- **Attendu :** refus avec erreurs de validation explicites, sans création de compte.
- **Obtenu :** validation Mongoose réussie pour ces trois valeurs. Le hachage bcrypt existe mais ne remplace pas la validation.
- **Correction proposée :** validation backend des types, formats et longueurs, normalisation de l'identité et politique de mot de passe adaptée.
- **Test de validation :** matrice valeurs absentes/espaces/formats/types/longueurs ; vérifier aussi une inscription valide sur une base isolée.
- **Capture examen :** sortie `REGISTER_WEAK_FIELDS` ; ne pas utiliser un mot de passe réel.

### P1-08 — Absence d'autorisation administrateur sur DELETE commande

- **Description / gravité : élevée pour le contrôle manquant, E28.** La route DELETE ne comporte que `authenticateToken`, contrairement au commentaire annonçant un accès administrateur.
- **Fichier :** `exam1/backend/routes/orderRoutes.js`, `router.delete('/:id', ...)`.
- **Reproduction :** sonde `DELETE_ROUTE_MISSING_ADMIN`, inspection de la chaîne de gestionnaires.
- **Attendu :** contrôle administrateur, ou politique explicite de propriétaire/statut si la suppression utilisateur est souhaitée.
- **Obtenu :** tout utilisateur authentifié atteint le contrôleur. Celui-ci ne supprime actuellement rien : **aucune suppression non autorisée n'a été démontrée**. Le risque deviendrait directement exploitable si sa logique était ajoutée seule.
- **Correction proposée :** définir et appliquer la politique d'accès avant d'implémenter la suppression.
- **Test de validation :** utilisateur ordinaire refusé par 403 pour une route admin ; administrateur autorisé ; absence de mutation en cas de refus.
- **Capture examen :** chaîne DELETE et `adminRequired: false`.

### P1-09 — Erreurs MongoDB non prises en charge sur les lectures

- **Description / gravité : élevée pour la disponibilité, E27.** Les fonctions async de lecture produits/commandes n'ont pas de gestion de rejet ; Express 4 ne transfère pas automatiquement ces rejets au middleware d'erreur.
- **Fichiers :** `exam1/backend/controllers/productController.js` (`getProducts`), `exam1/backend/controllers/orderController.js` (`getOrders`), routes associées.
- **Reproduction :** sonde `READ_CONTROLLERS_UNHANDLED_DB_REJECTION`, qui simule `find()` rejeté sans couper MongoDB.
- **Attendu :** erreur HTTP contrôlée et serveur disponible.
- **Obtenu :** promesses rejetées sans réponse envoyée. Le comportement final du processus dépend de son traitement des rejets non interceptés ; aucun arrêt du serveur réel n'a été provoqué.
- **Correction proposée :** envelopper les handlers async, transmettre à `next(error)` et centraliser les erreurs.
- **Test de validation :** simuler une panne de lecture ; exiger une réponse 500/503 bornée dans le temps et le succès de la requête suivante.
- **Capture examen :** sonde et test de disponibilité sur serveur isolé.

## P2 — fonctionnement, robustesse et validation

### P2-01 — Suppression de commande laissée sans réponse

- **Description / gravité : modérée, E27.** Le contrôleur ne supprime rien, ne répond pas et lit `body.orderId` alors que la route fournit `params.id`.
- **Fichier :** `exam1/backend/controllers/orderController.js:150`.
- **Reproduction :** sonde `ORDER_DELETE_AND_VALIDATE`, appel avec `params.id` et corps vide.
- **Attendu :** suppression autorisée avec 204/200, ou refus explicite ; traitement des absences et erreurs.
- **Obtenu :** `deleteResponded: false`, aucun accès au stockage. Une requête resterait en attente jusqu'à une fermeture/expiration externe.
- **Correction proposée :** implémenter la logique avec politique P1-08 et réponse sur chaque chemin, ou désactiver explicitement l'endpoint.
- **Test de validation :** base isolée, cas succès/absent/interdit ; chaque requête doit terminer dans un délai borné.
- **Capture examen :** résultat de sonde, sans lancer DELETE sur une commande réelle.

### P2-02 — Validation de commande annonçant un succès sans effet

- **Description / gravité : modérée, E27.** `validateOrder` renvoie 200 sans lecture ni mise à jour ; l'identifiant est lu dans le corps au lieu de l'URL.
- **Fichier :** `exam1/backend/controllers/orderController.js:162` ; `frontend/src/services/adminApi.js` envoie un corps vide.
- **Reproduction :** sonde `ORDER_DELETE_AND_VALIDATE` avec `params.id` et corps vide.
- **Attendu :** changement persistant et autorisé, 404 si commande absente.
- **Obtenu :** message de succès contenant `undefined`, zéro écriture simulée. Le bouton admin actuel utilise la route de changement de statut ; cette anomalie concerne l'autre endpoint réellement monté.
- **Correction proposée :** unifier les transitions, utiliser l'identifiant URL et vérifier le résultat en base.
- **Test de validation :** relire une commande de test après validation ; un identifiant absent ne doit pas produire de succès.
- **Capture examen :** `validateStatus: 200`, `validateUsesUndefinedId: true`, `databaseWrites: 0`.

### P2-03 — Statut arbitraire accepté malgré l'enum Mongoose

- **Description / gravité : modérée, E27/E28.** `findByIdAndUpdate` est utilisé sans `runValidators`; le contrôleur exige seulement un statut non vide.
- **Fichier :** `exam1/backend/controllers/orderController.js:179`, `exam1/backend/models/Order.js`.
- **Reproduction :** sonde `ORDER_STATUS_WITHOUT_VALIDATORS`, statut `arbitrary-status`.
- **Attendu :** statut appartenant à la liste et transition métier autorisée.
- **Obtenu :** 200 avec ce statut dans le modèle simulé et aucune option `runValidators`. Le test confirme le contrôle manquant, sans écriture réelle.
- **Correction proposée :** valider l'enum et les transitions côté serveur, activer les validateurs de mise à jour.
- **Test de validation :** statut inconnu → 400 ; transition interdite → refus ; transition valide persistée sur base de test.
- **Capture examen :** options de mise à jour et sortie de sonde.

### P2-04 — Quantités et stock fractionnaires, erreurs de type transformées en 500

- **Description / gravité : modérée, E27/E28.** Les quantités de commande n'ont pas de contrainte entière ; la mise à jour stock vérifie seulement `stock < 0`.
- **Fichiers :** `exam1/backend/models/Order.js`, `exam1/backend/models/Product.js`, `exam1/backend/controllers/productController.js:14`.
- **Reproduction :** `ORDER_FRACTIONAL_QUANTITY` et `STOCK_FRACTION_AND_TYPE_HTTP`, valeurs 1.5 et chaîne non numérique.
- **Attendu :** entiers finis dans une plage définie ; erreurs de type rejetées en 400.
- **Obtenu :** quantité 1.5 valide ; stock 1.5 → 200 ; stock non numérique → 500 après validation du vrai modèle dans la sonde.
- **Correction proposée :** contrôler présence/type/entier/plage avant accès au modèle et ajouter les contraintes aux schémas.
- **Test de validation :** couvrir 0 pour stock, 1 pour quantité, décimales, négatifs, chaînes, absence et dépassements.
- **Capture examen :** sortie des deux sondes et tableau de valeurs.

### P2-05 — Erreurs de saisie retournées comme erreurs serveur

- **Description / gravité : modérée, E27.** Plusieurs entrées invalides et conflits d'unicité tombent dans un catch 500 générique.
- **Fichiers :** `exam1/backend/controllers/authController.js`, `exam1/backend/controllers/orderController.js`.
- **Reproduction :** `REGISTER_EMPTY_AND_DUPLICATE_HTTP`, `LOGIN_VALID_AND_INVALID_PASSWORD`, `ORDER_INVALID_INPUT_HTTP`. Les accès/sauvegardes sont simulés.
- **Attendu :** 400/422 pour données invalides, 409 pour identité déjà utilisée ; erreur d'authentification cohérente pour mauvais identifiants.
- **Obtenu :** inscription vide → 500 ; duplication de username simulant E11000 → 500 ; mot de passe manquant pour utilisateur trouvé → 500 ; ligne de commande invalide → 500. Le username n'est pas pré-vérifié contrairement à l'email.
- **Correction proposée :** valider avant traitement, traduire les erreurs Mongoose/E11000 et uniformiser les réponses d'authentification.
- **Test de validation :** matrice des cas précédents, avec vérification qu'aucune erreur de saisie attendue ne renvoie 500.
- **Capture examen :** sorties des sondes avec payloads factices.

### P2-06 — Détails techniques exposés dans les réponses d'erreur

- **Description / gravité : modérée, E28.** Le backend laisse Express afficher des traces en HTML ; le service notifications sérialise l'objet d'erreur SMTP.
- **Fichiers :** `exam1/backend/server.js`, `exam1/microservices/notifications/index.js`, catch de `/notify`.
- **Reproduction :** sonde `LIVE_MALFORMED_JSON`, JSON incomplet `{` sur `/api/auth/login`, rejeté avant le contrôleur ; sonde isolée `NOTIFICATION_EXPOSURE_AND_ERROR` pour l'erreur SMTP.
- **Attendu :** réponse JSON courte, sans pile, chemins locaux ni détails du fournisseur.
- **Obtenu :** HTTP réel 400, `text/html`, trace `SyntaxError` et chemin absolu détectés ; champ technique synthétique SMTP présent dans la réponse isolée. Aucune réponse brute contenant des données sensibles n'a été conservée.
- **Correction proposée :** middleware d'erreur JSON global, configuration d'exécution adaptée et séparation entre message public et diagnostic interne nettoyé.
- **Test de validation :** JSON mal formé, erreur DB/SMTP simulée : aucun chemin, stack, secret ou objet interne dans la réponse.
- **Capture examen :** sortie booléenne `exposesStack` / `exposesAbsolutePath`, puis réponse nettoyée après correction.

### P2-07 — Notification attendue sans limite de temps après sauvegarde

- **Description / gravité : modérée, E27.** La commande est enregistrée avant un `await axios.post` sans timeout explicite. Un service de notification qui ne termine pas peut bloquer la réponse alors que la commande existe déjà.
- **Fichier :** `exam1/backend/controllers/orderController.js:54,61`.
- **Reproduction :** inspection du chemin actif ; sur serveur isolé, remplacer uniquement le transport de notification par une promesse qui ne se résout pas. Ne pas arrêter les services réels.
- **Attendu :** réponse bornée dans le temps et traitement fiable des notifications indépendamment de la réponse d'achat.
- **Obtenu :** aucun timeout configuré sur cet appel, aucune réponse envoyée avant sa fin. Une notification en erreur immédiate est absorbée, mais une attente indéfinie ne l'est pas. La durée d'un incident réel n'a pas été mesurée.
- **Correction proposée :** timeout, traitement asynchrone fiable (par exemple outbox), stratégie de reprise et idempotence des commandes.
- **Test de validation :** transport suspendu : réponse dans le délai défini, une seule commande, notification récupérable sans double achat.
- **Capture examen :** chemin de sauvegarde/appel/réponse et chronométrage d'un test isolé.

### P2-08 — Sélections livraison/paiement affichées mais non enregistrées

- **Description / gravité : modérée, E27.** Les contextes commencent à `null`, alors que les listes affichent leur première option sans initialiser le contexte.
- **Fichiers :** `exam1/frontend/src/context/CartContext.js`, `components/ShippingMethodSelection.js`, `components/handlePaymentChange.js`, `pages/Order.js`.
- **Reproduction :** sans changer les listes, passer de livraison/paiement à la synthèse. Test Jest : `selects display first choices while context methods remain null`.
- **Attendu :** premières options enregistrées, ou placeholder explicite obligeant un choix.
- **Obtenu :** DOM : `colissimo` / `Carte bancaire` ; contexte : `null` / `null`. La synthèse affiche « Non spécifiée » et la validation bloque. Capture antérieure U09b examinée.
- **Correction proposée :** aligner valeurs initiales et affichage, ou ajouter un choix vide explicite avec validation.
- **Test de validation :** le parcours sans manipulation des listes doit être cohérent ; tester aussi les autres options.
- **Capture examen :** page montrant les choix puis synthèse « Non spécifiée », ou sortie Jest actuelle.

### P2-09 — Mutation du précédent état dans le reducer du panier

- **Description / gravité : modérée, E27.** La copie du tableau conserve les objets ; l'incrément modifie l'objet de l'ancien état.
- **Fichier :** `exam1/frontend/src/context/CartContext.js`, branche `ADD_TO_CART`.
- **Reproduction :** sonde `CART_REDUCER_MUTATION_AND_STOCK` ou test Jest correspondant.
- **Attendu :** reducer pur, ancien état intact, nouvelle ligne avec nouvelle référence.
- **Obtenu :** l'ancien état passe lui aussi de quantité 1 à 2. Cette mutation enfreint le contrat des reducers et peut provoquer des comportements incohérents lors de doubles invocations/rendus ; leur fréquence en navigateur n'a pas été mesurée.
- **Correction proposée :** copier aussi l'objet modifié et appliquer les règles de quantité.
- **Test de validation :** geler l'ancien état, ajouter un article, vérifier anciennes valeurs/références et nouvelle quantité.
- **Capture examen :** ancien état avant/après et test, uniquement produits factices.

### P2-10 — Suite Jest du projet inutilisable et test de démarrage obsolète

- **Description / gravité : modérée, E27.** Le lancement officiel s'arrête sur l'import ESM d'Axios. Le seul test cible encore « learn react » et rend `App` sans `CartProvider`.
- **Fichiers :** `exam1/frontend/src/App.test.js`, `frontend/package.json`, imports Axios de `frontend/src/services/api.js` et des pages.
- **Reproduction :** depuis le frontend, `$env:CI='true'; npm.cmd test -- --watchAll=false --runInBand --no-cache`.
- **Attendu :** tests du parcours réel, exécutables et représentatifs de l'application.
- **Obtenu :** une suite en échec, zéro test exécuté, `Cannot use import statement outside a module` sur Axios. Les défauts supplémentaires du test sont confirmés à la lecture ; ils sont actuellement masqués par l'erreur d'import.
- **Correction proposée :** adapter le chargement/mocking Axios dans les tests, fournir les providers nécessaires et remplacer le test généré par des scénarios métier.
- **Test de validation :** commande officielle au vert, scénarios auth/panier/commande/admin et cas d'erreur effectivement exécutés.
- **Capture examen :** échec actuel puis future exécution des tests corrigés. Les quatre tests d'audit passés documentent les défauts, ils ne signifient pas que l'application est corrigée.

### P2-11 — Absence de limitation applicative des tentatives de connexion

- **Description / gravité : modérée, E28.** Les routes login/register sont directement exposées sans middleware de limitation ni ralentissement visible dans le projet.
- **Fichiers :** `exam1/backend/server.js`, `backend/routes/authRoutes.js`, `backend/controllers/authController.js`.
- **Reproduction :** inspection de la chaîne complète des middlewares ; aucune rafale n'a été envoyée au service réel.
- **Attendu :** limitation adaptée des tentatives par compte et source, sans blocage abusif facile.
- **Obtenu :** aucun contrôle applicatif présent ; pas de protection externe identifiée dans les fichiers fournis. L'existence d'un dispositif hors projet n'est pas exclue. Les messages distinguent aussi utilisateur absent et mot de passe incorrect.
- **Correction proposée :** limiter/temporiser les tentatives et uniformiser le message d'échec ; choisir une stratégie compatible avec plusieurs instances.
- **Test de validation :** rafale contrôlée sur serveur isolé → 429/temporisation selon politique, retour normal après délai ; tester l'absence d'énumération par le message.
- **Capture examen :** graphe/compteur de réponses du test isolé, sans identifiants réels.

## P3 — interface et configuration complémentaire

### P3-01 — Formulaires sans validation des champs obligatoires

- **Description / gravité : faible côté interface, E27.** Les inputs inscription/connexion n'ont pas `required`; l'inscription n'a pas de limite minimale de mot de passe.
- **Fichiers :** `exam1/frontend/src/pages/Register.js`, `exam1/frontend/src/pages/Login.js`.
- **Reproduction :** test Jest `empty registration inputs satisfy browser required-field validation`, ou tenter une soumission vide sans laisser créer de compte réel.
- **Attendu :** erreurs près des champs et requête évitée pour une saisie vide ; validation backend indépendante.
- **Obtenu :** les trois inputs d'inscription vides passent `checkValidity()` ; l'attribut `type=email` ne rend pas le champ obligatoire. La validation serveur insuffisante est traitée en P1-07/P2-05.
- **Correction proposée :** contraintes HTML cohérentes et messages accessibles, alignés sur le backend.
- **Test de validation :** soumission vide et mot de passe insuffisant → aucun appel HTTP et messages appropriés.
- **Capture examen :** formulaire vide et onglet réseau, ou test Jest actuel. Capture antérieure U05 disponible, non recréée pendant cet audit.

### P3-02 — Accès visuel admin fondé sur un rôle modifiable

- **Description / gravité : faible côté interface, E27/E28.** `AdminRoute` fait confiance au rôle et à la présence d'une chaîne token dans localStorage.
- **Fichier :** `exam1/frontend/src/components/AdminRoute.js`.
- **Reproduction :** test Jest avec token factice et `role=admin`, sans identité réelle ni requête admin.
- **Attendu :** interface cohérente avec une identité valide et gestion explicite des refus backend.
- **Obtenu :** les enfants du composant admin sont rendus. **Ce n'est pas une élévation de privilèges serveur** : les vérifications JWT/admin testées refusent les faux jetons et le rôle utilisateur. L'état d'interface reste manipulable par son propriétaire.
- **Correction proposée :** vérifier l'identité côté serveur au démarrage et traiter 401/403 ; conserver impérativement les autorisations backend.
- **Test de validation :** rôle local falsifié et JWT faux/expiré ne doivent donner ni données ni actions admin ; afficher une redirection/erreur cohérente.
- **Capture examen :** démonstration UI et refus API associés, jeton factice uniquement. Capture antérieure U12 disponible.

### P3-03 — CORS ouvert à toute origine

- **Description / gravité : faible dans l'état observé, E28.** `cors()` répond avec `Access-Control-Allow-Origin: *` sur le backend.
- **Fichier :** `exam1/backend/server.js:10`.
- **Reproduction :** sonde `LIVE_CORS`, OPTIONS avec origine `https://audit.example.invalid`.
- **Attendu :** politique d'origines explicitement adaptée aux clients prévus ; ouverture publique seulement si voulue.
- **Obtenu :** 204, origine autorisée `*`. Les routes privées exigent toujours un JWT ; aucun contournement d'authentification ni accès avec cookies n'est démontré. La lecture publique des produits peut être intentionnelle.
- **Correction proposée :** formaliser le besoin puis limiter les origines des endpoints concernés ; ne pas considérer CORS comme une authentification interservices.
- **Test de validation :** origines autorisée/refusée et requêtes sans Origin ; confirmer le maintien des contrôles JWT.
- **Capture examen :** en-têtes OPTIONS actuels puis comportement attendu selon politique.

### P3-04 — Clé React de liste produits indéfinie

- **Description / gravité : faible, E27.** La liste utilise `key={product.id}` alors que l'API fournit `_id` sans `id`.
- **Fichier :** `exam1/frontend/src/pages/ProductList.js`, élément `<li>`.
- **Reproduction :** comparer le résultat `LIVE_PRODUCTS` avec la clé du rendu ; ouvrir la console du catalogue.
- **Attendu :** clé stable et unique par produit.
- **Obtenu :** cinq produits lus, tous avec `_id`, aucun avec `id`. Les clés sont donc absentes ; risque de mauvaise réconciliation et avertissement React. Aucune erreur de contenu visible n'est affirmée.
- **Correction proposée :** utiliser l'identifiant effectivement fourni, avec convention d'API cohérente.
- **Test de validation :** rendu avec plusieurs produits, ajout/retrait/réordonnancement et absence d'avertissement de clé.
- **Capture examen :** avertissement console et forme de la réponse publique, sans autre donnée utilisateur.

## Points vérifiés et limites à conserver pour l'examen

- **HTTP réel :** catalogue 200 (5 produits), commandes sans authentification 401, faux JWT 403, route inconnue 404 ; les codes d'erreur d'authentification 400/401/403 pourront être harmonisés selon le contrat retenu.
- **JWT isolés :** signature vérifiée par `jwt.verify`, jeton expiré et jeton admin signé avec une autre clé refusés, jeton valide accepté ; rôle utilisateur refusé par `isAdmin`. Login valide simulé : bcrypt accepté et JWT d'une heure ; mauvais mot de passe : refus. Les vrais secrets n'ont pas servi à signer des jetons d'audit.
- **Autorisation :** GET commandes, modification de statut et modification de stock comportent bien le contrôle admin. Le rôle fourni à l'inscription est ignoré par le contrôleur, et le modèle attribue `user` par défaut. Aucun auto-attribut admin par inscription n'est confirmé.
- **Mots de passe :** hook bcrypt présent, coût 10. Aucune lecture des utilisateurs ou hashes réels n'a été faite. L'inscription complète, les doublons réels et la persistance ont été volontairement testés par simulation pour respecter l'interdiction de modifier la base.
- **Secrets Git :** les `.env` sont ignorés et absents de la liste des fichiers suivis contrôlée dans le dépôt principal et le dépôt frontend. Le dépôt principal n'a aucun commit accessible (`rev-list --count --all` = 0). Cela ne prouve pas l'absence de copies anciennes, sauvegardes ou expositions hors de ce dossier ; aucun historique distant n'a été consulté.
- **Architecture :** le frontend appelle directement le backend sur localhost:5000. La Gateway active relaie notification et stock ; `/auth` y est commenté et l'index du microservice `auth-gateway` est vide. OPTIONS `/auth/login` renvoie 404. Ce service n'assure donc pas l'authentification actuellement ; l'authentification active est dans le backend.
- **Routes inactives :** `backend/routes/adminRoutes.js` et `adminController.js` ne sont pas montés par `server.js`. Ils utilisent d'autres URLs/payloads de notification. Leurs défauts potentiels ne sont pas présentés comme des failles actives. La création/suppression de produits n'est pas implémentée dans les routes actives ; seul le catalogue et le changement de stock sont présents, sans exigence fournie imposant un CRUD complet.
- **Destinataire des notifications :** `backend/controllers/orderController.js:62` contient une adresse constante (non reproduite). Il faut clarifier si elle correspond à une équipe marchande habilitée ou si une notification client était attendue. Sans cette règle métier, le codage en dur est confirmé mais une divulgation à un tiers non autorisé ne l'est pas ; aucun email réel n'a été envoyé.
- **Compose :** aucun Dockerfile trouvé alors que plusieurs services déclarent `build`; stock mappé sur 3002 pour un service codé sur 4003, notifications sur 3001 alors que le défaut du code est 4002 ; Mongo publié sur 27018 alors que 27017 répond localement. Aucun essai de construction/lancement Compose effectué. Ces divergences de reproductibilité ne sont pas assimilées à une panne de l'environnement local déjà opérationnel. La publication Mongo mériterait une vérification réseau/authentification séparée ; aucune connexion Mongo directe ni exposition distante n'a été testée.
- **Environnement :** les ports 3000, 5000, 8000, 4002, 4003 et 27017 acceptent une connexion locale. L'accès Docker via le sandbox était refusé ; cela ne signifie pas que Docker est arrêté. Les audits npm ont nécessité une nouvelle exécution avec l'accès réseau autorisé après échec dans le sandbox. `npm.cmd` a été utilisé pour éviter la restriction PowerShell sur `npm.ps1`, sans changer la politique d'exécution.
- **État du travail :** le dépôt contenait déjà de nombreux fichiers ajoutés/modifiés, ainsi qu'un dépôt frontend distinct. Cet état a été préservé. Aucun changement de configuration Git globale n'a été fait.
- **Couverture :** pas de test navigateur automatisé complet, charge réelle, panne réelle de Mongo, paiement réel, email réel, test concurrent sur base ou déploiement. Les constats sont documentés selon leur preuve ; les tests de validation proposés ne sont pas des corrections déjà réalisées.

## Rejouer les preuves sans corriger

Depuis `C:\Users\mrkar\Documents\Project\final-exam-cloud` :

```powershell
node docs/audit-e27-e28/probes.cjs
node docs/audit-e27-e28/run-ui.cjs
```

Le premier script n'ouvre pas MongoDB : les écritures et emails sont simulés. Il effectue seulement quelques lectures HTTP, OPTIONS, une requête avec JWT factice et un JSON mal formé rejeté avant contrôleur sur les services locaux. Il régénère `probes.json`. Le second exécute les quatre tests Jest d'observation et régénère `jest-isolated.log`. Les marqueurs et identités sont factices. Les tests d'observation doivent être remplacés/adaptés pour vérifier le comportement attendu lorsque les corrections seront autorisées.

Pour l'examen, prendre d'abord les captures avant correction des P0, puis prix/stock, validation, erreurs HTTP et outils. Utiliser les sorties synthétiques pour les opérations qui écriraient dans la base ou enverraient un email. Après autorisation et corrections, garder les mêmes identifiants de fiches et refaire les validations correspondantes pour constituer les preuves avant/après.

**Toutes les corrections restent en attente de l'autorisation de l'utilisateur.**
