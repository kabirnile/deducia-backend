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
// --- SMART API: Get Courses (Filter by Teacher if needed) ---
app.get('/api/courses', (req, res) => {
    const teacher_id = req.query.teacher_id;
    
    let sql = "SELECT * FROM courses";
    let params = [];

    // If a teacher_id is sent, filter the results!
    if (teacher_id) {
        sql += " WHERE teacher_id = ?";
        params.push(teacher_id);
    }

    db.query(sql, params, (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// --- NEW API: Delete a Course ---
app.delete('/api/courses/:id', (req, res) => {
    const sql = "DELETE FROM courses WHERE id = ?";
    db.query(sql, [req.params.id], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true, message: "Deleted!" });
    });
});

const PORT = process.env.PORT || 3000;
// --- ADMIN API: Create a New Course ---
// --- ADMIN API: Create a New Course (With Teacher Tag) ---
app.post('/api/courses', (req, res) => {
    // 1. Get data including the NEW teacher_id
    const { title, description, thumbnail_url, video_url, notes_url, teacher_id } = req.body;

    // 2. Insert into Database (Now including the tag)
    const sql = "INSERT INTO courses (title, description, thumbnail_url, video_url, notes_url, teacher_id) VALUES (?, ?, ?, ?, ?, ?)";
    
    db.query(sql, [title, description, thumbnail_url, video_url, notes_url, teacher_id], (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, message: "Course Created Successfully!", id: result.insertId });
    });
});
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
