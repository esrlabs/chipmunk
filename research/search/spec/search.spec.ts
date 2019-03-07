// tslint:disable

/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import * as path from 'path';
import * as fs from 'fs';
import { StdoutController } from 'custom.stdout';

import { Fragment } from '../src/search';

const LOG_FILE_BIG = './spec/logs/big.log';
const LOG_FILE_BIGGEST = './spec/logs/biggest.log';
const LOG_FILE_SMALL = './spec/logs/small.log';
const stdout = new StdoutController(process.stdout);

describe('Search', () => {

    let originalTimeout: any;

    beforeEach(function() {
        originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 100000;
    });

    afterEach(function() {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
    });

    it('search', (done: Function) => {
        const start = Date.now();
        const stream = fs.createReadStream(LOG_FILE_BIGGEST, { encoding: 'utf8' });
        let size = 0;
        let index = 0;
        let found = 0;
        let offset = 0;
        let commonResult: { [reg: string]: number[] } = {};
        stream.on('data', (chunk: string) => {
            size += chunk.length;
            const fragment: Fragment = new Fragment(offset, 1000000, chunk);
            // const results: any = fragment.find([/2116\s*9026/gi, /2116\s*5212/gi]);  // For SMALL
            // const results: any = fragment.find(/2116\s*9026/gi);                     // For SMALL
            const results: any = fragment.find([/tftpd\s*on\s*192.168.11.10:\d*/gi, /\d\.\d\s*Android/gi, /0x40[\w\d]*8/gi, /04-01 02:00:07.370.*I\/Zygote/gi, /19-03-05 14:13:17,306.*vin:WBA0000140HSVPF40/gi]);     // For BIG
            // const results: any = fragment.find(/tftpd\s*on\s*192.168.11.10:\d*/gi);     // For BIG
            found += results.found;
            offset = results.end;
            const mem = process.memoryUsage();
            Object.keys(results.regs).forEach((reg: string) => {
                if (commonResult[reg] === undefined) {
                    commonResult[reg] = results.regs[reg];
                } else {
                    commonResult[reg].push(...results.regs[reg]);
                }
            });
            stdout.out(`RAM: ${(mem.heapUsed / 1024 / 1024).toFixed(2)}/${(mem.heapTotal / 1024 / 1024).toFixed(2)}Mb / chunk ${index++} / read ${(size / 1024 / 1024).toFixed(2)}Mb / found: ${found}; lines: ${offset}`, 'summury');
        });
        stream.on('end', () => {
            const end = Date.now();
            console.log(`Read ${(size / 1024 / 1024).toFixed(2)}Mb (${offset} rows) in: ${(end - start) / 1000}s; speed: ${((size / 1024 / 1024) / ((end - start) / 1000)).toFixed(2)}Mb/sec`);
            done();
        });
    });


});
