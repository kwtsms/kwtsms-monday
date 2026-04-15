import express from 'express';
import cronRouter from './routes/cron/sync';
import oauthRouter from './routes/oauth';
import settingsRouter from './routes/api/settings';
import templatesRouter from './routes/api/templates';
import logsRouter from './routes/api/logs';
import sendRouter from './routes/api/send';
import statsRouter from './routes/api/stats';
import itemCreated from './routes/recipes/item-created';
import statusToValue from './routes/recipes/status-to-value';
import columnChanged from './routes/recipes/column-changed';
import dateArrived from './routes/recipes/date-arrived';

const app = express();
const port = Number(process.env.PORT) || 8080;

app.use(express.json());
app.use('/cron', cronRouter);
app.use('/oauth', oauthRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/logs', logsRouter);
app.use('/api/send', sendRouter);
app.use('/api/stats', statsRouter);
app.use('/recipes/item-created', itemCreated);
app.use('/recipes/status-to-value', statusToValue);
app.use('/recipes/column-changed', columnChanged);
app.use('/recipes/date-arrived', dateArrived);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '0.1.0' });
});

app.listen(port, () => {
  console.log(`kwtsms-monday listening on ${port}`);
});
