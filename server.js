const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const pilotRoutes = require('./routes/pilots');
const ruleRoutes = require('./routes/rules');
const socialNetworkRoutes = require('./routes/socialNetworks');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/pilots', pilotRoutes);
app.use('/rules', ruleRoutes);
app.use('/social-networks', socialNetworkRoutes);

app.get('/', (req, res) => {
    res.json({ message: 'API HiCrew' });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});