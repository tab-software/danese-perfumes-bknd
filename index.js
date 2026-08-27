import express from 'express';
import cors from 'cors';
import pg from 'pg';

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 4000;

// Middlewares
app.use(cors());
app.use(express.json());

// Conexión a PostgreSQL en Dokploy
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 1. GET: Traer todos los productos para el catálogo
app.get('/api/productos', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM danese_productos ORDER BY creado_en DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error al consultar:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. POST: Crear un nuevo producto desde el formulario
app.post('/api/productos', async (req, res) => {
  try {
    const {
      nombre,
      marca,
      precio_minorista_ars,
      precio_mayorista_usd,
      categoria,
      imagen_url,
      descripcion,
      talles,
      destacado,
      mas_vendido,
    } = req.body;

    const query = `
      INSERT INTO danese_productos (
        nombre, marca, precio_minorista_ars, precio_mayorista_usd,
        categoria, imagen_url, descripcion, talles, destacado, mas_vendido
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `;

    const values = [
      nombre,
      marca || null,
      Number(precio_minorista_ars) || 0,
      Number(precio_mayorista_usd) || 0,
      categoria || null,
      imagen_url || null,
      descripcion || null,
      Array.isArray(talles) ? talles : [],
      Boolean(destacado),
      Boolean(mas_vendido),
    ];

    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al insertar:', error);
    res.status(500).json({ error: error.message });
  }
});

// Iniciar el servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor API Danese corriendo en el puerto ${PORT}`);
});
