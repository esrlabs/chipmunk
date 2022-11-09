import { tools } from 'rustcore';

import * as handlers from '@service/cli/index';

export const DEV_EXECUTOR_PATH = 'node_modules/electron/dist/electron';

function output(str: string, from: number, offsetFromSecond = false) {
    const offset = ' '.repeat(from);
    const columns = process.stdout.columns < 20 ? 20 : process.stdout.columns;
    let out = str;
    let interation = 0;
    while (out.length > 0) {
        if ((interation === 0 && !offsetFromSecond) || interation > 0) {
            out = `${offset}${out}`;
        }
        if (out.length > columns) {
            process.stdout.write(`${out.substring(0, columns)}\n`);
            out = out.substring(columns, out.length);
        } else {
            process.stdout.write(out);
            out = '';
        }
        interation += 1;
    }
}

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
            handlers.Stdout.help(),
            handlers.Tcp.help(),
            handlers.Udp.help(),
            handlers.Serial.help(),
            handlers.Search.help(),
            handlers.Parser.help(),
        ];
        let keysWidth = 0;
        list.forEach((desc) => {
            if (desc.keys.length > keysWidth) {
                keysWidth = desc.keys.length;
            }
        });
        keysWidth += 4;
        list.forEach((desc) => {
            output(`${fill(desc.keys, keysWidth)}${desc.desc}\n`, keysWidth, true);
            desc.examples.forEach((ex) => {
                output(`${fill('', keysWidth)}${ex}\n`, keysWidth, true);
            });
        });
    }
    let checking = args.slice();
    let hasErrors = false;
    [
        new handlers.OpenFile(),
        new handlers.ConcatFiles(),
        new handlers.Stdout(),
        new handlers.Tcp(),
        new handlers.Udp(),
        new handlers.Serial(),
        new handlers.Search(),
        new handlers.Parser(),
    ].forEach((handler) => {
        const args = handler.test(process.cwd(), checking);
        if (args instanceof Error) {
            hasErrors = true;
            output(`${handler.name()}:: ${args.message}`, 0);
        } else {
            checking = args;
        }
    });
    if (checking.length !== 0) {
        hasErrors = true;
        output(`Unknown arguments: \n- ${checking.join('\n- ')}`, 0);
    }
    process.stdin.end();
    process.stdin.destroy();
    !help &&
        !hasErrors &&
        tools.execute(executor, args).catch((err: Error) => {
            console.log(`Fail to detach application process: ${err.message}`);
        });
    process.exit(0);
}

check();
