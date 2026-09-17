# TwiZzyxKanban

Kanban pour le suivi de projets YouTube, multi-tableaux : chaque kanban a ses propres colonnes,
tags, EPICs et membres, avec comptes utilisateurs à rôles globaux (Admin / Utilisateur) et un rôle
de modérateur par kanban.

Assisté de l'IA
## Stack

- **Frontend** : Angular 21 (standalone components), Angular CDK (drag & drop)
- **Backend** : Node.js + Express
- **Base de données** : SQLite (fichier unique, via `better-sqlite3`)

## Prérequis

- Node.js ≥ 20

## Installation

```bash
cd backend
npm install
cp .env.example .env   # puis modifie JWT_SECRET et DEFAULT_ADMIN_PASSWORD

cd ../frontend
npm install
```

Génère un secret JWT aléatoire avec :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Lancer en développement

Terminal 1 — backend (port 3000) :

```bash
cd backend
npm run dev
```

Terminal 2 — frontend (port 4200, proxy `/api` vers le backend) :

```bash
cd frontend
npm start
```

Ouvre http://localhost:4200.

### Compte par défaut

Au premier démarrage, le backend crée automatiquement :
- Un compte admin (`DEFAULT_ADMIN_USERNAME` / `DEFAULT_ADMIN_PASSWORD` dans `.env`, par défaut `admin` / `admin123`)
- Les 6 colonnes par défaut : 💡Idées, 📝Préparation/Écriture, 🎥Tournage, 🎬Montage, 🖼️Miniature, ✅Publié

**Change le mot de passe admin par défaut dès la première connexion** (via la page "Utilisateurs").

## Fonctionnalités

- Connexion par identifiants (JWT)
- **Multi-kanban** : plusieurs tableaux indépendants, chacun avec ses membres et un rôle
  modérateur dédié (en plus des rôles globaux Admin / Utilisateur)
- Tableau Kanban avec colonnes personnalisables (ajout, renommage, suppression, réordonnancement)
  et glisser-déposer des cartes (Angular CDK), avec tri combinable (nom, priorité, échéance, tag, EPIC)
- Tickets avec titre, description (éditeur riche : gras/italique/couleurs/liens/listes), priorité,
  échéance, statut, et clonage/liens entre tickets
- **Tags et EPICs** personnalisables (couleur + émote optionnelle, scannée automatiquement depuis
  `frontend/public/emote/` sans toucher au code) ; un ticket peut avoir plusieurs tags à la fois
- **Multi-responsables** par ticket (un principal + des additionnels), avec historique des
  changements d'assignation et raison obligatoire à chaque ajout/retrait
- Commentaires, pièces jointes (images) et recherche globale
- **Dark mode** à 4 modes (Jour / Nuit / Système / Horaire 8h-19h), couleurs centralisées dans
  `frontend/src/styles.css`
- **Notifications** : chaque responsable d'un ticket est notifié des changements de tag, de
  responsable, de statut et des nouveaux commentaires
- **Annonces** : bandeau d'avertissement dans la navbar, gérable sans coder (page "Annonces",
  réservée aux admins), scopé à toute l'application ou à un kanban précis
- Pages d'administration : gestion des comptes utilisateurs et des annonces (réservées aux admins)

## Déploiement mono-processus (production / Minestrator)

En développement, backend et frontend tournent séparément (voir plus haut). En production, un seul
processus Node suffit : le backend sert l'API **et** le build Angular en statique
(`backend/src/app.js` détecte `frontend/dist/frontend` et retombe sur `index.html` pour toute route
non-API, afin que le routing Angular fonctionne après un rafraîchissement navigateur).

Le point d'entrée est le `server.js` à la racine du dépôt : il lance `backend/src/server.js` en
sous-processus, en normalisant le port d'écoute (`PORT`, sinon `SERVER_PORT`, sinon
`MINESTRATOR_PORT`, sinon `3000`) — utile car certains panels d'hébergement (type Minestrator)
injectent `SERVER_PORT` plutôt que `PORT`.

### Tester le mode mono-processus en local

```bash
npm install   # à la racine : installe backend + frontend, puis build le frontend (postinstall)
npm start     # lance server.js -> backend + frontend servis sur un seul port (3000 par défaut)
```

Ouvre http://localhost:3000 (tout est servi par ce seul port, API comprise).

Après toute modification du code (backend ou frontend), relance `npm run build` (à la racine) pour
regénérer `frontend/dist/frontend` avant de relancer `npm start`.

### Déployer sur Minestrator

1. Pousser le dépôt sur le panel (ou le connecter via Git).
2. Configurer les variables d'environnement du backend (`JWT_SECRET`, `DEFAULT_ADMIN_USERNAME`,
   `DEFAULT_ADMIN_PASSWORD`, etc. — voir `backend/.env.example`) directement dans les variables
   d'environnement du panel, ou via un fichier `backend/.env`.
3. Commande d'installation : `npm install` (à la racine — déclenche le build complet via
   `postinstall`).
4. Commande de démarrage : `npm start` (ou `node server.js`).
5. Le panel route son port externe vers la variable `SERVER_PORT` (ou `PORT`) : `server.js` la
   détecte automatiquement et la transmet au backend.

## Structure du projet

```
backend/   API Express + SQLite
frontend/  Application Angular
```

Voir le code source pour le détail des routes API (`backend/src/routes/`) et des pages (`frontend/src/app/pages/`).

## Tests

```bash
cd backend
npm test    # node:test + supertest, toutes les routes de l'API

cd frontend
npm test    # Vitest, composants/guards/services
```

## CI/CD

Chaque pull request vers `main` déclenche `.github/workflows/ci.yml` :

| Job | Vérifie |
|---|---|
| Backend - Tests | `npm test` (backend) |
| Backend - Démarrage réel | le serveur démarre avec une vraie config (`.env`, SQLite) et répond sur `GET /api/health` |
| Frontend - Tests | `npm test` (frontend) |
| Frontend - Build | `npm run build` (frontend) |
| CI Status | agrège les 4 jobs précédents — c'est le check requis par GitHub |

La branche `main` est protégée : si un de ces jobs échoue, le bouton de merge reste bloqué sur la PR.
