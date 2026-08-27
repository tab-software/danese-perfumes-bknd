import express from 'express';
import cors from 'cors';
import pg from 'pg';

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ── PRODUCTOS ──

// 1. GET: Listar todos los productos
app.get('/api/productos', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM danese_productos ORDER BY creado_en DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. POST: Crear un nuevo producto
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
      sin_stock,
    } = req.body;

    const query = `
      INSERT INTO danese_productos (
        nombre, marca, precio_minorista_ars, precio_mayorista_usd,
        categoria, imagen_url, descripcion, talles, destacado, mas_vendido, sin_stock
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
      Boolean(sin_stock),
    ];

    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. PUT: Actualizar producto (editar datos, togglear stock)
app.put('/api/productos/:id', async (req, res) => {
  try {
    const { id } = req.params;
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
      sin_stock,
    } = req.body;

    const query = `
      UPDATE danese_productos SET
        nombre = COALESCE($1, nombre),
        marca = COALESCE($2, marca),
        precio_minorista_ars = COALESCE($3, precio_minorista_ars),
        precio_mayorista_usd = COALESCE($4, precio_mayorista_usd),
        categoria = COALESCE($5, categoria),
        imagen_url = COALESCE($6, imagen_url),
        descripcion = COALESCE($7, descripcion),
        talles = COALESCE($8, talles),
        destacado = COALESCE($9, destacado),
        mas_vendido = COALESCE($10, mas_vendido),
        sin_stock = COALESCE($11, sin_stock)
      WHERE id = $12
      RETURNING *;
    `;

    const values = [
      nombre !== undefined ? nombre : null,
      marca !== undefined ? marca : null,
      precio_minorista_ars !== undefined ? Number(precio_minorista_ars) : null,
      precio_mayorista_usd !== undefined ? Number(precio_mayorista_usd) : null,
      categoria !== undefined ? categoria : null,
      imagen_url !== undefined ? imagen_url : null,
      descripcion !== undefined ? descripcion : null,
      Array.isArray(talles) ? talles : null,
      destacado !== undefined ? Boolean(destacado) : null,
      mas_vendido !== undefined ? Boolean(mas_vendido) : null,
      sin_stock !== undefined ? Boolean(sin_stock) : null,
      id,
    ];

    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. DELETE: Eliminar producto
app.delete('/api/productos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM danese_productos WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. POST BATCH: Carga masiva desde Excel
app.post('/api/productos/batch', async (req, res) => {
  const client = await pool.connect();
  try {
    const { productos } = req.body;
    if (!Array.isArray(productos)) return res.status(400).json({ error: 'Array requerido' });

    await client.query('BEGIN');
    for (const p of productos) {
      const query = `
        INSERT INTO danese_productos (
          nombre, marca, precio_minorista_ars, precio_mayorista_usd,
          categoria, imagen_url, descripcion, talles, destacado, mas_vendido, sin_stock
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `;
      const values = [
        p.nombre,
        p.marca || 'Danese',
        Number(p.precio_minorista_ars) || 0,
        Number(p.precio_mayorista_usd) || 0,
        p.categoria || null,
        p.imagen_url || null,
        p.descripcion || null,
        Array.isArray(p.talles) ? p.talles : [],
        Boolean(p.destacado),
        Boolean(p.mas_vendido),
        Boolean(p.sin_stock),
      ];
      await client.query(query, values);
    }
    await client.query('COMMIT');
    res.json({ success: true, count: productos.length });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// ── CATEGORÍAS ──

// 6. GET: Listar categorías
app.get('/api/categorias', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM danese_categorias ORDER BY creado_en ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. POST: Crear / Actualizar categoría (Upsert)
app.post('/api/categorias', async (req, res) => {
  try {
    const { id, nombre, icono, imagen_url } = req.body;
    const query = `
      INSERT INTO danese_categorias (id, nombre, icono, imagen_url)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        icono = EXCLUDED.icono,
        imagen_url = EXCLUDED.imagen_url
      RETURNING *;
    `;
    const result = await pool.query(query, [id, nombre, icono || '✨', imagen_url || null]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 8. DELETE: Eliminar categoría
app.delete('/api/categorias/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM danese_categorias WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API Danese lista en puerto ${PORT}`);
});
