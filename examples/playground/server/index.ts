import { createApiServer } from './app.ts';
import { loadConfiguration } from './config.ts';

const configuration = loadConfiguration(process.argv.includes('--demo')
  ? { ...process.env, AI_PROVIDER: 'demo' }
  : process.env);
const server = createApiServer(configuration);
server.on('error', (error) => {
  console.error('Backend failed to start:', error.message);
  process.exitCode = 1;
});
server.listen(3017, '127.0.0.1', () => {
  console.log('Grid playground API: http://127.0.0.1:3017');
  console.log(configuration.ai
    ? `AI configured: ${configuration.model} at ${configuration.providerHost}`
    : `AI not configured. Set ${configuration.missing.join(', ')} in .env.`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close();
    server.closeAllConnections();
  });
}
