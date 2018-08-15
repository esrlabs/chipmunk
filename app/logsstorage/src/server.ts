const CONFIG = require('../config');

import express = require('express');
import { Request, Response } from 'express';
import Controller from './controller';
import Cleaner from './cleaner';

const app = express();

app.use((req: Request, res: Response, next: Function) => {
    if (req.method !== 'POST') {
        return next();
    }
    let rawBodyStr = '';
    req.on('data', (data)=>{
        rawBodyStr += data;
    });
    req.on('end', ()=>{
        (req as any).rawBodyStr = rawBodyStr;
        next();
    });
});

app.use((req: Request, res: Response, next: Function) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

const controller = new Controller(app);

app.listen(CONFIG.PORT);

const cleaner = new Cleaner();
