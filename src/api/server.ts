import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { angebotRouter } from './routes/angebot';
import { rechnungRouter } from './routes/rechnung';
import { stripeRouter } from './routes/stripe';

const app = express();
const PORT = Number(process.env.PORT) ?? 3000;

// Security
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.BASE_URL ?? 'http://localhost:3000' }));

// Stripe webhook needs raw body
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

// JSON parsing for all other routes
app.use(express.json({ limit: '1mb' }));

// API routes
app.use('/api/angebot', angebotRouter);
app.use('/api/rechnung', rechnungRouter);
app.use('/api/stripe', stripeRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '0.1.0', timestamp: new Date().toISOString() });
});

// Serve static frontend
const publicDir = path.join(process.cwd(), 'public');
app.use(express.static(publicDir));
app.get('*', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));

app.listen(PORT, () => {
  console.log(`AngebotPro server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV ?? 'development'}`);
});

export default app;
