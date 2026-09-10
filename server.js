const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { MongoClient } = require('mongodb');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Conexión a MongoDB
const uri = process.env.DATABASE_URL;
const client = new MongoClient(uri);

let db;

async function connectDB() {
    if (!db) {
        await client.connect();
        db = client.db('control_educativo');
        console.log("Conectado a MongoDB Atlas");
    }
    return db;
}

// Middleware para asegurar la conexión
app.use(async (req, res, next) => {
    try {
        req.db = await connectDB();
        next();
    } catch (err) {
        res.status(500).json({error: "Error de conexión a la base de datos"});
    }
});

const publicPath = fs.existsSync(path.join(__dirname, 'public')) ? path.join(__dirname, 'public') : __dirname;
app.use(express.static(publicPath));

const validTables = ['colegios', 'profesores', 'administrativos', 'cursos', 'materias', 'alumnos', 'actividades', 'observaciones', 'riesgo_reprobacion', 'asignaciones'];

app.post('/api/clean-db', async (req, res) => {
    try {
        for (const t of validTables) { await req.db.collection(t).deleteMany({}); }
        res.json({success: true});
    } catch (error) { res.status(500).json({error: error.message}); }
});

app.get('/api/backup', async (req, res) => {
    try {
        let backup = {};
        for (const t of validTables) {
            backup[t] = await req.db.collection(t).find({}).toArray();
        }
        res.json(backup);
    } catch (error) { res.status(500).json({error: error.message}); }
});

app.post('/api/restore', async (req, res) => {
    try {
        const backup = req.body;
        for (const t of validTables) {
            await req.db.collection(t).deleteMany({});
            if (backup[t] && backup[t].length > 0) {
                await req.db.collection(t).insertMany(backup[t]);
            }
        }
        res.json({success: true});
    } catch (error) { res.status(500).json({error: error.message}); }
});

app.get('/api/:table', async (req, res) => {
    try {
        if (!validTables.includes(req.params.table)) return res.status(400).json({error: "Colección inválida"});
        const r = await req.db.collection(req.params.table).find({}).toArray();
        res.json(r);
    } catch (error) { res.status(500).json({error: error.message}); }
});

app.post('/api/:table', async (req, res) => {
    try {
        const table = req.params.table;
        if (!validTables.includes(table)) return res.status(400).json({error: "Colección inválida"});
        await req.db.collection(table).insertOne(req.body);
        res.json({success: true});
    } catch (error) { res.status(500).json({error: error.message}); }
});

app.put('/api/:table/:id', async (req, res) => {
    try {
        const table = req.params.table;
        if (!validTables.includes(table)) return res.status(400).json({error: "Colección inválida"});
        const id = req.params.id;
        await req.db.collection(table).updateOne({ id: id }, { $set: req.body });
        res.json({success: true});
    } catch (error) { res.status(500).json({error: error.message}); }
});

app.delete('/api/:table/:id', async (req, res) => {
    try {
        if (!validTables.includes(req.params.table)) return res.status(400).json({error: "Colección inválida"});
        await req.db.collection(req.params.table).deleteOne({ id: req.params.id });
        res.json({success: true});
    } catch (error) { res.status(500).json({error: error.message}); }
});

// Redirigir cualquier ruta que no sea /api al index.html
app.get('*', (req, res) => {
    let indexPath = path.join(publicPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('No se encontró el archivo index.html.');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
