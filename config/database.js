const { Pool } = require('pg');
require('dotenv').config();

// Configurar conexión a PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'portfolio_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'tu_contraseña',
  // Añadir configuración SSL para producción (necesario en Vercel + PostgreSQL externo)
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});

// Probar la conexión (solo en desarrollo)
if (process.env.NODE_ENV !== 'production') {
  pool.connect((err, client, release) => {
    if (err) {
      console.error('❌ Error conectando a PostgreSQL:', err.message);
    } else {
      console.log('✅ Conexión exitosa a PostgreSQL');
      release();
    }
  });
}

module.exports = pool;