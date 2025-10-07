const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const errorMiddleware = require('./middleware/errorMiddleware');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));









// adminRoutes
const adminRoutes = require('./features/admin/auth/adminRoute')
const adminClubRoutes = require('./features/admin/club/clubRoute')
const adminUserRoutes = require('./features/admin/user/userRoute')






// ADMIN
app.use('/admin/auth',adminRoutes)
app.use('/admin/club',adminClubRoutes)
app.use('/admin/user',adminUserRoutes)



app.use(errorMiddleware);

module.exports = app;