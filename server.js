const { spawn } = require('child_process');
const path = require('path');

// Adapte ces chemins à la structure réelle de ton projet
const BACK_DIR = path.join(__dirname, 'backend');
const FRONT_DIR = path.join(__dirname, 'frontend');

function startProcess(name, command, args, cwd) {
  const proc = spawn(command, args, {
    cwd,
    shell: true, // nécessaire sur Windows pour trouver npm/ng
    env: { ...process.env }
  });

  proc.stdout.on('data', (data) => {
    process.stdout.write(`[${name}] ${data}`);
  });

  proc.stderr.on('data', (data) => {
    process.stderr.write(`[${name} - erreur] ${data}`);
  });

  proc.on('close', (code) => {
    console.log(`[${name}] processus arrêté avec le code ${code}`);
  });

  proc.on('error', (err) => {
    console.error(`[${name}] impossible de lancer le processus :`, err);
  });

  return proc;
}

console.log('Démarrage du back (port 3000)...');
const backend = startProcess('BACK', 'npm', ['start'], BACK_DIR);

console.log('Démarrage du front (port 4200)...');
const frontend = startProcess(
  'FRONT',
  'npx',
  ['ng', 'serve', '--host', '0.0.0.0', '--port', '4200'],
  FRONT_DIR
);

// Arrêt propre des deux processus si on ferme le launcher
function shutdown() {
  console.log('\nArrêt en cours...');
  backend.kill();
  frontend.kill();
  process.exit();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);