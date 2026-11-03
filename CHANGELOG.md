# Changelog

## Non publié — 2026-11-03

Changements locaux de la session E24/E25/E26/E29, sans push ni déploiement.

### Ajouts

- CI GitHub Actions : `npm ci`, MongoDB 7 temporaire, contrôle des fichiers
  sensibles, tests Node/React et compilation, sans secret supplémentaire ni déploiement.
- Lanceur Windows/Linux : environnement de tests isolé et build temporaire
  préservant le build Hostinger existant.
- Logs HTTP JSON minimaux dans les quatre services Express, sans données
  de requête sensibles ; un échec du logger ne change pas la réponse.
- Sondes `/health` dans les quatre services et `/ready` dans le backend et
  le stock, sans accès réseau ni modification de données.
- Sept tests de santé, disponibilité, confidentialité et maintien des réponses.
- README actualisé et bilan des critères avec commandes de vérification.

### Corrections

- Retrait du suivi Git de `exam1/frontend/.env.production`, qui contenait
  uniquement l'URL publique du backend ; copie locale conservée et exception Git retirée.
- Argument Docker public `REACT_APP_API_URL`, local par défaut, pour compiler
  sans dépendre d'un `.env` exclu de l'image.
- URL localhost explicite pour les tests UI historiques dans le lanceur CI.

Les routes métier, JWT, configuration MongoDB, traitements de commandes et
sources du frontend restent inchangés. Les dépendances ne sont pas mises à jour.
