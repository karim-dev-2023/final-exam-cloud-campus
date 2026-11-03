# Corrections finales E27/E28 — sept anomalies

Date : **3 novembre 2026, Europe/Paris**. Ce document complète le rapport d'audit et le rapport de l'étape notifications, conservés comme historiques sans modification.

## Résultat vérifié

Les sept correctifs de code sont validés par le lanceur final : **81 résultats Node passés, 8 tests Jest passés, aucun échec, aucun TODO dans les suites finales exécutées**. Les compteurs Node incluent les groupes et sous-tests, comme dans le rapport natif de Node ; il ne faut pas les présenter comme 81 scénarios métier indépendants.

Le build React a compilé avec succès. ESLint : **14 fichiers serveur/tests contrôlés, 0 erreur, 0 avertissement**. Syntaxe Node : **14 fichiers, 0 échec**. Les avertissements d'outillage Browserslist/Babel et `act` restent visibles dans les logs ; ils n'ont pas été masqués ni transformés en succès de correction.

Exécution finale de référence : `2026-11-03T10:57:38.028Z`, soit **11 h 57 min 38 s à Paris**, avant l'échéance de 12 h 30. L'heure et les résultats de chaque nouvelle exécution sont enregistrés dans `summary.json`.

```powershell
node exam1/tests/run-final-e27-e28.cjs
```

À lancer depuis `C:\Users\mrkar\Documents\Project\final-exam-cloud`, MongoDB local déjà disponible sur `127.0.0.1:27017`. Aucun service applicatif habituel ne doit être arrêté pour les tests : les serveurs de test écoutent sur des ports éphémères.

| Groupe exécuté | Réussites | Échecs | Preuve APRÈS sous `docs/corrections-e27-e28/final/after/` |
|---|---:|---:|---|
| P0-01, P0-02, P1-03 — notifications | 56 Node | 0 | `01-notifications-P0-01-P0-02-P1-03.log` |
| P1-01 — prix | 4 Node | 0 | `02-prices-P1-01.log` |
| P1-02 — stock et reprise | 13 Node | 0 | `03-stock-P1-02.log` |
| P1-06 — NoSQL | 3 Node | 0 | `04-nosql-P1-06.log` |
| P1-07 — inscription | 5 Node | 0 | `05-registration-P1-07.log` |
| Interface et parcours existants | 8 Jest | 0 | `06-react-regression.log` |
| Build React | Code de sortie 0 | — | `07-react-build.log` |
| ESLint recommandé | Code de sortie 0 | — | `08-eslint-server.log`, `eslint-server.json` |
| Syntaxe Node | Code de sortie 0 | — | `09-syntax.log` |
| Intégrité des preuves antérieures | Aucune modification | 0 | `summary.json`, entrée `before-evidence-integrity` |

Chaque groupe possède également un fichier **`*-captures.log`**, court, avec les noms des tests exécutés et le résumé : c'est le fichier conseillé pour les captures VS Code. Les logs complets restent disponibles pour vérifier les assertions et les erreurs éventuelles.

Pour une capture **par anomalie**, le lanceur produit aussi `P0-01-after.log`, `P0-02-after.log`, `P1-01-after.log`, `P1-02-after.log`, `P1-03-after.log`, `P1-06-after.log` et `P1-07-after.log`. Ce sont des extraits identifiés des logs réellement exécutés, sans nouveau test ni modification des résultats. `anomalies.json` relie chaque extrait à sa source ; une anomalie sans test exécuté ou dont le groupe source échoue n'est pas marquée validée.

## Préservation des données et des preuves

- Aucun utilisateur, produit ou commande préexistant n'a été modifié par les tests. Aucune migration des données existantes n'a été exécutée.
- Les tests métier utilisent exclusivement une base générée `e27_final_test_<suffixe aléatoire>`, sur l'instance MongoDB locale. La destination est écrite explicitement dans les tests : le choix de base ne dépend jamais de `MONGO_URI` présent dans un `.env`.
- Chaque suppression de données de test vérifie la connexion à cette base privée ; le nettoyage final ne supprime que cette base, après contrôle de son préfixe et de son suffixe généré. Le test de diagnostic intermédiaire utilisait lui aussi une base privée distincte, nettoyée ensuite.
- Les emails sont construits par le vrai Nodemailer avec un transport en mémoire. Aucun SMTP/Gmail réel n'a été contacté.
- Le processus de test reçoit un environnement réduit, des credentials synthétiques et un répertoire de travail temporaire, pour ne pas charger les `.env` habituels. Le build utilise le répertoire frontend et une sortie temporaire privée, supprimée après contrôle du chemin.
- Les rapports précédents, `docs/audit-e27-e28/`, les captures AVANT et les résultats de l'étape notifications sont conservés. **77 fichiers de preuves préexistants** sont contrôlés par SHA-256 dans `final/before/manifest.json`.
- `final/before/remaining-probes.json` contient une copie ciblée des observations initiales. Les anciennes sondes et leurs résultats n'ont pas été changés.
- Les exécutions finales précédentes, y compris celles avec des erreurs de développement, sont archivées sous `final/after/runs/` avant actualisation des fichiers APRÈS courants.
- Aucun nouveau paquet, déploiement, git push ou `npm audit fix --force`. Les variables d'environnement et les secrets de l'étape précédente n'ont pas été modifiés dans cette étape finale.

## P1-01 — Prix de commande contrôlé par le client

**Cause.** Le contrôleur reprenait `items[].price` puis calculait le total avec cette valeur non fiable.

**Correction.** Le service charge les produits du catalogue par leurs identifiants validés. Il ignore les prix et le total envoyés par le client, y compris un prix négatif ou un objet JSON. Les montants sont calculés en centimes entiers et convertis seulement pour conserver le contrat numérique existant de l'API. Les produits manquants et les données catalogue invalides sont refusés. Les lignes répétées d'un même produit sont regroupées, avec contrôle de la quantité cumulée.

Le prix catalogue lu est également inclus dans le filtre de réservation : si ce prix change pendant la préparation, la commande est refusée et les réservations déjà prises sont compensées. Une nouvelle tentative peut alors lire le nouveau catalogue. Les prix de plus de deux décimales ou dépassant la précision sûre du calcul sont refusés, sans modification silencieuse du catalogue.

**Fichiers.** `backend/services/checkoutService.js`, `backend/controllers/orderController.js`, `backend/models/Order.js`, `backend/models/Product.js`, sous `exam1/`.

**Résultats réellement vérifiés.** Un prix client -999 et un total client -1 donnent bien une ligne à **19,99** et un total **59,97** pour trois unités, en réponse et dans MongoDB. Un panier 3 × 0,10 + 1 × 0,20 donne **0,50**. Un produit absent produit 404 sans commande ni mutation de stock. Un changement concurrent du prix du deuxième produit produit 409 et restitue le stock du premier. **4 tests passés** sur base isolée.

**Noms exacts à capturer** dans `02-prices-P1-01-captures.log` :

- `P1-01: forged negative prices and totals are replaced by catalogue prices`
- `P1-01: omitted prices, duplicate lines and cents are calculated on the server`
- `P1-01: catalogue price change during reservation aborts and refunds earlier items`

**Justification jury.** Le client décrit ce qu'il souhaite acheter ; le serveur détermine les prix applicables. Le calcul entier en centimes évite l'accumulation des erreurs décimales dans les additions du panier.

## P1-02 — Stock, concurrence et échecs

**Cause.** Le checkout ne vérifiait ni ne décrémentait le stock. Le microservice répondait « succès » sans écrire en base. Le panier permettait des quantités excessives et mutait aussi son état précédent.

**Choix technique.** La vérification de topologie en lecture seule a confirmé un MongoDB **standalone**, sans transactions multi-documents. La configuration existante n'a pas été transformée en replica set. Le correctif emploie les [écritures atomiques mono-document de MongoDB](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/), un journal durable et des compensations idempotentes. **Il s'agit d'une cohérence avec reprise, pas d'une transaction ACID multi-documents.**

**Correction.**

1. Validation de toutes les lignes et des informations de commande avant réservation : identifiants ObjectId, quantités numériques entières de 1 à 10000, maximum 100 lignes reçues, regroupement des doublons, adresse et méthodes reconnues.
2. Création d'un journal `CheckoutAttempt` contenant le panier serveur, l'identifiant déterministe de future commande et une échéance de réservation de 30 secondes.
3. Pour chaque produit, une seule écriture conditionnelle exige `stock >= quantité`, le prix catalogue attendu et l'absence de réservation identique. Elle applique ensemble le `$inc` négatif et le marqueur de réservation. Le stock ne peut donc pas passer sous zéro à cause de deux acheteurs concurrents.
4. Si toutes les réservations réussissent, le journal passe atomiquement à `committed`, seulement si son échéance n'est pas dépassée. La commande est ensuite matérialisée par upsert sur un identifiant déterministe ; plusieurs reprises ne créent pas plusieurs commandes.
5. Avant cet engagement, un échec entraîne `compensating` : les quantités réservées sont restituées avec une écriture conditionnelle modifiant simultanément le stock et le marqueur. Un rejeu ne rembourse pas deux fois. Un marqueur de clôture empêche aussi une réservation tardive sur une ligne qui n'avait pas encore été réservée.
6. Après engagement, une panne d'écriture de la commande ne rembourse **pas** le stock : le journal contient déjà l'engagement durable et permet de terminer l'enregistrement. Un accusé de réception perdu après engagement suit le même principe.
7. Un worker au démarrage puis toutes les 10 secondes reprend les engagements à matérialiser, les compensations et les réservations expirées. Les marqueurs de clôture ne sont nettoyés qu'après échéance, pour empêcher les écritures tardives. Les écritures du journal, des produits et des commandes utilisent `w: majority, j: true`.

| État interne | Conséquence |
|---|---|
| `reserving` | Stock éventuellement réservé ; aucune commande commerciale encore créée |
| `committed` | Engagement durable ; commande à matérialiser ou déjà matérialisée, aucune compensation de cet achat |
| `completed` | Commande enregistrée, rejeu possible sans nouveau débit de stock |
| `compensating` | Réservations à restituer ; état conservé si la base reste indisponible |
| `failed` | Tentative annulée après compensation, aucune commande commerciale créée |

Le microservice stock utilise le **même** code de réservation et la même base : il authentifie l'appel, exige un `checkoutId` correspondant à une tentative active et vérifie la quantité attendue. Son ancien endpoint `/update-stock` est conservé mais ne renvoie plus un faux succès pour un identifiant arbitraire. La Gateway transmet les appels authentifiés sans fabriquer d'identité privilégiée.

L'administration conserve la mise à jour de stock, y compris zéro ; elle utilise une mise à jour atomique et rejette les fractions. Le panier effectue des copies immuables, borne la quantité au stock connu et désactive les ajouts lorsque le stock vaut zéro. Le backend reste l'autorité quand le catalogue affiché est ancien.

Les nouvelles tentatives frontend portent un `Idempotency-Key`. Un double clic produit un seul appel. La même clé est gardée après une réponse réseau ambiguë ; après un échec explicitement terminal, une nouvelle tentative peut en créer une autre. L'index unique du journal empêche deux traitements indépendants pour la même clé d'un même utilisateur. Un autre panier réutilisant cette clé est refusé en 409. Les clients API sans clé conservent leur contrat de création, mais doivent fournir une clé s'ils veulent garantir l'idempotence de leurs propres rejeux.

**Fichiers.**

- `backend/services/checkoutService.js`, `backend/models/CheckoutAttempt.js` : journal, réservation, compensation, finalisation et reprise.
- `backend/controllers/orderController.js`, `backend/server.js` : intégration au checkout et démarrage du worker.
- `backend/models/Product.js`, `backend/models/Order.js`, `backend/controllers/productController.js` : contraintes et écritures de stock.
- `microservices/stock-management/app.js`, `index.js` : véritable réservation authentifiée.
- `frontend/src/context/CartContext.js`, `pages/Cart.js`, `pages/ProductList.js`, `pages/Order.js`, `services/api.js` : panier et protection des tentatives.

**Résultats réellement vérifiés : 13 tests Node + tests UI correspondants.**

- Dix achats simultanés de la dernière unité : **une seule réponse 201, neuf 409, une commande, stock final zéro, une notification en mémoire**.
- Quantités nulles, négatives, fractionnaires, chaînes, objets et trop grandes : 400 avant réservation.
- Deuxième produit indisponible : premier stock restitué, aucune commande, aucun email.
- Panne injectée pendant réservation : les écritures déjà effectuées sont compensées en base.
- Panne injectée pendant compensation : état durable `compensating`, puis reprise concurrente ; stock restitué exactement une fois.
- Panne injectée après engagement, avant écriture de commande : HTTP 503 et journal `committed`, puis reprise créant exactement une commande sans nouvelle décrémentation.
- Accusé de réception d'engagement perdu : commande finalisée sans remboursement erroné du stock.
- Réservation abandonnée et expirée : compensation, nettoyage des marqueurs et absence de double restitution.
- Écriture tardive après compensation : refusée par le marqueur de clôture.
- Cinq appels avec la même clé : une seule commande et une seule décrémentation ; panier différent avec la même clé refusé.
- Microservice stock testé directement et à travers la vraie route Gateway : authentification, validation, écriture réelle, rejeu sans double débit.
- Worker de démarrage testé sur un état durable d'engagement ; les métadonnées de réservation sont absentes du catalogue public.

**Noms exacts prioritaires à capturer** dans `03-stock-P1-02-captures.log` :

- `P1-02: ten concurrent purchases of the last unit produce exactly one order`
- `P1-02: unavailable second item compensates the first reservation exactly once`
- `P1-02: failed compensation is durable and concurrent recovery never refunds twice`
- `P1-02: committed checkout survives order-write outage and is materialized once`
- `P1-02: ambiguous commit acknowledgement does not refund a committed purchase`
- `P1-02: expired abandoned reservation is recovered and fencing markers are cleaned`
- `P1-02: startup recovery automatically materializes a committed journal without double decrement`
- `P1-02: stock microservice authenticates, validates and reserves real inventory idempotently`

**Justification jury.** Lire le stock puis sauvegarder une nouvelle valeur expose à une course. Le contrôle et la décrémentation doivent être dans la même écriture. Plusieurs produits et une commande nécessitent ici un protocole de reprise : il faut distinguer l'échec avant engagement d'une écriture dont l'accusé a été perdu, sinon on peut rembourser le stock d'une commande réellement acceptée.

## P1-06 — Opérateurs NoSQL dans l'authentification

**Cause.** Des valeurs JSON non typées étaient directement placées dans `findOne`.

**Correction.** Login et inscription contrôlent les types avant toute lecture MongoDB. Aucun objet, tableau ou valeur nulle ne peut servir de username, email ou mot de passe. Le filtre de login contient uniquement une liste de chaînes construite par le serveur pour préserver l'accès aux identifiants existants et accepter leur forme sans espaces périphériques. Un texte ressemblant à un opérateur reste une chaîne littérale, sans sémantique de requête.

Les mots de passe historiques faibles peuvent toujours être utilisés à la connexion : la politique renforcée s'applique à la création/modification du mot de passe, sans modifier les comptes existants. Les traces d'authentification contenant mots de passe, documents utilisateur et JWT ont été retirées du contrôleur remplacé. Les autres constats de journalisation hors de ce contrôleur ne sont pas annoncés corrigés.

**Fichiers.** `backend/controllers/authController.js`, `backend/validation/authValidation.js`, `backend/models/User.js`.

**Résultats.** `$ne`, `$regex`, tableaux, objets et `null` rejetés par 400. Une instrumentation compte **zéro appel à `User.findOne`** pour ces entrées ; les utilisateurs restent inchangés en base. Les requêtes normales utilisent le vrai modèle et le vrai bcrypt. Un compte historique synthétique avec un nom court et un ancien mot de passe faible se connecte toujours, sans changement de son hash. Un utilisateur ordinaire ne peut pas lire les commandes admin. **3 tests passés**.

**Noms exacts à capturer** dans `04-nosql-P1-06-captures.log` :

- `P1-06: NoSQL objects in login fields are rejected before any model query`
- `P1-06: NoSQL objects in registration fields are rejected without reads or writes`
- `P1-06: valid legacy credentials and literal operator-like strings remain safe`

**Justification jury.** La validation intervient avant la construction du filtre. Cela empêche le changement de structure de la requête tout en conservant bcrypt et la vérification JWT existants. Le test initial ne démontrait pas un contournement complet de connexion ; la correction supprime bien l'acceptation des opérateurs constatée.

## P1-07 — Données d'inscription invalides

**Cause.** Les simples champs `required` autorisaient un nom composé d'espaces, un email mal formé et un mot de passe d'un caractère.

**Correction.**

- Username chaîne, normalisé par suppression des espaces périphériques, de 3 à 50 caractères, sans caractères de contrôle.
- Email chaîne, normalisé par trim et minuscules, longueur et syntaxe bornées ; espaces internes, domaines mal formés, points locaux anormaux et caractères de contrôle rejetés. Il s'agit d'une validation de forme, sans vérification de propriété ou de délivrabilité.
- Mot de passe d'au moins 12 caractères, avec majuscule, minuscule et chiffre ; maximum 72 octets UTF-8 pour éviter la troncature silencieuse de bcrypt ; caractères de contrôle interdits.
- Contrôles dans l'API avant requête et validateurs supplémentaires du modèle. Bcrypt conserve son coût 10. Aucun rôle fourni par le client n'est repris.
- Conflits d'email/username et erreurs E11000 convertis en 409, sans mot de passe dans les erreurs. Les index uniques existants protègent les créations concurrentes sur les mêmes valeurs normalisées.
- Formulaire React : champs obligatoires, limites de longueur et contrainte de mot de passe ; les erreurs serveur restent affichées. La validation backend reste indépendante de celle du navigateur.

**Fichiers.** `backend/validation/authValidation.js`, `backend/controllers/authController.js`, `backend/models/User.js`, `frontend/src/pages/Register.js`.

**Résultats.** Les emails invalides, usernames vides/espaces et mots de passe insuffisants sont rejetés par 400 sans ajout d'utilisateur. Une inscription valide et normalisée donne 201 ; hash bcrypt différent du texte, comparaison réussie, JWT signé d'une heure et rôle `user` malgré `role: admin` dans la requête. Quatre créations concurrentes identiques donnent une création et trois conflits 409. Le modèle refuse aussi un document invalide sans passer par la route HTTP. **5 tests Node passés**, plus validation HTML du formulaire dans Jest.

**Noms exacts à capturer** dans `05-registration-P1-07-captures.log` :

- `P1-07: invalid email formats never create a user`
- `P1-07: empty and whitespace-only usernames and weak passwords are rejected`
- `P1-07: valid normalized registration, bcrypt and JWT work without accepting admin role`
- `P1-07: duplicate and concurrent registrations return 409 instead of server errors`
- `P1-07: schema validation independently rejects malformed new users`

**Justification jury.** Le frontend améliore la saisie mais peut être contourné. Le backend doit contrôler les types, formats et longueurs et traduire les erreurs prévues en erreurs client. Le modèle apporte une seconde protection pour les autres chemins de création.

## Revalidation des trois correctifs notifications

Le lanceur final réexécute sans réécriture les tests pertinents de `notifications.test.cjs` pour P0-01, P0-02 et P1-03. Le test historique du checkout qui attendait encore un stock inchangé et ses trois TODO de phase précédente ne sont pas sélectionnés ; leurs fichiers restent intacts. Le nouveau checkout, son stock et le parcours complet jusqu'à la notification mémoire sont vérifiés dans les nouvelles suites métier.

| Anomalie | Résultat revalidé | Nom exact à capturer dans `01-notifications-P0-01-P0-02-P1-03.log` |
|---|---|---|
| P0-01 | Démarrage sans credentials dans les traces ; pas de debug SMTP | `P0-01: real startup does not log credentials; SMTP debugging is disabled` |
| P0-02 | Objets fichier/URL refusés avant envoi et par Nodemailer lui-même | `P0-02: actual Nodemailer refuses file and URL access even if validation is bypassed` |
| P1-03 | Appels non autorisés refusés ; appels autorisés à travers Gateway et vrai client backend acceptés | `P1-03: authorized notifications work directly, through Gateway and through the real backend client` |

Pour montrer les refus détaillés `local path -> 400`, `missing -> 401` et `user JWT -> 401`, ouvrir le log complet : les lignes courtes `*-captures.log` privilégient les groupes de tests.

## Échecs rencontrés puis corrigés

Les premières exécutions finales n'étaient pas toutes vertes et leurs traces restent dans `after/runs/` :

- Un conflit MongoDB sur `updatedAt` apparaissait lors de l'upsert de finalisation, car Mongoose ajoutait son timestamp à un `$setOnInsert` qui le contenait déjà. La finalisation utilise maintenant `timestamps: false` pour cet upsert, avec les dates du document inséré. Les cas nominaux, les pertes d'accusé et les reprises concurrentes ont ensuite passé.
- Le nouvel environnement JSDOM ne fournissait pas `window.crypto`. Le test de double clic fournit un générateur synthétique explicite ; l'application utilise la crypto du navigateur, avec repli sur `getRandomValues` si `randomUUID` n'est pas disponible.
- Le premier lancement du build depuis le répertoire temporaire ne trouvait pas le manifeste frontend. Le lanceur fixe maintenant son CWD au frontend tout en gardant la sortie dans son répertoire temporaire privé.
- ESLint a signalé un paramètre inutilisé dans l'ancien stub de suppression et un `throw` dans le nettoyage `finally` du lanceur. Le paramètre a été retiré sans implémenter la suppression, et le nettoyage refuse un chemin invalide sans masquer une erreur antérieure.

**Dernière exécution : aucun échec restant dans les suites finales, le build, le lint ou la syntaxe.**

## Limites et exploitation locale

1. **Reprise éventuelle, pas atomicité globale instantanée.** Pendant une panne MongoDB, une réservation peut rester temporairement retenue et une commande engagée peut attendre sa matérialisation. Le journal conserve alors la décision à reprendre ; aucun succès HTTP n'est annoncé avant l'enregistrement de la commande. La reprise nécessite un backend actif et une base accessible. Par défaut : échéance 30 secondes, passage toutes les 10 secondes, lots de 100 tentatives. Une charge importante peut allonger ce délai.
2. **Pannes injectées et états d'interruption persistés.** Les tests ont effectué de vraies écritures MongoDB puis injecté des exceptions sur les opérations ciblées. La reprise d'états durables et les appels concurrents ont été testés ; aucune coupure physique de MongoDB, du disque ou de la machine n'a été provoquée. Aucun test de charge de production n'est revendiqué.
3. **Notifications.** Le checkout normal envoie après enregistrement. La livraison réelle Gmail, la révocation du secret côté Google et une garantie d'envoi exactement une fois après crash ne sont pas validées ici. Il n'y a pas d'outbox SMTP durable. Les credentials locaux de l'étape précédente n'ont pas été affichés ou remplacés.
4. **Idempotence du client.** La clé est conservée dans le composant checkout pendant les tentatives et transmise automatiquement. Elle n'est pas persistée après fermeture/rechargement de page. Un client externe doit réutiliser sa propre clé pour identifier un rejeu après une réponse ambiguë.
5. **Cycle de vie après achat.** La compensation couvre les échecs de création. Annulation métier après confirmation, retours, paiement réel et remboursement ne sont pas implémentés par ces sept correctifs. Les autres constats de l'audit, notamment la suppression/validation de commande, certains contrôles de statut, CORS et les alertes de dépendances, ne sont pas annoncés résolus.
6. **Journal et opérations.** La collection `checkoutattempts` conserve les tentatives et les marqueurs produits sont nettoyés après échéance. Une politique de rétention du journal et la supervision des reprises en erreur restent à définir avant exploitation prolongée. Les métadonnées internes sont exclues des réponses catalogue.
7. **Suite frontend historique.** Le test généré « learn react » et son problème d'import Axios ne sont pas corrigés ici. Le lanceur final fournit explicitement la configuration Jest nécessaire aux suites métier, sans modifier les anciens tests ni la configuration du projet. Son résultat ne signifie pas que l'ancien `npm test` a été réparé.
8. **Démarrage habituel.** Relancer localement les processus avec la commande existante pour charger le code corrigé, une fois les captures souhaitées préparées. Le service stock partage désormais la base du backend et utilise `MONGO_URI` ainsi que `NOTIFICATION_SERVICE_TOKEN` déjà présents dans l'environnement racine. S'il est démarré depuis son propre dossier, ces deux noms doivent aussi être fournis dans son environnement ou un `.env` ignoré par Git. Aucun changement de valeur n'était nécessaire pour le lancement depuis la racine. Le worker de reprise est démarré par `backend/server.js` ; il n'est pas démarré par la simple construction d'une application Express de test.

Les fichiers de résultats APRÈS ne contiennent ni credentials réels ni données de comptes existants. Aucun service n'a été déployé et aucun push effectué.

Contrôle final enregistré dans `final/after/safety.json` : sept anomalies validées, 77 fichiers historiques intacts, zéro occurrence détectée des secrets locaux contrôlés dans les nouveaux livrables.
