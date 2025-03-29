
import express from 'express';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path'; 

const app = express();

app.listen(3000, () => {
    console.log('Server started at PORT 3000');
});
