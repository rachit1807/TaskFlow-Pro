import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { connectDatabase } from './config/database.js';

config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });
const { default: app } = await import('./app.js');
const port = Number(process.env.PORT || 4000);

app.listen(port, () => console.log(`TaskFlow API listening on http://localhost:${port}`));

connectDatabase().catch((error) => {
  console.error(`MongoDB is unavailable: ${error.message}`);
  console.error('The API remains available for health checks; database features need a valid MONGODB_URI.');
});
