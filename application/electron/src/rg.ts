import { rgPath } from 'vscode-ripgrep';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
const cmd: string = rgPath.replace(/\bnode_modules\.asar\b/, 'node_modules.asar.unpacked');

const readStream = fs.createReadStream('/Users/dmitry.astafyev/WebstormProjects/logviewer/logs_examples/small.log', { start: 90, end: 999, autoClose: false, encoding: 'utf8' });
readStream.on('open', (fd) => {
    const rg = spawn(cmd, ['-N', '-e', 'no nitz but one TZ'], {
        stdio: [readStream, 'pipe', 'pipe'],
    });
    
    rg.stdout.on('data', (chunk) => {
        console.log(chunk.toString());
    });

    readStream.on('data', (chunk) => {
        console.log(chunk);
    });
    
    readStream.on('end', (chunk) => {
        console.log('END');
    });
});

