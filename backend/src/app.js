const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const requireAuth = require('./middleware/auth');

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const kanbansRoutes = require('./routes/kanbans.routes');
const searchRoutes = require('./routes/search.routes');

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || 'https://twizzyx-kanban.vercel.app')
  .split(',')
  .map((origin) => origin.trim());

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '8mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', requireAuth, usersRoutes);
app.use('/api/kanbans', requireAuth, kanbansRoutes);
app.use('/api/search', requireAuth, searchRoutes);

// --- Service du frontend Angular buildé ---
// Angular 17+ (et donc Angular 21 utilisé ici) génère la sortie dans un
// sous-dossier "browser/" par défaut avec le nouveau builder esbuild.
// On gère les deux cas (avec ou sans "browser/") pour ne pas dépendre
// d'une version précise du builder.
const distRoot = path.join(__dirname, '../../frontend/dist/frontend');
const distBrowser = path.join(distRoot, 'browser');
const staticDir = fs.existsSync(distBrowser) ? distBrowser : distRoot;
const indexHtmlPath = path.join(staticDir, 'index.html');

if (!fs.existsSync(indexHtmlPath)) {
  console.warn(
    `[APP] Attention : index.html introuvable dans "${staticDir}". ` +
    'Le build du frontend a-t-il bien été exécuté et copié au bon endroit ?'
  );
}

app.use(express.static(staticDir));

// Toute route qui n'est pas une API et qui n'a pas matché un fichier statique
// est renvoyée vers index.html, pour laisser Angular gérer son routing côté
// client (ex: /board/123 après un refresh navigateur).
app.get(/^(?!\/api).*/, (req, res, next) => {
  if (!fs.existsSync(indexHtmlPath)) {
    return next();
  }
  res.sendFile(indexHtmlPath);
});

// 404 pour tout ce qui reste (typiquement une route /api/... inconnue)
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur' });
});

module.exports = app;
