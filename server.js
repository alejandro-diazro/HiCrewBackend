const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const pilotRoutes = require('./routes/pilots');
const ruleRoutes = require('./routes/rules');
const socialNetworkRoutes = require('./routes/socialNetworks');
const documentationRoutes = require('./routes/documentation');
const eventRoutes = require('./routes/events');
const notamRoutes = require('./routes/notams');
const simulatorRoutes = require('./routes/simulators');
const airlineRoutes = require('./routes/airlines');
const medalRoutes = require('./routes/medals');
const rankRoutes = require('./routes/ranks');
const airportRoutes = require('./routes/airports');
const aircraftRoutes = require('./routes/aircraft');
const fleetRoutes = require('./routes/fleet');
const paintkitRoutes = require('./routes/paintkits');
const routeRoutes = require('./routes/routes');
const requestJoinRoutes = require('./routes/request-joins');
const tourRoutes = require('./routes/tours');
const legRoutes = require('./routes/legs');
const reportTourRoutes = require('./routes/report-tours');
const permissionsRouter = require('./routes/permissions');
const configRouter = require('./routes/config');
const staffListRouter = require('./routes/staff-list');


dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/pilots', pilotRoutes);
app.use('/rules', ruleRoutes);
app.use('/social-networks', socialNetworkRoutes);
app.use('/documentation', documentationRoutes);
app.use('/events', eventRoutes);
app.use('/notams', notamRoutes);
app.use('/simulators', simulatorRoutes);
app.use('/airlines', airlineRoutes);
app.use('/medals', medalRoutes);
app.use('/ranks', rankRoutes);
app.use('/airports', airportRoutes);
app.use('/aircraft', aircraftRoutes);
app.use('/fleet', fleetRoutes);
app.use('/paintkits', paintkitRoutes);
app.use('/routes', routeRoutes);
app.use('/request-joins', requestJoinRoutes);
app.use('/tours', tourRoutes);
app.use('/legs', legRoutes);
app.use('/report-tours', reportTourRoutes);
app.use('/permissions', permissionsRouter);
app.use('/configs', configRouter);
app.use('/staff-list', staffListRouter);


app.get('/', (req, res) => {
    res.json({ message: 'API HiCrew' });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`Server running in http://localhost:${PORT}`);
});