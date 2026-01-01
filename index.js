require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// 1. Database Connection
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 2. Health Check
app.get('/', (req, res) => {
    res.send('Deducia Backend is Running with Login!');
});

// --- NEW: LOGIN API ---
app.post('/api/login', (req, res) => {
    const { phone } = req.body;

    // Security Check: Is phone number valid?
    if (!phone) {
        return res.status(400).json({ success: false, message: 'Phone required' });
    }

    // Check if user exists in Hostinger DB
    const sql = "SELECT * FROM users WHERE phone = ?";
    db.query(sql, [phone], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }

        if (results.length > 0) {
            // User Found! Let them in.
            res.json({ success: true, user: results[0] });
        } else {
            // User Not Found.
            res.status(401).json({ success: false, message: 'Student not found' });
        }
    });
});
// ----------------------

// 3. Get Courses API
app.get('/api/courses', (req, res) => {
    const sql = "SELECT * FROM courses";
    db.query(sql, (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(result);
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
