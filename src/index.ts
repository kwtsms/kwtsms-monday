import express from 'express';
import cronRouter from './routes/cron/sync';
import oauthRouter from './routes/oauth';
import settingsRouter from './routes/api/settings';

const app = express();
const port = Number(process.env.PORT) || 8080;

app.use(express.json());
app.use('/cron', cronRouter);
app.use('/oauth', oauthRouter);
app.use('/api/settings', settingsRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '0.1.0' });
});

app.listen(port, () => {
  console.log(`kwtsms-monday listening on ${port}`);
});
