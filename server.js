const express = require('express');
const cors = require('cors');
const mysql = require('mysql');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// ✅ Enable CORS
app.use(cors({
  origin: 'http://localhost:5173', // Your frontend's origin
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));

app.use(express.json());
app.use("/uploads", express.static("uploads")); // Serve uploaded images

// ✅ MySQL Connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'KD2',
  port: 3306,
});

db.connect((err) => {
  if (err) {
    console.error('❌ Database connection failed:', err);
    return;
  }
  console.log('✅ Connected to MySQL database');
});

// ✅ Multer config for image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

// ✅ Add Booking
app.post('/api/book', (req, res) => {
  const { room_number, quantity, name, persons, booking_date } = req.body;

  if (!room_number || !quantity || !name || !persons || !booking_date) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const sql = `
    INSERT INTO bookings (room_number, quantity, name, persons, booking_date) 
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(sql, [room_number, quantity, name, persons, booking_date], (err, result) => {
    if (err) {
      console.error('❌ Error adding booking:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    res.status(201).json({ message: 'Booking successful', bookingId: result.insertId });
  });
});

// ✅ Check Room Availability
app.get('/api/available', (req, res) => {
  const { room_number, booking_date } = req.query;

  if (!room_number || !booking_date) {
    return res.status(400).json({ error: 'room_number and booking_date are required' });
  }

  const sql = `
    SELECT COUNT(*) AS count 
    FROM bookings 
    WHERE room_number = ? AND booking_date = ?
  `;

  db.query(sql, [room_number, booking_date], (err, results) => {
    if (err) {
      console.error('❌ Error checking availability:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    const isAvailable = results[0].count === 0;
    res.json({ available: isAvailable });
  });
});

// ✅ Add New Room with Image
app.post("/api/add-room", upload.single("img"), (req, res) => {
  const { room_name, room_number, bed_count } = req.body;
  const img = req.file ? req.file.filename : null;

  if (!room_name || !room_number || !bed_count || !img) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const sql = `INSERT INTO rooms (room_name, room_number, bed_count, img) VALUES (?, ?, ?, ?)`;

  db.query(sql, [room_name, room_number, bed_count, img], (err, result) => {
    if (err) {
      console.error("❌ Error adding room:", err);
      return res.status(500).json({ error: "Database error" });
    }

    res.status(201).json({
      message: "Room added successfully!",
      roomId: result.insertId,
    });
  });
});

// ✅ Get All Rooms or Specific Room
app.get('/api/rooms', (req, res) => {
  const { room_number } = req.query;

  const sql = room_number
    ? `SELECT * FROM rooms WHERE room_number = ?`
    : `SELECT * FROM rooms`;

  const values = room_number ? [room_number] : [];

  db.query(sql, values, (err, results) => {
    if (err) {
      console.error('❌ Error retrieving rooms:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (room_number && results.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json(room_number ? results[0] : results);
  });
});

// ✅ Delete Room and Image
// ✅ Delete Room and Image



app.delete('/api/rooms/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid room ID' });
  }

  console.log(`🛠 Deleting room with ID ${id}...`);

  // Step 1: Get image filename
  const selectSql = `SELECT img FROM rooms WHERE id = ?`;
  db.query(selectSql, [id], (err, results) => {
    if (err) {
      console.error('❌ Error retrieving room image:', err);
      return res.status(500).json({ error: 'Error retrieving room details' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const imgFile = results[0].img;
    const imgPath = path.join(__dirname, 'uploads', imgFile);

    // Step 2: Delete room from database
    const deleteSql = `DELETE FROM rooms WHERE id = ?`;
    db.query(deleteSql, [id], (err, result) => {
      if (err) {
        console.error('❌ Error deleting room from database:', err);
        return res.status(500).json({ error: 'Error deleting room' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Room not found' });
      }

      console.log(`✅ Room with ID ${id} deleted from database`);

      // Step 3: Delete image file
      if (imgFile) {
        fs.unlink(imgPath, (err) => {
          if (err) {
            if (err.code === 'ENOENT') {
              console.warn('⚠️ Image file not found, skipping deletion');
            } else {
              console.error('❌ Error deleting image:', err);
            }
          } else {
            console.log(`🧹 Image ${imgFile} deleted successfully`);
          }
        });
      }

      res.json({ message: `Room ID ${id} and associated image deleted successfully` });
    });
  });
});



// ✅ Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
