# Bilan E24, E25, E26 et E29 — 3 novembre 2026

Modifications locales uniquement. Aucun commit, push ou déploiement effectué.
La production existante n'a pas été modifiée ni utilisée pour les tests.
Le niveau de couverture ci-dessous décrit les éléments livrés, sans préjuger
de la décision du jury ni d'une validation complète du référentiel.

| Critère | Éléments réellement livrés | Limites |
|---|---|---|
| E24 — CI/CD | Workflow GitHub Actions, Node 22, `npm ci`, MongoDB 7 temporaire, tests Node/React, build et contrôle de secrets ; aucun secret supplémentaire | CI testée localement via son lanceur ; premier run GitHub restant après un futur push autorisé. Aucun CD configuré |
| E25 — Journalisation | Analyse des messages existants ; logs HTTP JSON dans les quatre services, niveau, statut et durée, sans données de requête sensibles ; tests de confidentialité et de résistance aux erreurs du logger | Pas de centralisation, rotation/rétention applicative ni trace distribuée ; logs et rétention Render non consultés |
| E26 — Supervision | Sondes de vie `/health` dans les quatre services et disponibilité `/ready` backend/stock ; tests 200/503 et dépendances absentes | Supervision de base partielle : pas d'alertes, métriques, sonde externe périodique ou preuve de disponibilité historique ; sondes non déployées |
| E29 — Documentation | README d'architecture Hostinger/Render/Atlas, services, URL connues, Compose, tests, procédures de diagnostic, limites, changelog et preuves | URL des services Render internes non inventées ; audits historiques conservés et distingués des résultats actuels |

## Résultat final exécuté

Commande depuis la racine : `node scripts/verify-ci.cjs`.
Exécution finale : **code de sortie 0**.
Preuve : [verification-validated.log](verification-e24-e29/verification-validated.log).

| Suite | Tests réussis |
|---|---:|
| Notification de commande, destinataire configuré | 4 |
| Notifications, sécurité et Gateway, sélection actuelle | 56 |
| Métier actuel, stock, commandes, JWT et inscription | 25 |
| Régressions complémentaires | 11 |
| Observabilité | 7 |
| Régressions UI historiques adaptées à l'environnement local | 8 |
| Tests habituels frontend, 4 suites | 25 |
| **Total** | **136** |

Build frontend : **Compiled successfully**, sans avertissement de compilation,
dans un dossier temporaire. Le build Hostinger existant est préservé.
Les dépendances locales étaient déjà installées ; les installations propres
`npm ci` sont configurées dans le workflow, sans nouvelle installation complète
de tous les packages durant cette session. Aucun lockfile ni version de
dépendance n'a été modifié.

Les tests Node sont exécutés depuis un dossier temporaire avec un environnement
isolé. Ils utilisent uniquement MongoDB sur `127.0.0.1:27017`, des bases de test
aléatoires contrôlées et un transport email simulé. Aucun service réel n'est
démarré par son point d'entrée de production.

Les premières tentatives sont conservées :

- [verification.log](verification-e24-e29/verification.log) : environnement de
  régression UI initialement incompatible et scénario de stock historique obsolète.
- [verification-final.log](verification-e24-e29/verification-final.log) : UI
  corrigée dans le lanceur ; scénario historique de stock encore identifié.
- [verification-validated.log](verification-e24-e29/verification-validated.log) :
  sélection conforme au lanceur existant `exam1/tests/run-complementary.cjs`,
  tous les tests retenus et le build réussissent.

Le scénario exclu de `notifications.test.cjs` attend encore un stock de 3 après
une commande de quantité 2 sur stock initial de 3. La réservation actuelle
produit correctement 1 ; elle est couverte dans `final-business-current.test.cjs`.
Les trois TODO historiques de notifications sont également hors sélection.
Aucune assertion existante ni aucun traitement métier n'a été modifié pour
obtenir un résultat positif. Le lanceur rend explicitement l'URL localhost aux
anciens tests UI qui la vérifient ; les tests frontend habituels et le build
reçoivent l'URL publique Render.

## Autres vérifications

```powershell
node scripts/check-secrets.cjs
node --test exam1/tests/observability.test.cjs
node --check scripts/verify-ci.cjs
node --check scripts/check-secrets.cjs
node --check exam1/shared/observability.js
git diff --check
git diff --cached --check
cd exam1
docker compose config --quiet
```

- Contrôle des secrets : aucun résultat sensible dans les fichiers suivis ni
  les nouveaux fichiers non ignorés. Comparaison en mémoire avec les valeurs
  sensibles des `.env` locaux et motifs de clés privées, URI MongoDB avec
  identifiants, JWT et jetons courants ; aucune valeur sensible imprimée.
- Seuls les modèles `.env.example` sans secret restent suivis.
- `frontend/.env.production` contenait uniquement l'URL publique du backend :
  retrait de l'index Git via `git rm --cached`, copie locale conservée et ignorée.
  **Cette suppression du suivi est déjà dans l'index ; les autres modifications
  ne sont pas indexées. Aucun commit n'a été créé.**
- YAML du workflow analysé avec `js-yaml`, syntaxe des nouveaux modules vérifiée.
- `docker compose config --quiet` : code 0. Docker signale un accès refusé à son
  fichier de configuration utilisateur dans le bac à sable, sans empêcher la
  validation Compose. Aucun build Docker ni redémarrage de conteneur effectué.
- `git diff --check` et `git diff --cached --check` : réussis.
- Les routes métier, l'authentification, les paramètres MongoDB, les contrôleurs
  de commandes et les fichiers `frontend/src/` restent inchangés.

Le scanner est une vérification ciblée du contenu actuel, pas une garantie
universelle de détection ni un audit complet de l'historique Git. L'audit npm
antérieur demeure une limite connue ; aucune correction forcée n'est appliquée.

## Fichiers modifiés ou ajoutés

- `.github/workflows/ci.yml` : CI sans déploiement.
- `scripts/verify-ci.cjs`, `scripts/check-secrets.cjs` : vérification reproductible.
- `exam1/shared/observability.js` : middleware et sondes sans dépendance ajoutée.
- `exam1/backend/app.js`, `exam1/gateway/app.js`,
  `exam1/microservices/notifications/app.js`,
  `exam1/microservices/stock-management/app.js` : branchement de l'observabilité
  avant les routes existantes, sans modification de leurs règles.
- `exam1/tests/observability.test.cjs` : sept tests ciblés.
- `exam1/frontend/Dockerfile` : argument public d'URL, local par défaut, pour
  compiler sans `.env` dans l'image ; aucun changement de source React.
- `exam1/frontend/.gitignore` : retrait de l'exception de suivi `.env.production`.
- `exam1/frontend/.env.production` : retrait du suivi uniquement, copie locale intacte.
- `README.md`, `CHANGELOG.md`, `exam1/frontend/DEPLOYMENT_HOSTINGER.md` : documentation.
- `docs/BILAN_E24_E29.md`, `docs/verification-e24-e29/` : bilan et preuves nouvelles.

## Limites opérationnelles

Les sondes et logs ajoutés ne sont pas encore actifs sur Render. Aucun réglage
de healthcheck Render, webhook de déploiement ou hébergement n'a été changé.
`/health` indique seulement que le processus répond ; `/ready` lit l'état de
connexion Mongoose sans ping actif. La Gateway ne teste pas les services aval
et la sonde SMTP ne garantit pas la délivrabilité. Les procédures de consultation
des logs et diagnostic sont dans le README ; leur exécution en production
et toute activation d'alertes restent à effectuer séparément.
