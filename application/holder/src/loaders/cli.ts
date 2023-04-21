import { program as cli, Option } from 'commander';
import { CLIAction } from '@service/cli/action';
import { spawn } from 'child_process';
import { Socket } from 'net';
import { WriteStream } from 'fs';
import { logger } from './logger';

import * as handlers from '@service/cli/index';

const DEV_EXECUTOR_PATH = 'node_modules/electron/dist/electron';
const DEV_EXECUTOR_PATH_DARVIN = 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron';
const RESTARTING_FLAG = '--app_restarted';
const DEBUG_FLAG = '--debug_mode';

function getDevExecutorPath(): string {
    if (process.platform === 'darwin') {
        return DEV_EXECUTOR_PATH_DARVIN;
    } else {
        return DEV_EXECUTOR_PATH;
    }
}
export function isDevelopingExecuting(path: string): boolean {
    const devPath = getDevExecutorPath();
    return path.toLowerCase().indexOf(devPath.toLowerCase()) !== -1;
}

const CLI_HANDLERS: { [key: string]: CLIAction } = {
    open: new handlers.OpenFile(),
    concat: new handlers.ConcatFiles(),
    stdout: new handlers.Stdout(),
    tcp: new handlers.Tcp(),
    udp: new handlers.Udp(),
    serial: new handlers.Serial(),
    search: new handlers.Search(),
    parser: new handlers.Parser(),
};

export function getActions(): CLIAction[] {
    return Object.keys(CLI_HANDLERS).map((k) => CLI_HANDLERS[k]);
}

function collectErrors(): Error[] {
    const errors: Error[] = [];
    Object.keys(CLI_HANDLERS).forEach((key: string) => {
        errors.push(...CLI_HANDLERS[key].errors());
    });
    return errors;
}

function parser(handler: CLIAction): (value: string, prev: string) => string {
    return handler.argument.bind(handler, process.cwd()) as unknown as (
        value: string,
        prev: string,
    ) => string;
}

function setup() {
    logger.write(`setup CLI: started`);
    cli.addOption(
        new Option(
            '--debug_mode',
            'Will run chipmunk in debug mode. Others CLI commands will be ignored.',
        ),
    );
    cli.addOption(
        new Option(
            '-p, --parser <parser>',
            'Setup defaul parser, which would be used for all stream session.',
        )
            .choices(['dlt', 'text'])
            .argParser(parser(CLI_HANDLERS['parser'])),
    );
    cli.addOption(
        new Option(
            '-s, --search <regexp...>',
            'Collection of filters, which would be applied to each opened session (tab). Ex: cm files -o /path/file_name -s "error" "warning"',
        ).argParser(parser(CLI_HANDLERS['search'])),
    );
    cli.addOption(new Option(RESTARTING_FLAG, 'Hidden option to manage CLI usage').hideHelp());
    const files = cli
        .command('files [filename...]', { isDefault: true })
        .description('Opens file(s) or concat files')
        .action((args: string[]) => {
            if (args.length === 0) {
                return;
            }
            // Opening file as defualt option for "files" command.
            // Note, "files" command also is a default command.
            // It makes "./chipmunk file_name" to open a file
            parser(CLI_HANDLERS['open'])(args[0], '');
        });
    files.option(
        '-o, --open <filename...>',
        'Opens file(s) in separated sessions (tabs). Ex: cm -o /path/file_name_a /path/file_name_b',
        parser(CLI_HANDLERS['open']),
    );
    files.option(
        '-c, --concat <filename...>',
        'Concat file(s). Files will be grouped by type and each type would be opened in separated sessions (tabs)',
        parser(CLI_HANDLERS['concat']),
    );
    const streams = cli
        .command('streams')
        .description('Listens diffrent sources of data and posts its output');
    streams.addOption(
        new Option(
            '--tcp <addr:port>',
            'Creates TCP connection with given address. Ex: cm --tcp "0.0.0.0:8888"',
        ).argParser(parser(CLI_HANDLERS['tcp'])),
    );
    streams.addOption(
        new Option(
            '--udp <addr:port|multicast,interface;>',
            'Creates UDP connection with given address and multicasts. Ex: cm --udp "0.0.0.0:8888|234.2.2.2,0.0.0.0"',
        ).argParser(parser(CLI_HANDLERS['udp'])),
    );
    streams.addOption(
        new Option(
            '--serial <path;baud_rate;data_bits;flow_control;parity;stop_bits>',
            'Creates serial port connection with given parameters. Ex: cm --serial "/dev/port_a;960000;8;1;0;1"',
        ).argParser(parser(CLI_HANDLERS['serial'])),
    );
    streams.addOption(
        new Option(
            '--stdout <command...>',
            'Executes given commands in the scope of one session (tab) and shows mixed output. Ex: cm --stdout "journalctl -r" "adb logcat"',
        ).argParser(parser(CLI_HANDLERS['stdout'])),
    );
    cli.parse();
    logger.write(`setup CLI: done and parsered`);
}

function lock() {
    [process.stdin, process.stdout, process.stderr].forEach((stream) => {
        typeof stream.end === 'function' && stream.end();
        stream.destroy();
    });
    logger.write(`STD's are locked`);
}

function exit() {
    logger.write(`exiting`);
    process.exit(0);
}

function isSyncWriteStream(std: unknown): boolean {
    // Note SyncWriteStream is depricated, but it doesn't mean
    // it isn't used
    return (std as { constructor: { name: string } }).constructor.name === 'SyncWriteStream';
}

function isTTY(): boolean {
    if (typeof process.stdout.isTTY === 'boolean') {
        return process.stdout.isTTY;
    }
    if (
        (process.platform === 'linux' || process.platform === 'darwin') &&
        process.stdout.isTTY === undefined
    ) {
        return false;
    }
    if ((process.stdout as unknown) instanceof Socket) {
        // On windows: gitbash
        return true;
    }
    if (isSyncWriteStream(process.stdout) || (process.stdout as unknown) instanceof WriteStream) {
        // On windows: CMD, PowerShell
        return true;
    }
    return false;
}

function isRestartedAlready(): boolean {
    logger.write(`RESTARTING_FLAG=${process.argv.includes(RESTARTING_FLAG)}`);
    return process.argv.includes(RESTARTING_FLAG);
}

function isDebugMode(): boolean {
    logger.write(`DEBUG_FLAG=${process.argv.includes(DEBUG_FLAG)}`);
    return process.argv.includes(DEBUG_FLAG);
}

function check() {
    if (isDebugMode()) {
        return;
    }
    // TODO:
    // - send as argument PID of current process
    // - check and kill previous process by given PID
    setup();
    if (isRestartedAlready()) {
        return;
    }
    if (!isTTY()) {
        logger.write(`context is TTY`);
        return;
    }
    logger.write(`TTY isn't detected`);
    const args = process.argv.slice();
    const executor = args.shift();
    logger.write(`executor=${executor}`);
    if (executor === undefined) {
        // Unexpected amount of arguments
        return;
    }
    if (isDevelopingExecuting(executor)) {
        logger.write(`developing executing`);
        // Developing mode
        return;
    }
    const errors = collectErrors();
    if (errors.length > 0) {
        errors.forEach((err) => {
            process.stdout.write(`${err.message}\n`);
        });
        lock();
        exit();
    }
    args.push(RESTARTING_FLAG);
    spawn(executor, args, {
        shell: false,
        detached: true,
        stdio: 'ignore',
    });
    logger.write(`${executor} has been spawned`);
    lock();
    exit();
}
check();
