import * as fs from 'fs';
import * as Streams from 'stream';

let line: number = 0;
const convertor = new Streams.Transform({
    transform: (chunk: Buffer, encoding: string, callback: Streams.TransformCallback) => {
        let output: string = chunk.toString('utf8');
        output = output.replace(/\r?\n/gi, () => {
            const injection: string = `\u0002${line ++}\u0002\n`;
            return injection;
        });
        callback(undefined, output);
    }
});

const start = Date.now();
const source = '/Users/dmitry.astafyev/WebstormProjects/logviewer/logs_examples/small.log';
const target = '/Users/dmitry.astafyev/WebstormProjects/logviewer/logs_examples/small_copy.log';
const reader = fs.createReadStream(source);
const writer = fs.createWriteStream(target);
reader
    .pipe(convertor)
    .pipe(writer, { end: false });
//reader.pipe(writer, { end: false });
reader.on('end', () => {
    console.log(`DONE IN: ${((Date.now() - start) / 1000).toFixed(2)}s`);
});
