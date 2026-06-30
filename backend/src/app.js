const express = require('express');
const requireAuth = require('./middleware/auth');

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const columnsRoutes = require('./routes/columns.routes');
const cardsRoutes = require('./routes/cards.routes');

const app = express();

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', requireAuth, usersRoutes);
app.use('/api/columns', requireAuth, columnsRoutes);
app.use('/api/cards', requireAuth, cardsRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur' });
});

module.exports = app;
