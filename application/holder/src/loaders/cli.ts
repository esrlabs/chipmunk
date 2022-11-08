import { tools } from 'rustcore';
import * as handlers from '@service/cli/index';

export const DEV_EXECUTOR_PATH = 'node_modules/electron/dist/electron';

export function check() {
    // TODO:
    // - send as argument PID of current process
    // - check and kill previous process by given PID

    if (!process.stdout.isTTY) {
        // Application runs out of terminal. No needs to do any with CLI
        return;
    }
    const args = process.argv.slice();
    const executor = args.shift();
    if (executor === undefined) {
        // Unexpected amount of arguments
        return;
    }
    if (executor.indexOf(DEV_EXECUTOR_PATH) !== -1) {
        // Developing mode
        return;
    }
    const help = args.find((a) => ['-h', '-H', '-?', '--help'].includes(a)) !== undefined;
    if (help) {
        const fill = (str: string, width: number): string => {
            if (str.length >= width) {
                return str;
            }
            return `${str}${' '.repeat(width - str.length)}`;
        };
        const list = [
            handlers.OpenFile.help(),
            handlers.ConcatFiles.help(),
            handlers.Search.help(),
        ];
        let keysWidth = 0;
        list.forEach((desc) => {
            if (desc.keys.length > keysWidth) {
                keysWidth = desc.keys.length;
            }
        });
        keysWidth += 4;
        list.forEach((desc) => {
            process.stdout.write(`${fill(desc.keys, keysWidth)}${desc.desc}\n`);
            desc.examples.forEach((ex) => {
                process.stdout.write(`${fill('', keysWidth)}${ex}\n`);
            });
        });
    }
    process.stdin.end();
    process.stdin.destroy();
    !help &&
        tools.execute(executor, args).catch((err: Error) => {
            console.log(`Fail to detach application process: ${err.message}`);
        });
    process.exit(0);
}

check();
