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
    res.status(500).json({ error: error.message });
  }
});
