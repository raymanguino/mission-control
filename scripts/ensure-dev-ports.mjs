import net from 'node:net';

const REQUIRED_PORTS = [3001, 3002, 5173];

function isPortInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
    socket.setTimeout(750, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function main() {
  const occupied = [];

  for (const port of REQUIRED_PORTS) {
    if (await isPortInUse(port)) occupied.push(port);
  }

  if (occupied.length === 0) return;

  const ports = occupied.join(', ');
  console.error(
    `[dev preflight] Port(s) already in use: ${ports}. Stop existing dev servers, then run npm run dev again.`,
  );
  process.exit(1);
}

void main();
