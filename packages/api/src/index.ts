import './env.js';
import { PORT } from './env.js';
import { createApp } from './app.js';

const app = createApp();
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`@pct/api listening on :${PORT}`);
});
