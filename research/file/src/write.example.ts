import * as fs from 'fs';
function fill(input: number, count: number) {
    const c = input.toString().length;
    return `${'0'.repeat(count - c)}${input}`;
}

function getDateTime(t: number) {
    const date: Date = new Date(t);
    return `${fill(date.getMonth() + 1, 2)}-${fill(date.getDate(), 2)}-${date.getFullYear()} ${fill(date.getHours(), 2)}:${fill(date.getMinutes(), 2)}:${fill(date.getSeconds(), 2)}.${fill(date.getMilliseconds(), 3)}`;
}

const target = '/Users/dmitry.astafyev/WebstormProjects/logviewer/logs_examples/tm_b-s.log';
// const target = '/Users/dmitry.astafyev/WebstormProjects/logviewer/logs_examples/timestamp_a-s.log';
const writer = fs.createWriteStream(target);
let timestamp: number = Date.now();
const max = 60000;
let buffer = '';
for (let i = max; i >= 0; i -= 1) {
    const row: string = `${getDateTime(timestamp)} ${max - i} ${Math.random()} ${Math.random()} ${Math.random()}`;
    timestamp += 15 * 1000;
    buffer += row + '\n';
    if (buffer.length > 100000) {
        writer.write(buffer);
        buffer = '';
        console.log(i);
    }
}
writer.write(buffer);
