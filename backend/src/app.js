const express = require('express');
const cors = require('cors');
const requireAuth = require('./middleware/auth');

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const columnsRoutes = require('./routes/columns.routes');
const cardsRoutes = require('./routes/cards.routes');
const tagsRoutes = require('./routes/tags.routes');
const epicsRoutes = require('./routes/epics.routes');

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
app.use('/api/columns', requireAuth, columnsRoutes);
app.use('/api/cards', requireAuth, cardsRoutes);
app.use('/api/tags', requireAuth, tagsRoutes);
app.use('/api/epics', requireAuth, epicsRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur' });
});

module.exports = app;
