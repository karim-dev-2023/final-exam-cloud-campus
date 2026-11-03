# Corrections E27/E28 — étape notifications

Date : 3 novembre 2026 (Europe/Paris).

Périmètre autorisé pour cette étape : **P0-01, P0-02 et P1-03 uniquement**. Le code et les tests de cette étape sont terminés. Les corrections prix, stock, filtres NoSQL et inscription attendent une nouvelle autorisation.

Les preuves AVANT, les captures et `AUDIT_E27_E28.md` sont conservés sans modification. Les anciennes sondes attendent volontairement les comportements vulnérables : elles n'ont pas été modifiées pour produire un résultat vert. Elles ne doivent pas être relancées comme tests de correction, car elles écraseraient leur sortie historique.

## Résultats vérifiés

Commande à lancer depuis la racine du workspace :

```powershell
node exam1/tests/run-notifications.cjs
```

| Vérification | Résultat réellement obtenu |
|---|---|
| Tests Node API/serveur | **57 passés, 0 échec, 3 TODO** ; le compteur inclut les sous-tests et leurs groupes |
| Tests Jest frontend de non-régression | **3 passés, 0 échec** |
| Intégrité des preuves AVANT | Aucun fichier de preuve initial modifié, contrôle SHA-256 |
| Syntaxe Node | 12 fichiers vérifiés, aucun échec |
| ESLint sur 9 modules d'application nouveaux/refactorisés | 0 erreur, 0 avertissement, configuration recommandée fournie au processus |
| Email réel | Aucun : transport Nodemailer `streamTransport` en mémoire uniquement |
| Données existantes | Aucun utilisateur, produit ou commande existant modifié |

Les trois TODO représentent explicitement les étapes non autorisées : prix ; stock/concurrence/compensations ; NoSQL/formats d'inscription. Ils ne sont **pas** comptés comme des tests réussis. Le test d'inscription invalide de cette étape couvre les champs obligatoires absents, pas les formats faibles encore acceptés par le code existant.

Les tests HTTP utilisent les vrais serveurs Express et le vrai proxy de Gateway, sur des ports éphémères. Le client backend utilise réellement Axios. Nodemailer construit les messages en mémoire : seul le transport externe est remplacé. Les tests React utilisent les vrais composants avec l'API HTTP simulée. Aucun nouvel outil ni paquet installé, aucun manifeste/verrou npm modifié par cette étape.

## P0-01 — Secret Gmail dans les logs

**Cause.** Une instruction de démarrage affichait directement l'adresse Gmail et `EMAIL_APPLICATION_PASSWORD`. La journalisation brute des erreurs SMTP et des erreurs Axios pouvait également divulguer des informations sensibles, notamment le nouvel en-tête d'authentification interservices.

**Fichiers concernés.**

- `exam1/microservices/notifications/index.js` : démarrage exportable et configuration du transport.
- `exam1/microservices/notifications/app.js` : traitement HTTP et erreurs nettoyées.
- `exam1/backend/controllers/orderController.js` : catch de notification sans sérialisation de l'erreur Axios.
- `exam1/tests/notifications.test.cjs` : tests de démarrage et d'erreur SMTP.

**Correction effectuée.** Suppression du log de credentials et du log du contenu des messages. Désactivation explicite des traces internes SMTP (`logger: false`, `debug: false`). Les erreurs de notification utilisent des messages fixes, sans objet d'erreur contenant credentials, destinataire ou contenu. Le serveur ne journalise au démarrage qu'un message générique. Les autres défauts de journalisation du backend identifiés en P1-04 restent hors de cette étape.

**Tests réalisés et résultat.** Le vrai démarrage `startNotifications` est exécuté avec des credentials synthétiques et un transport mémoire. La capture de son logger ne contient ni adresse, ni mot de passe, ni token interservices. Le test vérifie aussi les options SMTP réelles. Une erreur SMTP synthétique contenant un marqueur sensible et un faux mot de passe produit HTTP 500 sans divulgation dans la réponse ni le logger. Tests passés.

**Capture APRÈS à prendre.** Dans `after/notifications-api.log`, capturer le test `P0-01: real startup does not log credentials; SMTP debugging is disabled` marqué `ok`, ainsi que le test `SMTP failure is controlled...`. Une deuxième capture peut montrer le nouveau `index.js` sans instruction affichant les credentials. Ne pas ouvrir `.env` ou d'anciens logs pour ces captures.

**Justification jury.** Un secret ne doit pas apparaître dans une trace même si l'accès au terminal est limité. Une erreur Axios contient potentiellement la configuration de la requête, dont son en-tête d'authentification : la journaliser brute aurait réintroduit une fuite après ajout de la protection interservices.

**Action externe restant nécessaire.** Le mot de passe applicatif Gmail déjà exposé doit être révoqué dans la sécurité du compte Google, puis remplacé dans `EMAIL_APPLICATION_PASSWORD` dans les environnements concernés. Cette révocation n'a pas été effectuée : aucun accès au compte Google n'a été utilisé. Le correctif de code est validé ; il ne révoque pas l'ancien secret. Les anciens journaux doivent être traités hors du dossier des preuves conservées, avec masquage des copies destinées au jury. Aucune preuve AVANT n'a été supprimée ou modifiée.

## P0-02 — Lecture de fichiers arbitraires via les notifications

**Cause.** Nodemailer accepte un objet de type pièce jointe, notamment `{ path: ... }`, comme corps `text`. Le service transmettait les valeurs JSON sans vérifier leur type. Ce comportement de [Nodemailer est documenté](https://nodemailer.com/message).

**Fichiers concernés.**

- `exam1/microservices/notifications/app.js` : validation et construction explicite des seuls champs autorisés.
- `exam1/microservices/notifications/index.js` : interdiction des accès fichiers/URL au niveau transport.
- `exam1/tests/notifications.test.cjs` : tests des payloads, des limites et du véritable Nodemailer.

**Correction effectuée.** Les champs `to`, `subject` et `text` doivent être des chaînes, sans champs supplémentaires. Un objet `text.path`, un tableau, `null`, `attachments`, `raw` ou une tentative de désactiver la protection sont rejetés en 400 avant l'envoi. Le service borne les tailles : sujet 200 caractères, texte 10000 caractères, corps JSON 32 Kio. Il accepte jusqu'à dix adresses simples séparées par des virgules, contrôle leur forme et interdit les caractères de contrôle dans les destinataires et le sujet. Le texte peut rester multiligne et Unicode, mais pas contenir NUL. La validation porte sur le format et non sur l'existence de la boîte email.

Les options `disableFileAccess: true` et `disableUrlAccess: true` sont fixées au niveau transport **et** dans le message construit côté serveur. Aucun champ avancé du JSON reçu n'est recopié dans le message. Les erreurs de JSON/taille sont retournées en JSON, sans stack.

**Tests réalisés et résultat.**

- 17 payloads invalides testés à la fois directement et via Gateway : 400, sans génération de message.
- JSON incomplet : 400 ; requête de plus de 32 Kio : 413, directement et via Gateway.
- Accès fichier et URL refusés par le vrai Nodemailer configuré comme au démarrage, même en appelant directement son transport sans validation HTTP.
- Notification valide, texte multiligne et liste de destinataires : message MIME généré en mémoire avec les champs attendus.

Le fichier utilisé est exclusivement un fichier canari synthétique dans un répertoire temporaire privé. Aucun fichier sensible lu ni URL externe contactée. Tous les tests ont passé.

**Capture APRÈS à prendre.** Dans `after/notifications-api.log`, capturer `direct: local path -> 400`, `gateway: remote path -> 400`, puis `actual Nodemailer refuses file and URL access even if validation is bypassed`, tous marqués `ok`. Montrer aussi dans `app.js` le contrôle des types et dans `index.js` les deux options d'interdiction. Ces captures attestent le refus avec une identité autorisée ; un simple 401 aurait seulement prouvé l'authentification.

**Justification jury.** Le contrôle de type retire la fonctionnalité dangereuse du contrat d'API ; l'interdiction Nodemailer reste une protection supplémentaire si un autre chemin d'appel contourne un jour la validation. L'authentification seule ne suffirait pas face à un appelant autorisé compromis.

## P1-03 — Notifications accessibles sans authentification

**Cause.** La Gateway et le service acceptaient les appels sans identité interservices. Ajouter un secret seulement dans la Gateway aurait laissé l'accès direct ouvert ; l'injecter automatiquement sur un appel public aurait donné aux appelants anonymes les privilèges de la Gateway.

**Fichiers concernés.**

- `exam1/shared/notificationAuth.js` : contrôle commun du credential.
- `exam1/gateway/routes/notifi.js`, `gateway/app.js`, `gateway/server.js` : contrôle avant proxy et séparation construction/démarrage.
- `exam1/microservices/notifications/app.js`, `index.js` : contrôle direct avant parsing et envoi, démarrage fermé si configuration absente.
- `exam1/backend/services/notificationService.js` : client authentifié utilisé par les commandes.
- `exam1/backend/controllers/orderController.js` : appel du nouveau client à la place de l'appel Axios direct.
- `exam1/backend/app.js`, `backend/server.js` : extraction des routes inchangées pour les tester sans lancer la connexion habituelle à MongoDB.
- `exam1/tests/notifications.test.cjs`, `ui-notifications.test.js`, `run-notifications.cjs` : validation et preuves séparées.
- Les quatre `.env` locaux listés plus bas : ajout de `NOTIFICATION_SERVICE_TOKEN` uniquement.

**Correction effectuée.** Le backend envoie `Authorization: Bearer <secret interservices>`. La Gateway le vérifie puis transmet l'appel ; le service notifications le vérifie à nouveau. Il s'agit d'un credential serveur dédié, indépendant de `JWT_SECRET` et des JWT utilisateur, jamais transmis au frontend.

La comparaison utilise SHA-256 puis [`timingSafeEqual`](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b) sur des buffers de taille fixe. La forme du token est bornée à 43–128 caractères base64url. Si la configuration est absente/invalide, les processus Gateway/notifications refusent le démarrage, sans mode public de secours. Le client backend refuse aussi d'envoyer une requête sans credential valide.

Le service limite les appels authentifiés à 60 par minute et par processus, retourne 429 et `Retry-After` au-delà. Un appel non authentifié ne consomme pas ce quota. Ce compteur local est adapté au déploiement actuel à une instance ; une exécution multi-instance devra partager cette limitation. Les destinataires restent choisis par le backend autorisé ; aucune liste métier supplémentaire n'est inventée à cette étape.

Les appels backend ont un timeout de dix secondes et refusent les redirections pour ne pas transférer le credential à un autre hôte. La Gateway borne aussi l'attente et renvoie une erreur générique si le service est indisponible. Les timeouts SMTP sont configurés. Cela n'implémente pas une file durable, une outbox ou la déduplication des notifications.

**Tests réalisés et résultat.**

- Sans credential, avec mauvais secret, JWT utilisateur ou mauvais schéma d'authentification : 401 directement et via Gateway, aucun message généré.
- Configuration absente/invalide : refus avant création du transport/écoute.
- Token valide à la Gateway mais différent de celui du service : refus par le service, aucun message généré.
- Token valide : HTTP 200 directement, via Gateway et avec le véritable client Axios du backend ; MIME réellement généré en mémoire.
- Dépassement de quota : 429 avec `Retry-After`, puis nouvel envoi permis après la fenêtre simulée.
- Service indisponible : 502 générique sans credential ; redirection backend : destination non contactée.
- Contrat de proxy stock conservé : corps JSON transmis et réponse récupérée depuis une cible de test, sans modifier le microservice stock.

Tous ces tests ont passé.

**Capture APRÈS à prendre.** Capturer dans `after/notifications-api.log` les refus `direct: missing -> 401` et `gateway: user JWT -> 401`, le succès `authorized notifications work directly, through Gateway and through the real backend client`, puis le test de limitation à 429. Le résultat est observé avec transport mémoire ; ne pas envoyer un email réel pour la capture et ne jamais afficher la valeur de l'en-tête Authorization.

**Justification jury.** Les autorisations s'appliquent à chaque point d'entrée, y compris l'accès direct. Le backend conserve son rôle d'appelant autorisé et la Gateway son rôle de proxy ; elle ne transforme pas un appel anonyme en appel privilégié. L'architecture frontend → backend → Gateway → notifications est conservée.

## Variables d'environnement et mise en service locale

Un nouveau secret aléatoire de **32 octets encodés en base64url** a été généré localement puis ajouté sous le nom `NOTIFICATION_SERVICE_TOKEN` avec la même valeur dans :

- `exam1/.env` pour le lancement depuis la racine avec `start:all` ;
- `exam1/backend/.env` pour le lancement depuis le dossier backend ;
- `exam1/gateway/.env` pour le lancement depuis le dossier Gateway ;
- `exam1/microservices/notifications/.env` pour le lancement depuis le dossier notifications.

Sa valeur n'est ni affichée, ni copiée dans les résultats ou captures. Les autres variables présentes ont été comparées avant/après l'ajout et préservées. Les `.env` restent ignorés par Git. Aucun secret de test ne remplace ce credential local : les tests utilisent leurs propres valeurs éphémères, dans un processus ne recevant pas les secrets de l'environnement habituel.

`NOTIFICATION_GATEWAY_URL` est une nouvelle option **facultative** du backend : URL de base de la Gateway, avec le défaut existant `http://localhost:8000`. Elle n'a pas été ajoutée aux `.env` puisqu'aucun changement d'adresse n'était nécessaire. `NOTIFI_SERVICE_URL`, `NOTIFI_PORT`, `EMAIL_USER` et `EMAIL_APPLICATION_PASSWORD` conservent leurs noms et valeurs existants. Aucun nom `REACT_APP_*` ne doit contenir le credential.

Pour une autre machine ou une rotation ultérieure :

1. Générer un nouveau secret aléatoire de 32 octets avec un gestionnaire de secrets ou un outil cryptographique ; conserver son encodage base64url sans espaces.
2. Définir **la même** valeur de `NOTIFICATION_SERVICE_TOKEN` dans les environnements du backend, de la Gateway et du service notifications. Ne pas la mettre dans le frontend, un fichier suivi, la conversation ou une capture.
3. Vérifier les URLs interservices ; conserver localhost dans cet environnement local. Pour des appels sur un réseau distant, utiliser HTTPS ou un canal privé chiffré : un Bearer token ne chiffre pas le transport.
4. Redémarrer les processus avec la commande locale habituelle afin de recharger leur environnement ; aucune relance manuelle des services habituels n'a été exécutée par cette mission.
5. Pour Gmail, révoquer séparément le secret déjà exposé et mettre à jour `EMAIL_APPLICATION_PASSWORD` sans afficher sa valeur. Reprendre ensuite le démarrage local ; l'audit de code ne peut pas attester une révocation côté fournisseur.

Les tests n'ont contacté aucun Gmail/SMTP et n'attestent pas la livraison réelle d'un email après reconfiguration. Ils attestent l'authentification, le routage, la validation et la construction MIME du code corrigé.

## Non-régression et limites de cette étape

Le test backend se connecte explicitement à `127.0.0.1:27017` avec une base nouvelle `e27_notifications_test_<suffixe aléatoire>`. Il ne lit pas `MONGO_URI` pour choisir sa destination. L'instance MongoDB locale est partagée, mais la base et ses collections sont isolées des données existantes. Le code vérifie le nom de base avant toute suppression et ne supprime que cette base générée. La déconnexion et le nettoyage sont effectués en `finally`.

| Parcours | Vérification de cette étape |
|---|---|
| Inscription valide | HTTP 201 et utilisateur réellement enregistré dans la base isolée |
| Inscription sans champs requis | Réponse d'erreur et aucun utilisateur ajouté ; le code retourne encore 500, défaut antérieur non corrigé ici |
| Connexion | bcrypt et JWT réels, signature vérifiée avec clé synthétique |
| Produits | Catalogue réel de la base isolée, HTTP 200 |
| Panier | Tests des vrais composants : ajout, incrément, décrément et retrait, API simulée |
| Commande | HTTP 201 et document réellement enregistré dans la base isolée |
| Montant | 2 articles à 20 donnent 40 sur un parcours nominal ; la résistance à la falsification de prix n'est pas corrigée |
| Stock | Vérification en base : reste à 3 après achat de 2, défaut P1-02 explicitement conservé ; aucun décrément/concurrence/compensation prétendu validé |
| Administration | Sans JWT : 401 ; utilisateur ordinaire : 403 ; compte admin de test : 200 |
| Gateway et notifications | Commande réelle de test → client backend réel → Gateway réelle → service réel → transport mémoire |

Les formats d'inscription faibles, les opérateurs NoSQL et les défauts prix/stock restent ouverts. Les quatre tests UI historiques de l'audit ne sont pas réécrits. La suite officielle frontend conserve son défaut d'import Axios identifié en P2-10 ; les trois nouveaux tests sont exécutés avec une configuration Jest isolée. Le log Jest signale encore les avertissements existants de clé de liste produit, de `act`, de dépendance Babel et de délai de fermeture ; code de sortie 0, sans les présenter comme des correctifs de cette étape. Aucun build React supplémentaire n'a été nécessaire : aucun fichier de l'application frontend n'a été modifié.

Les contrôleurs admin inactifs n'ont pas été réactivés ni adaptés. La route stock conserve son comportement existant. Aucun `npm audit fix`, mise à jour de dépendance, déploiement, git push ou modification de données existantes n'a été effectué.

## Emplacement des preuves et captures

- **AVANT originaux :** `docs/audit-e27-e28/`, `docs/audit-initial/screenshots/`, `docs/AUDIT_E27_E28.md`.
- **Copie ciblée AVANT :** `docs/corrections-e27-e28/notifications/before/notifications.json`.
- **Empreintes AVANT :** `docs/corrections-e27-e28/notifications/before/manifest.json` (sans contenus `.env`).
- **APRÈS API/serveur :** `docs/corrections-e27-e28/notifications/after/notifications-api.log`.
- **APRÈS frontend :** `docs/corrections-e27-e28/notifications/after/frontend-regression.log`.
- **Synthèse et intégrité :** `docs/corrections-e27-e28/notifications/after/summary.json`.
- **Syntaxe / lint :** `after/syntax.json`, `after/eslint.json` dans ce même dossier.

Capture générale conseillée : terminal après `node exam1/tests/run-notifications.cjs`, montrant 57 tests Node passés, 0 échec, 3 TODO et 3 tests React passés. Prendre ensuite les trois captures détaillées décrites dans chaque fiche. Aucun secret, `.env` ou en-tête réel ne doit être visible.

**Arrêt à la fin de cette étape. Les autres anomalies ne seront corrigées qu'après autorisation.**
