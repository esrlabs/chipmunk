import { rgPath } from 'vscode-ripgrep';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as Stream from 'stream';
import * as tty from 'tty';

const cmd: string = rgPath.replace(/\bnode_modules\.asar\b/, 'node_modules.asar.unpacked');

const readStream = fs.createReadStream('/Users/dmitry.astafyev/WebstormProjects/logviewer/logs_examples/tm_b.log', { start: 90, end: 999, autoClose: true, encoding: 'utf8' });
readStream.on('open', (fd) => {

    const rg = spawn(cmd, ['-N', '-e', '12:38', '-'], {
        stdio: ['pipe', 'inherit', 'ignore'],
    });
    //process.stdin.write('fdsfds0.9149597fsd\n\r');
    //process.stdin.end('\n\r');
    readStream.pipe(rg.stdin);


    readStream.on('data', (chunk) => {
        // rg.stdin.write('\n\r');
        console.log(`READ: ${chunk}`);
    });
    
    readStream.on('end', (chunk) => {
        console.log(`END READING: `);
    });
});
