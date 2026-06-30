require('dotenv').config();

const migrate = require('./db/migrate');
const app = require('./app');

migrate();

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Serveur sur :${port}`);
});
