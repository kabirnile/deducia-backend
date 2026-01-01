require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// 1. Setup the Connection to Hostinger
const db = mysql.createPool({
    host: process.env.DB_HOST,       // We will set this secret later
    user: process.env.DB_USER,       // We will set this secret later
    password: process.env.DB_PASSWORD, // We will set this secret later
    database: process.env.DB_NAME,   // We will set this secret later
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test the connection
db.getConnection((err, connection) => {
    if (err) {
        console.error('Error connecting to Hostinger:', err.message);
    } else {
        console.log('Successfully connected to Hostinger Database!');
        connection.release();
    }
});

// 2. Simple API Route to check if server is alive
app.get('/', (req, res) => {
    res.send('Deducia Backend is Running!');
});

// 3. API to Get All Courses (For the Dashboard)
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
