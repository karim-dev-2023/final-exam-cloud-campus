# Préparation du premier push GitHub

Date : 3 novembre 2026 (Europe/Paris).

Les blocages détectés pendant la préparation ont été corrigés. Ce rapport décrit les modifications et contrôles préalables à la publication. Le résultat du push et la comparaison des SHA local/distant sont confirmés séparément après exécution.

## Dépôt et historique

La racine locale ne contenait initialement aucun dépôt Git. Un dépôt neuf a été initialisé sur `main`, avec le remote fetch/push `origin` : `https://github.com/karim-dev-2023/final-exam-cloud-campus.git`. La lecture initiale des références distantes a réussi sans renvoyer de référence : le dépôt semblait vide.

Deux dépôts imbriqués existaient : `exam1/` sur `development`, sans commit mais avec un index préparé, et `exam1/frontend/` sur `development`, avec le commit `77d13c8` (« Initialize project using Create React App »). Aucun remote n'y était configuré. Le frontend était enregistré comme gitlink dans l'ancien index d'`exam1/`.

Leurs métadonnées ont été déplacées sans suppression vers `.git-preparation/git-backups/exam1.git` et `.git-preparation/git-backups/frontend.git`. Le nouveau dépôt intègre les fichiers ordinaires de `exam1/` et `docs/`. Les anciens index, dont un conserve l'ancien destinataire personnel, et l'ancien historique restent exclusivement dans ces sauvegardes locales. Ils ne sont pas réimportés dans le nouvel historique.

## Configuration du destinataire

Avec autorisation explicite, une seule ligne de `exam1/backend/controllers/orderController.js` a été modifiée : le champ `to` utilise maintenant `process.env.ORDER_NOTIFICATION_EMAIL` à la place de l'adresse personnelle codée en dur.

Le destinataire existant a été transféré dans `exam1/backend/.env`, exclu de Git, pour préserver la configuration locale au prochain démarrage. `exam1/backend/.env.example` documente la variable avec une valeur vide et uniquement des marqueurs pour les secrets. Le README décrit également la configuration. Sans destinataire valide, l'envoi peut échouer, mais une commande créée reste créée, conformément au traitement d'erreur existant.

Sur Render, la nouvelle variable `ORDER_NOTIFICATION_EMAIL` doit être configurée sur le **backend**, avec un destinataire autorisé. Elle s'ajoute aux configurations déjà nécessaires : `MONGO_URI`, `JWT_SECRET`, `NOTIFICATION_SERVICE_TOKEN`, `NOTIFICATION_GATEWAY_URL` et les origines frontend autorisées via `CORS_ORIGINS`. Les identifiants SMTP restent configurés sur le service notifications. Aucun déploiement n'a été effectué.

## Masquage des anciennes preuves textuelles

| Fichier, relatif à `docs/` | Modification |
|---|---|
| `audit-initial/logs/run_backend.log` | 23 JWT complets remplacés par `[JWT_MASQUE_AVANT_PUBLICATION]` ; 10 occurrences d'une adresse personnelle pseudonymisées |
| `audit-initial/logs/run_notifications.log` | 5 occurrences de la même adresse personnelle pseudonymisées |
| `audit-initial/logs/tests_api.log` | 13 valeurs de mots de passe de test remplacées par `[MOT_DE_PASSE_TEST_MASQUE]` |

Les JWT comportaient des rôles utilisateur et administrateur ; leurs champs `exp` indiquaient le 3 novembre 2026 entre 09:48:31 et 09:50:29 UTC. Leur signature n'a pas été validée. L'adresse est remplacée par un alias cohérent sous `example.invalid`. Les codes HTTP, verdicts, erreurs, quantités et nombres de lignes sont conservés. Les empreintes des trois originaux et des copies expurgées ont été vérifiées.

## Examen des PNG et PDF

Les 12 PNG ont été examinés visuellement : dix captures d'audit et deux logos React. Les captures montrent des comptes synthétiques (`ui_user`), une adresse de livraison fictive et des mots de passe déjà masqués. Aucun secret visible supplémentaire n'a été relevé ; ces PNG n'ont pas été modifiés. Les métadonnées textuelles et EXIF des PNG sont également contrôlées avant commit.

Les deux PDF ont été rendus et leurs **42 pages** examinées, avec extraction du texte, des métadonnées, des annotations et recherche de pièces jointes et champs de formulaire. Les originaux ne contenaient aucune pièce jointe ni champ de formulaire interactif.

| PDF | Traitement pour publication |
|---|---|
| `exams/CONSIGNE EXAMEN.pdf` — 35 pages | Masquage de l'identifiant personnel dans les captures des pages 14, 15 et 17 ; coordonnées postales des pages 15, 16 et 17 ; destinataire dans le log et en-tête du message email page 17 ; suppression des métadonnées personnelles d'auteur |
| `exams/Formulaire examen _ pdf a remplir.pdf` — 7 pages | Masquage des deux occurrences de l'adresse Gmail aux pages 1 et 5 ; suppression des annotations de liens et des métadonnées d'origine |

Les PDF publiés sont reconstruits depuis les rendus expurgés : les masques sont intégrés aux pixels, sans couche de texte cachée, ancienne image non masquée, pièce jointe ou ancienne révision permettant de retrouver les données supprimées. Les pages, leurs dimensions et leur ordre sont conservés. Le texte n'est plus sélectionnable et les liens ne sont plus interactifs. Les zones modifiées ont été revues visuellement. Les consignes, écrans métier, montants, confirmations et résultats restent lisibles ; aucun résultat n'a été recréé ou corrigé. Les exemples de secrets manifestement fictifs des consignes restent des exemples pédagogiques.

Les originaux des logs et PDF, ainsi que les fichiers de travail de cette inspection, restent uniquement sous `.git-preparation/`, exclu de Git. Les empreintes et descriptions des masquages, sans les valeurs masquées, figurent dans [redactions.json](github-verification/redactions.json).

## Tests réellement exécutés

Une nouvelle exécution distincte des preuves historiques est conservée dans [github-verification/](github-verification/), avec [summary.json](github-verification/summary.json).

| Vérification | Résultat |
|---|---|
| Tests ciblés du contrôleur et de `ORDER_NOTIFICATION_EMAIL` | 4 réussis : destinataire configuré, rejeu idempotent, échec d'envoi sans annulation de commande, erreur de checkout |
| Tests de sécurité notifications et Gateway sélectionnés | 56 réussis |
| Suite métier actuelle `final-business-current.test.cjs` | 25 réussis |
| Suite complémentaire | 11 réussis |
| Syntaxe de `orderController.js` | Code de sortie 0 |

Total : **96 tests réussis, 0 échec**. Les notifications utilisent un transport mémoire et `orders@example.invalid`. Les suites d'intégration créent et nettoient leurs propres bases de test aux noms aléatoires, distinctes des bases applicatives. L'ancienne régression backend du fichier notifications, qui attend le comportement de stock antérieur aux corrections finales, ne fait pas partie de la sélection ; les commandes et le stock sont vérifiés par la suite métier actuelle.

Les Dockerfiles, le Compose, les corrections de sécurité et les résultats des tests historiques n'ont pas été modifiés. Aucun seeder, envoi réel d'email ou déploiement n'a été lancé.

## Contrôle des éléments publiés

Le `.gitignore` racine exclut les `.env` réels, clés privées, dépendances, builds, données MongoDB, temporaires et tout `.git-preparation/`. Les exemples sans secrets restent admissibles, ainsi que les logs de preuves sous `docs/` après inspection.

Le contrôle textuel compare les fichiers aux secrets des quatre `.env` locaux sans afficher leurs valeurs et recherche notamment JWT complets, clés privées et jetons de fournisseur. Les faux positifs de l'analyse générique ont été examinés : fixtures synthétiques, adresses de documentation et nom de dépendance `jsonwebtoken`. Les anciens index sauvegardés conservent des données sensibles et restent exclus.

Avant commit, les blobs réellement indexés sont contrôlés, avec vérification de l'absence de gitlinks, fichiers secrets, dépendances, builds et sauvegardes. Le contenu indexé doit correspondre aux fichiers inspectés, sous réserve de la normalisation Git des fins de ligne. Le commit initial est ensuite vérifié comme unique commit racine, avec le même arbre que l'index contrôlé, avant le push vers `origin/main`.
