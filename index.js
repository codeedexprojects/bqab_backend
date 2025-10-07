const express = require('express');
const { connectDB } = require('./config/database');
const { loadEnv } = require('./config/env');
const app = require('./src/app');
const logger = require('./config/logger');

loadEnv();

const PORT = process.env.PORT || 3006;

connectDB()
  .then(() => {
    const HOST = "0.0.0.0"; 
    app.listen(PORT, HOST, () => {
      logger.info(`🚀 Server running at http://${HOST}:${PORT}`);
    });
  })
  .catch((err) => {
    logger.error('Failed to connect to MongoDB', err);
    process.exit(1);
  });