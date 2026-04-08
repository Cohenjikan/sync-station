const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

let config = { 
    maxTexts: 500, 
    maxFilesGB: 5,
    authEnabled: true,
    pin: '0000',
    adminPass: 'admin'
};

let textMessages = [];
let fileCache = { files: [], size: 0 };
let timeCursor = Date.now();

const getSeqTime = () => {
    timeCursor = Math.max(timeCursor + 1, Date.now());
    return timeCursor;
};

const syncFileState = () => {
    let files = fs.readdirSync(UPLOADS_DIR).map(file => {
        const filePath = path.join(UPLOADS_DIR, file);
        const stats = fs.statSync(filePath);
        const timeMatch = file.match(/^(\d+)-/);
        const fileTime = timeMatch ? parseInt(timeMatch[1], 10) : stats.mtimeMs;
        return { name: file, path: filePath, time: fileTime, size: stats.size };
    }).sort((a, b) => a.time - b.time);

    let currentSize = files.reduce((acc, f) => acc + f.size, 0);
    const maxBytes = config.maxFilesGB * 1024 * 1024 * 1024;

    while (currentSize > maxBytes && files.length > 0) {
        const oldest = files.shift();
        if (fs.existsSync(oldest.path)) {
            fs.unlinkSync(oldest.path);
            currentSize -= oldest.size;
        }
    }

    fileCache.size = currentSize;
    fileCache.files = files.map(f => ({
        id: 'file-' + Buffer.from(f.name).toString('base64'),
        type: 'file',
        name: f.name,
        size: f.size,
        time: f.time
    }));
};

syncFileState();

const getCombinedState = () => {
    return {
        messages: [...textMessages, ...fileCache.files].sort((a, b) => a.time - b.time),
        textCount: textMessages.length,
        storageSize: fileCache.size,
        config: { maxTexts: config.maxTexts, maxFilesGB: config.maxFilesGB, authEnabled: config.authEnabled }
    };
};

const broadcastState = () => {
    while (textMessages.length > config.maxTexts) textMessages.shift();
    io.to('authed').emit('sync_state', getCombinedState());
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
        cb(null, getSeqTime() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

const httpAuth = (req, res, next) => {
    if (!config.authEnabled) return next();
    const pin = req.headers['x-auth-pin'] || req.query.pin;
    if (pin === config.pin) return next();
    res.status(401).send('Unauthorized');
};

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.use('/download', httpAuth, express.static(UPLOADS_DIR));

app.post('/api/upload', httpAuth, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');
    syncFileState();
    broadcastState();
    res.send('Uploaded');
});

app.delete('/api/files/:name', httpAuth, (req, res) => {
    const filePath = path.join(UPLOADS_DIR, req.params.name);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    syncFileState();
    broadcastState();
    res.send('Deleted');
});

app.post('/api/files/batch', httpAuth, (req, res) => {
    const { names } = req.body;
    if (Array.isArray(names)) {
        names.forEach(name => {
            const filePath = path.join(UPLOADS_DIR, name);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });
    }
    syncFileState();
    broadcastState();
    res.send('Batch Deleted');
});

io.on('connection', (socket) => {
    socket.auth = false;

    if (config.authEnabled) {
        socket.emit('require_auth');
    } else {
        socket.auth = true;
        socket.join('authed');
        socket.emit('sync_state', getCombinedState());
    }

    socket.on('verify_pin', (pin) => {
        if (!config.authEnabled || pin === config.pin) {
            socket.auth = true;
            socket.join('authed');
            socket.emit('auth_success', getCombinedState());
        } else {
            socket.emit('auth_fail');
        }
    });

    socket.on('verify_admin', (pass) => {
        if (pass === config.adminPass) {
            socket.emit('admin_success', {
                pin: config.pin,
                authEnabled: config.authEnabled,
                maxTexts: config.maxTexts,
                maxFilesGB: config.maxFilesGB
            });
        } else {
            socket.emit('admin_fail');
        }
    });

    const requireAuth = (fn) => (...args) => {
        if (config.authEnabled && !socket.auth) return;
        fn(...args);
    };

    socket.on('send_text', requireAuth((payload) => {
        let id, text;
        if (typeof payload === 'string') {
            id = 'txt-' + getSeqTime() + '-' + Math.random().toString(36).substr(2, 5);
            text = payload;
        } else if (payload && typeof payload === 'object') {
            id = payload.id || 'txt-' + getSeqTime() + '-' + Math.random().toString(36).substr(2, 5);
            text = payload.text;
        } else return;

        text = String(text || '').trim();
        if (!text || text.length > 10000) return;

        textMessages.push({ id, type: 'text', text, time: getSeqTime() });
        broadcastState();
    }));

    socket.on('delete_text', requireAuth((id) => {
        textMessages = textMessages.filter(m => m.id !== id);
        broadcastState();
    }));

    socket.on('delete_batch_texts', requireAuth((ids) => {
        textMessages = textMessages.filter(m => !ids.includes(m.id));
        broadcastState();
    }));

    socket.on('update_config', requireAuth((data) => {
        if (data.adminPass !== config.adminPass) return;
        
        config.maxTexts = parseInt(data.maxTexts) || 500;
        config.maxFilesGB = parseFloat(data.maxFilesGB) || 5;
        
        const oldAuthEnabled = config.authEnabled;
        config.authEnabled = !!data.authEnabled;
        
        let pinChanged = false;
        if (data.newPin && data.newPin.length === 4 && data.newPin !== config.pin) {
            config.pin = data.newPin;
            pinChanged = true;
        }
        if (data.newAdminPass) config.adminPass = data.newAdminPass;

        syncFileState();
        
        if (config.authEnabled) {
            if (!oldAuthEnabled || pinChanged) {
                io.emit('force_reauth');
                io.socketsLeave('authed');
            } else {
                broadcastState();
            }
        } else {
            io.sockets.socketsJoin('authed');
            io.sockets.forEach(s => s.auth = true);
            broadcastState();
        }
    }));
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});