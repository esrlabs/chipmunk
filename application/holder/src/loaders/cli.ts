import { tools } from 'rustcore';
import { program as cli, Option } from 'commander';
import { CLIAction } from '@service/cli/action';

import * as handlers from '@service/cli/index';

const DEV_EXECUTOR_PATH = 'node_modules/electron/dist/electron';
const DEV_EXECUTOR_PATH_DARVIN = 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron';

export function getDevExecutorPath(): string {
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
}

function check() {
    // TODO:
    // - send as argument PID of current process
    // - check and kill previous process by given PID
    setup();
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
    if (isDevelopingExecuting(executor)) {
        // Developing mode
        return;
    }
    const errors = collectErrors();
    if (errors.length > 0) {
        errors.forEach((err) => {
            process.stdout.write(`${err.message}\n`);
        });
        process.stdin.end();
        process.stdin.destroy();
        process.exit(0);
    }
    tools.execute(executor, args).catch((err: Error) => {
        console.log(`Fail to detach application process: ${err.message}`);
    });
    process.exit(0);
}
check();
