# Audit complémentaire final — Cloud Campus

Date : 3 novembre 2026 (Europe/Paris).

## Résultat et portée

Les anomalies restantes ont été rapprochées du code actuel, puis les correctifs applicatifs confirmés ont été testés. **108 tests passent : 92 tests Node et 16 tests React/Jest.** Le build React réussit, ESLint serveur et frontend réussissent. Des vulnérabilités de dépendances et des décisions métier restent ouvertes : ce rapport ne constitue pas une autorisation de déploiement.

Périmètre examiné : backend, frontend, Gateway, trois microservices, code partagé, tests, sept manifestes/verrous npm, Compose et rapports/preuves dans `docs/`. Références : `AUDIT_E27_E28.md`, `CORRECTIONS_E27_E28.md`, `CORRECTIONS_E27_E28_FINAL.md`, résultats de `audit-initial/` et `audit-e27-e28/`. Les PDF de consignes ne remplacent pas une spécification métier des annulations et remboursements.

Un travail complémentaire partiel existait déjà, notamment des mises à jour de dépendances et des fichiers `audit-complementaire/before/`. Il a été conservé. Les résultats propres à cette intervention sont dans [audit-complementaire/run-2026-11-03/](audit-complementaire/run-2026-11-03/). Les différences Git comprennent aussi les travaux antérieurs ; elles ne doivent pas toutes être attribuées à cette intervention.

Les tests HTTP et les écritures MongoDB utilisent exclusivement des applications isolées sur ports éphémères et des bases locales à noms aléatoires `complement_test_<hex>` ou `e27_final_test_<hex>`. Les opérations de nettoyage vérifient le nom de la base avant suppression. Aucun accès en écriture aux bases applicatives existantes, aucun email SMTP réel, aucune création de compte réel, aucun push et aucun déploiement. Les identités et clés des tests sont synthétiques. Les processus applicatifs déjà ouverts n'ont pas été redémarrés.

## Inventaire complet de l'audit

« Revalidé » désigne un correctif antérieur dont les tests ont réussi sur les dépendances actuelles. « Corrigé » désigne un changement de cette intervention avec test réussi. Les restrictions sont explicites.

| Fiche | Encore présente au début de cette intervention ? | Résultat vérifié |
|---|---|---|
| P0-01 — secret Gmail dans les logs | Non, correctif antérieur | Revalidé : démarrage synthétique sans fuite ; révocation fournisseur toujours à confirmer. |
| P0-02 — lecture fichier/URL via email | Non | Revalidé : objets refusés et protections Nodemailer vérifiées. |
| P1-01 — prix client faisant autorité | Non | Revalidé : prix catalogue, centimes, produits absents, changement de prix. |
| P1-02 — stock et faux succès | Non | Revalidé : concurrence, compensation, journal durable, reprise et idempotence ; limites métier ci-dessous. |
| P1-03 — notification sans authentification | Non | Revalidé : identité interservices, refus et limitation. |
| P1-04 — JWT/données sensibles journalisés | Partiellement : middleware JWT, URI MongoDB, objets d'erreur Axios | Corrigé sur les chemins applicatifs actifs ; test de non-divulgation password/JWT et tests notifications réussis. Le retrait de l'URI MongoDB est aussi vérifié par lecture du code. Aucun traitement des anciennes copies de logs. |
| P1-05 — dépendances vulnérables | Oui, avec des mises à jour partielles déjà présentes | Mises à jour compatibles et sept audits réalisés ; **79 signalements restent**, dont 14 élevés, zéro critique. Non résolu intégralement. |
| P1-06 — filtres NoSQL | Non | Revalidé : objets refusés avant accès au modèle, connexion historique conservée. |
| P1-07 — inscription invalide | Non | Revalidé : formats, politique de mot de passe, bcrypt, doublons et inscription concurrente. |
| P1-08 — DELETE sans contrôle admin | Oui | Corrigé : utilisateur ordinaire refusé par 403 avant modification. |
| P1-09 — lectures DB sans gestion d'erreur | Oui | Corrigé : lectures catalogue/commandes et mise à jour en panne renvoient du JSON 500 générique ; processus encore disponible ensuite. |
| P2-01 — suppression sans réponse | Oui | Corrigé : archivage persistant des commandes terminées, 204 ; 400/404/409 selon le cas ; rejeu checkout sans recréation visible. |
| P2-02 — validation sans effet | Oui | Corrigé : identifiant URL utilisé, passage persistant en traitement, 404 si absent, rejeu sans nouvel effet. |
| P2-03 — statut arbitraire | Oui | Corrigé : liste fermée, transitions contrôlées et mise à jour conditionnelle avec validateurs. |
| P2-04 — fractions/types/stock | Déjà corrigé pour les quantités et le stock ; identifiant produit invalide encore mal traduit | Complété : identifiant contrôlé avant DB ; matrices entiers/types/limites et zéro passent. Les chaînes décimales entières restent acceptées pour compatibilité avec le formulaire historique. |
| P2-05 — saisie en erreur 500 | Déjà corrigé pour inscription et checkout ; restait sur certaines routes admin | Complété : identifiants et statuts invalides → 400, inexistants → 404, conflit métier → 409 ; inscription et checkout revalidés. |
| P2-06 — détails techniques en erreur | Backend encore concerné ; notifications déjà corrigées | Corrigé : middleware JSON, JSON malformé → 400, corps trop gros → 413, DB → 500 sans stack ni objet d'erreur ; Gateway également équipée. |
| P2-07 — notification sans timeout | Timeout de 10 s déjà présent | Test d'un transport suspendu réussi autour de 10 s. La garantie durable de livraison après crash reste absente. Résolution partielle de la proposition initiale. |
| P2-08 — livraison/paiement affichés mais non conservés | Oui | Corrigé : valeurs initiales `colissimo` et `Carte bancaire` alignées avec les listes ; changements d'options testés. |
| P2-09 — mutation du reducer panier | Non, corrigé avec P1-02 | Revalidé : état gelé inchangé et nouvelle référence ; plafond stock conservé. |
| P2-10 — Jest habituel inutilisable | Oui | Corrigé : mapping CommonJS Axios, remplacement du test « learn react », providers et scénarios réels. Commande npm habituelle réussie. |
| P2-11 — tentatives de connexion illimitées | Oui ; message d'échec uniforme déjà corrigé | Corrigé localement : quotas par IP et compte, 429, Retry-After et retour après expiration testés. Protection multi-instance à définir. |
| P3-01 — champs obligatoires | Inscription déjà corrigée, connexion encore concernée | Complété : connexion obligatoire et bornée, formulaires nommés accessibles ; validation navigateur testée pour les deux. |
| P3-02 — rôle admin local falsifiable | Oui côté interface ; backend déjà protégé | Corrigé : `/api/auth/me` vérifie le JWT serveur avant rendu admin ; rôle local falsifié et refus serveur testés. |
| P3-03 — CORS ouvert | Oui | Corrigé : origines locales explicites par défaut, liste configurable `CORS_ORIGINS` ; origine autorisée/refusée et client sans Origin testés. CORS ne remplace pas JWT. |
| P3-04 — clé produit indéfinie | Non, `_id` déjà utilisé | Rendu catalogue et parcours panier revalidés ; aucune nouvelle correction nécessaire. |

## Corrections applicatives

### Commandes et administration

Fichiers principaux : `backend/controllers/orderController.js`, `backend/routes/orderRoutes.js`, `backend/models/Order.js`, `frontend/src/pages/Admin.js`, `frontend/src/services/adminApi.js`.

La validation et le changement de statut partagent la même logique. Les valeurs acceptées restent celles de l'enum existant :

| Départ | Arrivées autorisées |
|---|---|
| En attente | En cours de traitement, Annulée |
| En cours de traitement | Expédiée, Annulée |
| Expédiée | Délivrée |
| Délivrée / Annulée | Aucune autre valeur |

Renvoyer le même statut est sans effet et répond 200. Le filtre de mise à jour contient le statut lu et l'absence d'archivage : une modification concurrente incompatible renvoie 409. `runValidators: true` est activé. Les identifiants incorrects sont refusés avant requête DB. Les anciens statuts inconnus ne sont pas migrés automatiquement.

DELETE est réservé aux administrateurs et aux commandes `Délivrée`/`Annulée`. Il renseigne `deletedAt` et retire la commande des listes administratives. **C'est une suppression logique, pas un effacement physique des données personnelles.** Cette décision préserve le document référencé par le journal de checkout : une reprise ou une même clé d'idempotence ne recrée pas une commande visible ni ne débite à nouveau le stock. Le test passe par un vrai checkout, un archivage et un rejeu, sur MongoDB de test.

L'interface affiche les transitions autorisées, utilise le document réellement renvoyé, permet l'archivage des commandes terminées et traite les erreurs de chargement/actions. Le stock nul est accepté ; les fractions sont refusées. Les détails de commande restent consultables. Les contrôleurs admin non montés réutilisent désormais les contrôleurs corrigés ; ces routes alternatives n'ont pas été activées et ne sont pas présentées comme un parcours HTTP testé.

### Sécurité, validation et erreurs

Le middleware JWT exige un en-tête Bearer correct, vérifie la signature avec HS256 explicitement, l'expiration, l'identifiant et le rôle attendus. Les jetons expirés, signés avec une autre clé, d'un autre algorithme ou sans claims requis sont refusés. Le rôle administrateur est contrôlé sur DELETE, listes et mises à jour. Le rôle fourni à l'inscription continue d'être ignoré.

Le JWT et l'URI MongoDB ne sont plus journalisés. Les erreurs Axios complètes ont été retirées des logs frontend car leur configuration peut contenir en-têtes et identifiants. Les réponses techniques restent génériques. Un test capture les logs avec mot de passe et jetons synthétiques et vérifie leur absence ; les tests existants couvrent aussi les erreurs SMTP. Les anciennes traces n'ont pas été réécrites.

Le middleware d'erreur partagé normalise les erreurs de parsing, taille, validation/cast, conflit et serveur. Les lectures asynchrones transmettent leurs erreurs à Express au lieu de laisser une promesse rejetée sans réponse. Le proxy stock exige aussi l'identité interservices, borne l'attente à 10 s et remplace les erreurs de proxy par une réponse générique.

Le backend autorise par défaut `http://localhost:3000` et `http://127.0.0.1:3000`. `CORS_ORIGINS` accepte une liste séparée par virgules ; aucun fichier de secrets n'a été modifié pour la renseigner. Une origine inconnue ne reçoit pas d'en-tête d'autorisation CORS. Les clients sans Origin conservent les mêmes contrôles d'accès.

La limitation d'authentification utilise 30 requêtes par minute par source et identité, avec un nombre de buckets borné. Elle protège aussi l'inscription. Les quotas ne sont pas partagés entre processus et repartent au redémarrage. Les tests métier utilisent un plafond explicitement augmenté dans leur application isolée ; le test dédié vérifie le véritable middleware avec un plafond réduit et une horloge contrôlée. La logique n'est pas désactivée en production ni conditionnée à `NODE_ENV=test`.

Les choix correspondent aux recommandations officielles sur les [erreurs Express](https://expressjs.com/guide/error-handling/), la [sécurité Express](https://expressjs.com/advanced/best-practice-security/) et les [limites de CORS](https://expressjs.com/en/resources/middleware/cors/).

## Dépendances

Commandes exécutées dans les sept périmètres : `npm.cmd audit --json --ignore-scripts` et `npm.cmd update --ignore-scripts --no-audit --no-fund`. Le frontend a aussi reçu `npm.cmd audit fix --ignore-scripts --no-fund`, **sans `--force`**, sans disparition des alertes résiduelles. Aucun script d'installation n'a été exécuté.

Les plages majeures ont été conservées. React Router est passé de la plage très restrictive `6.4` à `^6.30.0` et la version installée est 6.30.6. React reste en 18.3.1 et React Scripts en 5.0.1. Exemples de versions finales : Express 4.22.3, Axios 1.21.0, Mongoose 8.24.8, jsonwebtoken 9.0.3, express-http-proxy 2.1.2 et Nodemailer 6.10.1. Détails : [versions.json](audit-complementaire/run-2026-11-03/versions.json).

Conformément au fonctionnement documenté de [npm update](https://docs.npmjs.com/cli/update.html/), les mises à jour ordinaires respectent les plages des manifestes. Les propositions de changement majeur ou de remplacement par `react-scripts@0.0.0` ont été laissées de côté.

| Périmètre | Faibles | Modérées | Élevées | Critiques | Total |
|---|---:|---:|---:|---:|---:|
| Racine | 0 | 3 | 0 | 0 | 3 |
| Backend | 0 | 0 | 0 | 0 | 0 |
| Frontend | 11 | 51 | 13 | 0 | 75 |
| Gateway | 0 | 0 | 0 | 0 | 0 |
| Auth-gateway | 0 | 0 | 0 | 0 | 0 |
| Notifications | 0 | 0 | 1 | 0 | 1 |
| Stock-management | 0 | 0 | 0 | 0 | 0 |
| **Total** | **11** | **54** | **14** | **0** | **79** |

Ce sont des signalements de paquets, avec propagation aux parents et doublons entre projets, pas 79 exploitations démontrées. L'audit initial indiquait 108 signalements dont 11 critiques. Au début de cette intervention, après des mises à jour partielles antérieures, les audits donnaient déjà zéro critique et 80 signalements : il serait incorrect d'attribuer toute la différence à cette seule intervention. Les avis et catégories peuvent évoluer dans le registre.

Les sept JSON finaux et leurs chaînes `via`, `effects`, `nodes`, `range`, `fixAvailable` sont conservés dans [after/](audit-complementaire/run-2026-11-03/after/). L'[inventaire résiduel](audit-complementaire/run-2026-11-03/dependencies-remaining.md) donne chaque paquet et les liens de tous les avis directs.

- Racine : `minimatch`, `nodemon`, `npm-run-all`, outils de développement. Les propositions npm impliquent notamment des rétrogradations incompatibles ; aucun override majeur transitive imposé.
- Frontend : plusieurs alertes concernent la chaîne CRA/Jest/Webpack/SVGO et le serveur de développement. D'autres concernent le runtime, notamment React Router. Comme React Scripts et les bibliothèques de test sont déclarés dans `dependencies`, les 75 alertes ne peuvent pas être décrites globalement comme exclues de production. L'exploitabilité du bundle statique final n'a pas été établie pour chaque avis.
- Notifications : Nodemailer 6.10.1 reste vulnérable selon le registre. Les avis incluent DoS du parseur d'adresses, contournements d'accès fichier/URL et problèmes SMTP/TLS selon les options. L'API actuelle impose une identité interservices, des chaînes bornées et une liste fermée de propriétés ; les options `raw`, `envelope`, OAuth2, tableaux structurés et transports arbitraires ne sont pas exposés au client. Ces protections ne remplacent pas une migration du paquet. Npm propose actuellement Nodemailer 10.3.1, changement majeur non appliqué.

## Vérifications exécutées et preuves

Dernière exécution complète : [summary.json](audit-complementaire/run-2026-11-03/tests/runs/2026-11-03T11-27-50-589Z/summary.json). Chaque log contient les assertions réellement exécutées et son code de sortie est enregistré.

| Vérification | Résultat |
|---|---|
| Notifications P0-01/P0-02/P1-03, Gateway | 56 tests réussis |
| Prix P1-01 | 4 tests réussis |
| Stock P1-02, concurrence et reprise MongoDB | 13 tests réussis |
| NoSQL P1-06 | 3 tests réussis |
| Inscription P1-07, doublons et vrai bcrypt | 5 tests réussis |
| Complément sécurité/commandes/erreurs/timeout/logs | 11 tests réussis |
| Régression React E27/E28 existante | 8 tests réussis, 2 suites |
| Suite frontend habituelle réparée | 8 tests réussis, 1 suite |
| Build React | Compilation réussie, sortie temporaire privée |
| ESLint serveur | 27 fichiers, zéro erreur, zéro avertissement |
| ESLint frontend | Code 0 |
| Syntaxe Node étendue | 43 fichiers, zéro échec ; [syntax-all.json](audit-complementaire/run-2026-11-03/syntax-all.json) |
| Intégrité des historiques | Contrôle SHA-256 de 208 fichiers ; [safety.json](audit-complementaire/run-2026-11-03/safety.json) |

La commande `CI=true npm.cmd test -- --watchAll=false --runInBand --no-cache` a aussi été lancée directement depuis `exam1/frontend`, avec journal distinct [npm-test-usual.log](audit-complementaire/run-2026-11-03/npm-test-usual.log). Les mocks y limitent Axios aux identités et produits synthétiques.

Le lanceur [run-complementary.cjs](../exam1/tests/run-complementary.cjs) écrit exclusivement dans le nouveau dossier complémentaire et conserve ses exécutions successives. Il ne lance pas les anciens générateurs de preuves AVANT/APRÈS. `final-business-current.test.cjs` reprend les assertions métier antérieures avec seulement un plafond d'authentification adapté au volume de leur serveur partagé ; le fichier original reste intact. Les tests complémentaires sont dans `complementary.test.cjs` ; les tests habituels sont dans `frontend/src/App.test.js`.

Les premiers essais complémentaires ont échoué : plafond partagé atteint par les tests d'inscription, encodage des accents dans des fichiers générés, JSX admin incorrect et règles ESLint Testing Library. Ces problèmes ont été corrigés, puis la suite complète a été relancée. Leurs traces restent dans le nouveau dossier `tests/` et ses `runs/`. Les tests React existants émettent encore des avertissements de dépréciation `act` ; leur code de sortie est 0. Aucun test en échec n'est présenté comme une validation.

Rejeu depuis la racine du workspace, avec un MongoDB local disponible sur 127.0.0.1:27017 :

```powershell
node exam1/tests/run-complementary.cjs
node exam1/tests/verify-complementary.cjs
```

Ces tests créent puis nettoient leurs bases de test. Ne pas lancer `seeder.js` pour vérifier l'audit : ce script peut réinitialiser les produits applicatifs.

## Vulnérabilités restantes et décisions avant déploiement

1. **Dépendances élevées non résolues.** Décider puis tester une migration Nodemailer et une modernisation de CRA/son outillage ; évaluer aussi les avis runtime React Router. Les 79 alertes résiduelles doivent faire l'objet d'une décision documentée. Aucun « zéro vulnérabilité » global n'est revendiqué.
2. **Secret Gmail précédemment exposé.** Confirmer sa révocation/remplacement côté fournisseur et le traitement des copies de logs hors de ce workspace. Aucune valeur réelle n'a été affichée ou remplacée ; les preuves historiques sont conservées.
3. **Annulation, retours et remboursement.** Le statut Annulée est terminal mais ne rembourse pas un paiement et ne réapprovisionne pas automatiquement. L'archivage ne change pas le stock. Définir le moment métier d'une restitution et son idempotence avant d'activer ces opérations comme un véritable processus de remboursement/retour. Les compensations d'échec de création restent celles du correctif P1-02 testé.
4. **Conservation des commandes.** L'archivage garde les données et le journal pour empêcher la recréation. Définir une durée légale/métier de conservation et une éventuelle anonymisation coordonnée avec le journal avant exploitation réelle ; aucune migration ni purge de données existantes n'a été effectuée.
5. **Notifications.** Le timeout est testé, mais aucune outbox durable ni garantie de livraison après crash n'existe. La destination marchande reste constante dans le code antérieur ; confirmer son habilitation et décider si un email client était attendu. Aucun email réel n'a été envoyé. Gmail et la délivrabilité ne sont pas validés.
6. **Plusieurs instances et identité.** Les quotas en mémoire doivent être remplacés/complétés par un dispositif partagé à l'edge ou un stockage commun. Ne pas activer aveuglément `trust proxy`. Les rôles sont signés dans les JWT et ne sont pas relus en base à chaque appel : une révocation/changement de rôle n'est pas immédiat avant expiration (une heure). Définir une politique de révocation si nécessaire. Le stockage actuel dans localStorage reste exposé à un éventuel XSS ; aucun XSS exploitable n'a été démontré ici.
7. **Configuration de production.** Définir les origines CORS et les URLs frontend/backend, encore basées sur localhost. Valider TLS, accès réseau et authentification MongoDB dans l'environnement cible. Aucun secret de production n'a été inspecté pour attester cette configuration.
8. **Docker et architecture.** Aucun Dockerfile n'est fourni alors que Compose utilise `build`; ports notifications/stock différents des valeurs du code, Gateway absente du Compose, configuration JWT/interservices non fournie. Compose n'est donc pas livré comme une chaîne de déploiement validée. Le service auth-gateway reste vide et sa route proxy inactive ; l'authentification effective reste le backend. Aucun lancement Compose ni modification de conteneur existant.
9. **Reprise et exploitation.** Définir rétention, supervision et alertes sur le journal de checkout ; valider charge et pannes réelles dans un environnement dédié. Les tests vérifient des écritures MongoDB réelles et des pannes injectées, pas un incident physique ni une architecture distribuée de production.
10. **Limites de preuve.** Pas de test navigateur complet contre les services existants, pas de paiement réel, pas de livraison SMTP réelle, pas d'audit distant ou de test de production. Les contrôles de syntaxe, mocks et tests isolés ne prouvent pas ces scénarios.

Les sept corrections prioritaires antérieures restent couvertes par leurs tests. Leurs preuves AVANT/APRÈS n'ont pas été remplacées par les résultats complémentaires.
