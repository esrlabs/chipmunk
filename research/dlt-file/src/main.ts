import * as fs from 'fs';
import * as DLT from 'dltreader';

const file: string = '/Users/dmitry.astafyev/WebstormProjects/logviewer/logs_examples/DTC_SP21.dlt';
const buffer: DLT.Buffer = new DLT.Buffer();
buffer.on(DLT.Buffer.Events.packet, (message: any) => {
    console.log(message);
});

const reader: fs.ReadStream = fs.createReadStream(file);
reader.on('data', (chunk: Buffer, encoding: string) => {
    buffer.add(chunk);
    // console.log(chunk);
});