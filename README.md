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
- Les 5 colonnes par défaut : Idée, Script, Tournage, Montage, Publié

**Change le mot de passe admin par défaut dès la première connexion** (via la page "Utilisateurs").

## Fonctionnalités

- Connexion par identifiants (JWT)
- Deux rôles : **Admin** (gère les comptes utilisateurs) et **Utilisateur** (utilise le tableau)
- Tableau Kanban avec colonnes personnalisables (ajout, renommage, suppression, réordonnancement)
- Cartes avec titre, chaîne YTB, personne assignée, priorité
- Glisser-déposer des cartes entre colonnes (Angular CDK)

## Build de production

```bash
cd frontend
npm run build
```

Le résultat est généré dans `frontend/dist/frontend`. Le backend peut ensuite servir ce dossier en statique pour un déploiement mono-processus sur un VPS (étape à mettre en place lors du déploiement).

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
