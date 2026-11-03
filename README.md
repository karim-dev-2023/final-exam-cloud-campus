# Cloud Campus — projet d'examen Cloud

Application de commerce avec catalogue, panier, authentification JWT, commandes et administration. Le frontend React appelle une API Express ; une passerelle interne transmet les notifications et les réservations de stock aux microservices.

## Organisation et architecture

| Chemin | Rôle |
|---|---|
| `exam1/frontend/` | React, React Router, Tailwind ; fichiers statiques servis par nginx dans Docker |
| `exam1/backend/` | API Express, authentification, produits et commandes, modèles Mongoose |
| `exam1/gateway/` | Passerelle HTTP vers notifications et stock |
| `exam1/microservices/notifications/` | Envoi d'emails via Nodemailer |
| `exam1/microservices/stock-management/` | Réservation du stock dans MongoDB |
| `exam1/shared/` | Authentification interservices et gestion d'erreurs partagées |
| `exam1/tests/` | Vérifications API, métier, sécurité et interface |
| `docs/` | Consignes d'examen, audits, corrections et preuves de vérification |

```text
Navigateur → frontend nginx :3000
           → backend Express :5000 → MongoDB (exam1Db)
                → gateway :8000 → notifications :4002
                                → stock-management :4003 → MongoDB
```

Le navigateur appelle actuellement `http://localhost:5000/api`. Les ports 4002 et 4003 sont internes au réseau Compose et les appels interservices exigent un jeton partagé. Le service `auth-gateway` est un emplacement vide, non déployé.

## Démarrage local avec Docker

Prérequis : Git, Docker Engine avec Docker Compose, ports hôtes 3000, 5000, 27018 et 8000 disponibles. Les images installent leurs propres dépendances Linux ; il n'est pas nécessaire d'installer les dépendances npm sur Windows pour ce démarrage.

1. Cloner le dépôt, puis se placer dans `exam1/` :

   ```powershell
   git clone https://github.com/karim-dev-2023/final-exam-cloud-campus.git
   cd final-exam-cloud-campus/exam1
   ```

2. Créer les quatre fichiers locaux ci-dessous. Ils sont exclus de Git. Générer deux secrets distincts avec un gestionnaire de secrets ou, si Node.js est disponible, exécuter deux fois `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`. Utiliser l'un pour `JWT_SECRET`, l'autre pour `NOTIFICATION_SERVICE_TOKEN`. Recopier le **même jeton interservices** dans les quatre fichiers. Ne pas conserver les marqueurs entre chevrons.

   | Fichier | Variables requises pour Compose |
   |---|---|
   | `exam1/.env` | `NOTIFICATION_SERVICE_TOKEN=<jeton-interservices>` |
   | `exam1/backend/.env` | `JWT_SECRET=<secret-jwt>`, `NOTIFICATION_SERVICE_TOKEN=<jeton-interservices>` et `ORDER_NOTIFICATION_EMAIL=<destinataire-autorise>` |
   | `exam1/gateway/.env` | `NOTIFICATION_SERVICE_TOKEN=<jeton-interservices>` |
   | `exam1/microservices/notifications/.env` | `NOTIFICATION_SERVICE_TOKEN=<jeton-interservices>`, `EMAIL_USER=<compte-smtp>` et `EMAIL_APPLICATION_PASSWORD=<mot-de-passe-application>` |

   Chaque variable occupe une ligne `NOM=valeur`. Le transport utilise Gmail : prévoir un compte de test avec un mot de passe d'application pour les vrais envois. Éviter les identifiants personnels. Compose fournit les ports, les URL internes et `MONGO_URI`. Le jeton interservices doit comporter de 43 à 128 caractères base64url. `CORS_ORIGINS` est facultatif dans le backend ; par défaut, les origines locales du frontend sur le port 3000 sont autorisées.

   Le modèle [backend/.env.example](exam1/backend/.env.example) contient uniquement des marqueurs sans secret et un destinataire vide. `ORDER_NOTIFICATION_EMAIL` désigne le destinataire des notifications de commande ; sans adresse valide, la commande reste créée mais l'envoi échoue. Sur Render, ajouter cette nouvelle variable au **service backend**, avec une adresse autorisée, en plus des variables déjà requises. Le service notifications conserve ses propres identifiants SMTP. Aucun déploiement Render n'est effectué ici.

3. Construire et démarrer :

   ```powershell
   docker compose config --quiet
   docker compose build
   docker compose up -d
   docker compose ps
   ```

   Si le port 8000 est occupé, lancer `$env:GATEWAY_HOST_PORT='8080'` avant `docker compose up -d`. Cela ne change pas le port interne du Gateway.

4. Ouvrir [le frontend](http://localhost:3000) et vérifier [le catalogue JSON](http://localhost:5000/api/products). La base Docker neuve peut répondre `[]`. MongoDB est publié sur le port hôte 27018 et conserve ses données dans le volume `exam1_mongo-data`.

5. Arrêter la stack avec `docker compose down`. Le volume est conservé. Ne pas utiliser `down -v` pour un arrêt habituel.

Le script `backend/seeder.js` peut réinitialiser les produits : il ne fait pas partie du démarrage et nécessite une vérification de la base cible avant toute exécution. Le MongoDB local éventuellement présent sur le port 27017 est distinct de celui de Compose.

## Vérifications et preuves

Consulter les commandes exécutées et leurs résultats dans [la vérification Docker](docs/VERIFICATION_DOCKER.md), [l'audit complémentaire](docs/AUDIT_COMPLEMENTAIRE_FINAL.md) et [les corrections E27/E28 finales](docs/CORRECTIONS_E27_E28_FINAL.md). Les dossiers de preuves conservent aussi les échecs et les tentatives historiques : ils ne constituent pas tous un résultat final positif.

Les 96 tests de préparation GitHub ont réussi : [résumé de l'exécution](docs/github-verification/summary.json). Les masquages effectués pour publication sont décrits dans [le rapport de préparation](docs/PREPARATION_GITHUB.md) ; les codes HTTP, résultats et erreurs des preuves historiques n'ont pas été modifiés.

## Limites actuelles

Les URL frontend en `localhost` sont adaptées à la démonstration locale. Un hébergement nécessite une configuration d'URL ou un reverse proxy, ainsi qu'une gestion adaptée des secrets. Les dépendances restantes et les limites Docker sont documentées dans les audits. Aucun déploiement n'est effectué par ces instructions.
