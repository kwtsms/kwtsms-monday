import express from 'express';

const app = express();
const port = Number(process.env.PORT) || 8080;

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '0.1.0' });
});

app.listen(port, () => {
  console.log(`kwtsms-monday listening on ${port}`);
});
