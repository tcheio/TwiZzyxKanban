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
- **Multi-kanban** : plusieurs tableaux indépendants, chacun avec ses propres membres, colonnes,
  tags et EPICs, et un rôle modérateur dédié par kanban (en plus des rôles globaux Admin /
  Utilisateur). Création à partir d'un **template** : `video` (colonnes de production standard),
  `video_derush` (identique, avec la colonne Montage déjà divisée en Derush/Montage) ou `basique`
  (À faire / En cours / Fait)
- Tableau Kanban avec colonnes personnalisables (ajout, renommage, suppression, réordonnancement)
  et glisser-déposer des cartes (Angular CDK), avec filtres combinables (responsable, tag, EPIC,
  recherche texte) et tri combinable (nom, priorité, échéance)
- **Colonnes restreintes** : une colonne peut être marquée visible uniquement par les modérateurs
  du kanban et les responsables des tickets qu'elle contient (ex: la colonne "Idées", restreinte
  par défaut dans les templates vidéo)
- **Colonnes divisées en 2 états** : n'importe quelle colonne peut être scindée en 2 sous-listes
  nommées (ex: "Derush" / "Montage"), affichées comme 2 mini-colonnes empilées à l'intérieur d'une
  seule colonne, avec leur propre ordre de cartes
- **Déplacement de ticket restreint** : changer le statut d'un ticket (colonne, état, annulation)
  est réservé aux modérateurs du kanban et aux responsables du ticket ; un changement fait par un
  responsable non modérateur notifie automatiquement les modérateurs
- Tickets avec titre, description (éditeur riche : gras/italique/couleurs/liens/listes), priorité,
  échéance (mise en évidence si proche), statut (avec annulation/restauration), et clonage/liens
  entre tickets. Les tickets publiés restent visibles 14 jours puis se masquent automatiquement
- **Tags et EPICs** personnalisables (couleur + émote optionnelle, scannée automatiquement depuis
  `frontend/public/emote/` sans toucher au code) ; un ticket peut avoir plusieurs tags à la fois
- **Multi-responsables** par ticket (un principal + des additionnels), avec historique des
  changements d'assignation et raison obligatoire à chaque ajout/retrait
- Commentaires, pièces jointes (images) et recherche globale (scopée aux kanbans dont on est membre)
- **Dark mode** à 4 modes (Jour / Nuit / Système / Horaire 8h-19h), couleurs centralisées dans
  `frontend/src/styles.css`
- **Notifications** : chaque responsable d'un ticket est notifié des changements de tag, de
  responsable, de statut et des nouveaux commentaires ; les modérateurs sont notifiés en plus des
  changements de statut faits par un responsable non modérateur
- **Annonces** : bandeau d'avertissement dans la navbar, gérable sans coder (page "Annonces",
  réservée aux admins), scopé à toute l'application ou à un kanban précis
- Pages d'administration : gestion des comptes utilisateurs et des annonces (réservées aux admins)

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
