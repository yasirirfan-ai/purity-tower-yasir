import { writeFileSync } from 'fs';
import { createApp } from '../packages/api/src/app.js';

// GCP clients authenticate lazily on first use — setting the credentials file
// path here (before any request handler runs) is sufficient.
if (process.env.GCP_CREDENTIALS_JSON) {
  const tmpPath = '/tmp/gcp-credentials.json';
  writeFileSync(tmpPath, process.env.GCP_CREDENTIALS_JSON);
  process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpPath;
}

const app = createApp();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function handler(req: any, res: any) {
  return new Promise<void>((resolve, reject) => {
    app(req, res, (err?: unknown) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
