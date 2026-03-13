const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Multer storage config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileName = uniqueSuffix + path.extname(file.originalname);
        cb(null, fileName);
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }
});

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'db.json');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));
app.use('/uploads', express.static(uploadsDir));

// Utility to read DB
const readDB = () => {
    if (!fs.existsSync(DB_FILE)) {
        const initialData = { journal: [], mailbox: [], wishlist: [], gallery: [], config: { songId: 'b_CpWmkhwq0' } };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
        return initialData;
    }
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    if (!data.journal) data.journal = [];
    if (!data.mailbox) data.mailbox = [];
    if (!data.wishlist) data.wishlist = [];
    if (!data.gallery) data.gallery = [];
    if (!data.config) data.config = { songId: 'b_CpWmkhwq0' };
    return data;
};

// Utility to write DB
const writeDB = (data) => {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
};

// --- API ENDPOINTS ---

// 1. Journal
app.get('/api/journal', (req, res) => {
    const db = readDB();
    res.json(db.journal);
});

app.post('/api/journal', (req, res) => {
    const { text, type, attachment } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });
    const db = readDB();
    const newEntry = {
        id: Date.now(),
        date: new Date().toLocaleDateString('es-ES'),
        text,
        type: type || 'text',
        attachment: attachment || null
    };
    db.journal.unshift(newEntry);
    writeDB(db);
    res.status(201).json(newEntry);
});

// 2. Mailbox (Interactions)
app.get('/api/messages', (req, res) => {
    const db = readDB();
    res.json(db.mailbox);
});

app.post('/api/mailbox', (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });
    const db = readDB();
    const newMessage = {
        id: Date.now(),
        date: new Date().toLocaleString('es-ES'),
        message
    };
    db.mailbox.unshift(newMessage);
    writeDB(db);
    res.status(201).json({ success: true });
});

// 3. Gallery
app.get('/api/gallery', (req, res) => {
    const db = readDB();
    res.json(db.gallery);
});

app.post('/api/gallery', (req, res) => {
    const { src, type } = req.body;
    if (!src) return res.status(400).json({ error: 'Source is required' });
    const db = readDB();
    const newItem = { id: Date.now(), src, type: type || 'image' };
    db.gallery.push(newItem);
    writeDB(db);
    res.status(201).json(newItem);
});

// 4. Wishlist
app.get('/api/wishlist', (req, res) => {
    const db = readDB();
    res.json(db.wishlist);
});

app.post('/api/wishlist', (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });
    const db = readDB();
    const newItem = { id: Date.now(), text, completed: false };
    db.wishlist.push(newItem);
    writeDB(db);
    res.status(201).json(newItem);
});

app.put('/api/wishlist/:id', (req, res) => {
    const { id } = req.params;
    const { completed } = req.body;
    const db = readDB();
    const item = db.wishlist.find(i => i.id == id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    item.completed = (completed !== undefined) ? completed : !item.completed;
    writeDB(db);
    res.json(item);
});

app.delete('/api/wishlist/:id', (req, res) => {
    const { id } = req.params;
    const db = readDB();
    db.wishlist = db.wishlist.filter(i => i.id != id);
    writeDB(db);
    res.json({ success: true });
});

// 5. Config (Song)
app.get('/api/config', (req, res) => {
    const db = readDB();
    res.json(db.config);
});

app.post('/api/config', (req, res) => {
    const { songId, capsuleDate, capsuleMessage } = req.body;
    const db = readDB();
    if (songId) db.config.songId = songId;
    if (capsuleDate) db.config.capsuleDate = capsuleDate;
    if (capsuleMessage) db.config.capsuleMessage = capsuleMessage;
    writeDB(db);
    res.json(db.config);
});

// 6. Upload
app.post('/api/upload', (req, res) => {
    upload.single('file')(req, res, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        res.json({ url: `/uploads/${req.file.filename}` });
    });
});

// 7. Delete
app.delete('/api/journal/:id', (req, res) => {
    const { id } = req.params;
    const db = readDB();
    const idx = db.journal.findIndex(e => e.id == id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const entry = db.journal[idx];
    if (entry.attachment && entry.attachment.startsWith('/uploads/')) {
        const fp = path.join(__dirname, entry.attachment);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    db.journal.splice(idx, 1);
    writeDB(db);
    res.json({ success: true });
});

app.delete('/api/gallery/:id', (req, res) => {
    const { id } = req.params;
    const db = readDB();
    const idx = db.gallery.findIndex(e => e.id == id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const item = db.gallery[idx];
    if (item.src && item.src.startsWith('/uploads/')) {
        const fp = path.join(__dirname, item.src);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    db.gallery.splice(idx, 1);
    writeDB(db);
    res.json({ success: true });
});

app.listen(PORT, () => console.log(`Server at http://localhost:${PORT}`));
