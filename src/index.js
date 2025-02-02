import dotenv from 'dotenv';
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

import connectDb from './db/index.js';
import { app } from './app.js';

const PORT = process.env.PORT || 3000;

connectDb()
  .then(() => {
    app.listen(PORT || 8000, () => {
      console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
    });
  })
  .catch((err) => {
    console.log('MongoDb connection failed !!!', err);
  });
