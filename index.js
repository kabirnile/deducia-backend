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

// --- EXAM API 1: Create a Test ---
app.post('/api/tests', (req, res) => {
    const { title, duration_minutes, teacher_id } = req.body;
    const sql = "INSERT INTO tests (title, duration_minutes, teacher_id) VALUES (?, ?, ?)";
    db.query(sql, [title, duration_minutes, teacher_id], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true, id: result.insertId });
    });
});

// --- EXAM API 2: Add a Question to a Test ---
app.post('/api/questions', (req, res) => {
    const { test_id, question_text, option_a, option_b, option_c, option_d, correct_option } = req.body;
    const sql = "INSERT INTO questions (test_id, question_text, option_a, option_b, option_c, option_d, correct_option) VALUES (?, ?, ?, ?, ?, ?, ?)";
    db.query(sql, [test_id, question_text, option_a, option_b, option_c, option_d, correct_option], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true });
    });
});

// --- EXAM API 3: Get All Tests (For Student Dashboard) ---
app.get('/api/tests', (req, res) => {
    db.query("SELECT * FROM tests", (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// --- EXAM API 4: Get Specific Test Questions (When Student starts) ---
app.get('/api/tests/:id/questions', (req, res) => {
    const sql = "SELECT * FROM questions WHERE test_id = ?";
    db.query(sql, [req.params.id], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});


// --- SIGNUP API: Create a New Student ---
app.post('/api/signup', (req, res) => {
    const { phone, full_name } = req.body;
    
    // 1. Check if user already exists (Safety Check)
    const checkSql = "SELECT * FROM users WHERE phone = ?";
    db.query(checkSql, [phone], (err, results) => {
        if (err) return res.status(500).json(err);
        
        if (results.length > 0) {
            return res.json({ success: false, message: "User already exists. Please Login." });
        }

        // 2. Create the New User
        const insertSql = "INSERT INTO users (phone, full_name, role) VALUES (?, ?, 'student')";
        db.query(insertSql, [phone, full_name], (err, result) => {
            if (err) return res.status(500).json(err);
            
            // 3. Return the new user data immediately so they can log in
            res.json({ 
                success: true, 
                user: { id: result.insertId, phone, full_name, role: 'student' } 
            });
        });
    });
});


// --- PERSONALIZATION API 1: Get My Enrolled Batches ---
app.get('/api/my-batches', (req, res) => {
    const student_id = req.query.student_id;
    const sql = `
        SELECT courses.* FROM courses 
        JOIN enrollments ON courses.id = enrollments.course_id 
        WHERE enrollments.student_id = ?`;
    
    db.query(sql, [student_id], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// --- PERSONALIZATION API 2: Get My Test Scores ---
app.get('/api/my-results', (req, res) => {
    const student_id = req.query.student_id;
    // Get test details along with the score
    const sql = `
        SELECT tests.title, results.score, results.total_marks, results.test_id 
        FROM results 
        JOIN tests ON results.test_id = tests.id 
        WHERE results.student_id = ?`;

    db.query(sql, [student_id], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// --- PERSONALIZATION API 3: Join a Batch (Free for now) ---
app.post('/api/enroll', (req, res) => {
    const { student_id, course_id } = req.body;
    // Check if already enrolled to prevent duplicates
    const checkSql = "SELECT * FROM enrollments WHERE student_id = ? AND course_id = ?";
    db.query(checkSql, [student_id, course_id], (err, results) => {
        if (results.length > 0) return res.json({ success: true, message: "Already Enrolled" });

        const sql = "INSERT INTO enrollments (student_id, course_id) VALUES (?, ?)";
        db.query(sql, [student_id, course_id], (err, result) => {
            if (err) return res.status(500).json(err);
            res.json({ success: true });
        });
    });
});


// --- MENTORSHIP API: Student Requests a Mentor ---
app.post('/api/mentor-request', (req, res) => {
    const { student_id, subject, issue, preferred_time } = req.body;
    const sql = "INSERT INTO mentor_requests (student_id, subject, issue, preferred_time) VALUES (?, ?, ?, ?)";
    db.query(sql, [student_id, subject, issue, preferred_time], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true, message: "Request Sent! Our team will call you." });
    });
});

// --- CONTACT API: Student sends a message ---
app.post('/api/contact', (req, res) => {
    const { name, phone, message } = req.body;
    const sql = "INSERT INTO support_messages (name, phone, message) VALUES (?, ?, ?)";
    db.query(sql, [name, phone, message], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true, message: "Message Received! Ticket #"+result.insertId });
    });
});

// --- TEACHER DASHBOARD: Get all Student Requests ---
app.get('/api/teacher/requests', (req, res) => {
    const sql = `
        SELECT mentor_requests.*, users.full_name, users.phone 
        FROM mentor_requests 
        JOIN users ON mentor_requests.student_id = users.id 
        ORDER BY request_date DESC
    `;
    db.query(sql, (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

// --- ADMIN: Add a New Course (No more SQL!) ---
app.post('/api/add-course', (req, res) => {
    const { title, description, thumbnail_url, video_url } = req.body;
    const sql = "INSERT INTO courses (title, description, thumbnail_url, video_url) VALUES (?, ?, ?, ?)";
    db.query(sql, [title, description, thumbnail_url, video_url], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true, message: "Course Launched!" });
    });
});

;


app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
