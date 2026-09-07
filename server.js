const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Conexión a Supabase mediante variable de entorno
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

app.use(express.static(path.join(__dirname, 'public')));

const validTables = ['colegios', 'profesores', 'administrativos', 'cursos', 'materias', 'alumnos', 'actividades', 'observaciones', 'riesgo_reprobacion', 'asignaciones'];

app.post('/api/clean-db', async (req, res) => {
    try {
        for (const t of validTables) { await pool.query(`TRUNCATE TABLE ${t}`); }
        res.json({success: true});
    } catch (error) { res.status(500).json({error: error.message}); }
});

app.get('/api/backup', async (req, res) => {
    try {
        let backup = {};
        for (const t of validTables) {
            const r = await pool.query(`SELECT * FROM ${t}`);
            backup[t] = r.rows;
        }
        res.json(backup);
    } catch (error) { res.status(500).json({error: error.message}); }
});

app.post('/api/restore', async (req, res) => {
    try {
        const backup = req.body;
        for (const t of validTables) {
            await pool.query(`TRUNCATE TABLE ${t}`);
            if (backup[t] && backup[t].length > 0) {
                const keys = Object.keys(backup[t][0]);
                const values = backup[t].map(row => keys.map(k => row[k]));
                const placeholders = backup[t].map((_, i) => `(${keys.map((_, j) => `$${i * keys.length + j + 1}`).join(', ')})`).join(', ');
                const flatValues = values.flat();
                await pool.query(`INSERT INTO ${t} (${keys.join(', ')}) VALUES ${placeholders}`, flatValues);
            }
        }
        res.json({success: true});
    } catch (error) { res.status(500).json({error: error.message}); }
});

app.get('/api/:table', async (req, res) => {
    try {
        if (!validTables.includes(req.params.table)) return res.status(400).json({error: "Tabla inválida"});
        const r = await pool.query(`SELECT * FROM ${req.params.table}`);
        res.json(r.rows);
    } catch (error) { res.status(500).json({error: error.message}); }
});

app.post('/api/:table', async (req, res) => {
    try {
        const table = req.params.table;
        if (!validTables.includes(table)) return res.status(400).json({error: "Tabla inválida"});
        const data = req.body;
        const keys = Object.keys(data);
        const values = keys.map(k => data[k]);
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        await pool.query(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`, values);
        res.json({success: true});
    } catch (error) { res.status(500).json({error: error.message}); }
});

app.put('/api/:table/:id', async (req, res) => {
    try {
        const table = req.params.table;
        if (!validTables.includes(table)) return res.status(400).json({error: "Tabla inválida"});
        const id = req.params.id;
        const data = req.body;
        const keys = Object.keys(data);
        const values = keys.map(k => data[k]);
        const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
        await pool.query(`UPDATE ${table} SET ${setClause} WHERE id = $${keys.length + 1}`, [...values, id]);
        res.json({success: true});
    } catch (error) { res.status(500).json({error: error.message}); }
});

app.delete('/api/:table/:id', async (req, res) => {
    try {
        if (!validTables.includes(req.params.table)) return res.status(400).json({error: "Tabla inválida"});
        await pool.query(`DELETE FROM ${req.params.table} WHERE id = $1`, [req.params.id]);
        res.json({success: true});
    } catch (error) { res.status(500).json({error: error.message}); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});