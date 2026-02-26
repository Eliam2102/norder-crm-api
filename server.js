import 'dotenv/config';
import app from './src/app.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 NORER HEALTH Server running in ${process.env.NODE_ENV} mode on http://localhost:${PORT}`);
});
