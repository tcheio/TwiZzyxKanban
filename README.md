# TwiZzyxKanban

Kanban pour le suivi de projets YouTube : un tableau global avec colonnes personnalisables, cartes (titre, chaîne YTB, assigné, priorité), comptes utilisateurs avec rôles Admin / Utilisateur.

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
- Deux rôles : **Admin** (gère les comptes utilisateurs) et **Utilisateur** (utilise le tableau)
- Tableau Kanban avec colonnes personnalisables (ajout, renommage, suppression, réordonnancement)
- Cartes avec titre, chaîne YTB, personne assignée, priorité
- Glisser-déposer des cartes entre colonnes (Angular CDK)

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
