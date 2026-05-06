const express = require('express');
const api = express();
const path = require('path');
const cors = require('cors');
const port = 3030;

api.use(cors());
api.use(express.static(path.join(__dirname, 'public')));
api.use(express.json());

api.get('/',(req,res) =>{
    res.sendFile(path.join(__dirname, '/public/index.html'));
});

module.exports = api;

api.listen(port, () => {
    console.log(`Server running on port http://localhost:${port}`);
});