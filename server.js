const express = require('express');
const path = require('path');
const cors = require('cors'); 

const app = express();
const PORT = 3000;

// Middleware setup
app.use(cors());
// Serve all static files (index.html, CSS, JS, etc.) from the current directory
app.use(express.static(__dirname));

// Simple root handler to ensure index.html loads
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log('✅ Server started successfully!');
    console.log(`Algorithmic Systemic Risk Stress-Tester is running on http://localhost:${PORT}`);
    console.log(`Open your browser to the URL above to start the simulation.`);
});