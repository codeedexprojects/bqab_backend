const dotenv = require('dotenv');

const loadEnv = () => {
  if (process.env.NODE_ENV !== 'production') {
  const result = dotenv.config();
    if (result.error) {
      throw result.error;
    }
  }
};

module.exports = { loadEnv };