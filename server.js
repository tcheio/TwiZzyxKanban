const { spawn } = require('child_process');
const path = require('path');

// Adapte ces chemins à la structure réelle de ton projet
const BACK_DIR = path.join(__dirname, 'backend');

// Sur Windows, npm/node sont souvent des .cmd : shell nécessaire.
// Sur Linux (typiquement le cas sur un panel comme Minestrator), on lance
// node directement, sans passer par npm/sh, pour garder un contrôle direct
// sur le vrai process et une propagation fiable des signaux.
const isWindows = process.platform === 'win32';

// Les panels type Pterodactyl/Minestrator n'injectent généralement PAS une
// variable "PORT", mais "SERVER_PORT" (parfois accompagnée de "SERVER_IP").
// Le backend (backend/server.js) ne lit que process.env.PORT. Sans cette
// normalisation, le backend retomberait sur son fallback 3000, qui ne
// correspond pas forcément au port réellement ouvert/routé par le panel :
// le process tourne, les logs sont propres, mais rien n'est accessible.
const resolvedPort =
  process.env.PORT || process.env.SERVER_PORT || process.env.MINESTRATOR_PORT || 3000;

console.log(`[LAUNCHER] Port résolu pour le backend : ${resolvedPort}`);

const backendEnv = {
  ...process.env,
  PORT: String(resolvedPort)
};

let backend;
let shuttingDown = false;

function startBackend() {
  if (isWindows) {
    backend = spawn('npm', ['start'], {
      cwd: BACK_DIR,
      shell: true,
      env: backendEnv
    });
  } else {
    backend = spawn('node', ['src/server.js'], {
      cwd: BACK_DIR,
      env: backendEnv
    });
  }

  backend.stdout.on('data', (data) => {
    process.stdout.write(`[BACK] ${data}`);
  });

  backend.stderr.on('data', (data) => {
    process.stderr.write(`[BACK - erreur] ${data}`);
  });

  backend.on('error', (err) => {
    console.error('[BACK] impossible de lancer le processus :', err);
    process.exit(1);
  });

  backend.on('close', (code, signal) => {
    if (shuttingDown) {
      // Arrêt volontaire (SIGINT/SIGTERM reçu) : sortie propre.
      process.exit(0);
      return;
    }

    // Le backend est mort tout seul (crash, port déjà utilisé, exception,
    // etc.) : on NE DOIT PAS rester en vie en affichant juste un log,
    // sinon le panel voit le launcher toujours actif alors que plus rien
    // n'écoute réellement le port -> site inaccessible sans aucune alerte.
    console.error(
      `[BACK] processus arrêté (code=${code}, signal=${signal}) — arrêt du launcher pour que le panel détecte le crash.`
    );
    process.exit(code === 0 || code === null ? 1 : code);
  });
}

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[LAUNCHER] Signal ${signal} reçu, arrêt en cours...`);

  if (!backend || backend.killed) {
    process.exit(0);
    return;
  }

  backend.kill('SIGTERM');

  // Filet de sécurité : si le backend ne s'arrête pas proprement
  // (process orphelin qui garde le port ouvert), on force après 5s.
  const forceTimeout = setTimeout(() => {
    console.warn('[LAUNCHER] Le backend ne répond pas, arrêt forcé (SIGKILL).');
    try {
      backend.kill('SIGKILL');
    } catch (_) {
      // process déjà mort
    }
    process.exit(0);
  }, 5000);
  forceTimeout.unref();
}

console.log('Démarrage du back (sert aussi le frontend buildé)...');
startBackend();

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
