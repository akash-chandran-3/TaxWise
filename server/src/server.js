// Entry point: `npm start` or `npm run dev`
const app = require('./app');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const PORT = Number(process.env.PORT) || 5000;
app.listen(PORT, () => {
  console.log(`TaxWise API running on http://localhost:${PORT}`);
});
