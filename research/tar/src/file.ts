import * as fs from 'fs';
import * as tar from 'tar';

const source = '/Users/dmitry.astafyev/WebstormProjects/logviewer/electron.github/application/sandbox/xterminal';
const target = '/Users/dmitry.astafyev/WebstormProjects/logviewer/electron.github/application/sandbox/xterminal.tgz';

tar.c({
    file: target,
    cwd: '/Users/dmitry.astafyev/WebstormProjects/logviewer/electron.github/application/sandbox/',
}, ['xterminal'], (error: Error | undefined) => {
    console.log('done');
    tar.x({
        file: target,
        cwd: '/Users/dmitry.astafyev/WebstormProjects/logviewer/electron.github/research/outputzip',
    }).then(() => {
        console.log('all done');
    });
});
