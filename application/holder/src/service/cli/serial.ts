import { CLIAction, Type } from './action';
import { Service } from '@service/cli';
import { SerialTransportSettings } from 'platform/types/transport/serial';

import * as Requests from 'platform/ipc/request';

const ARGS = ['--serial'];

export class Action extends CLIAction {
    static help(): {
        keys: string;
        desc: string;
        examples: string[];
    } {
        return {
            keys: ARGS.join(' '),
            desc: `Will connect to serial port using given settings. If argument -p (--parser) isn't used, would be used plaint text parser.`,
            examples: [
                `syntaxt: cm --serial "path;baud_rate;data_bits;flow_control;parity;stop_bits"`,
                `cm --serial "0.0.0.0:8888|234.2.2.2,0.0.0.0"`,
                `cm --serial "0.0.0.0:8888|234.2.2.2,0.0.0.0;234.2.2.3,0.0.0.0" -S "error"`,
            ],
        };
    }

    public name(): string {
        return 'Serial port connecting';
    }

    public execute(cli: Service, args: string[]): Promise<string[]> {
        const checked = this.find(args);
        if (checked.settings === undefined) {
            return Promise.resolve(checked.args);
        }
        const source = this.extract(checked.settings);
        if (source instanceof Error) {
            return Promise.reject(source);
        }
        return new Promise((resolve, _reject) => {
            Requests.IpcRequest.send(
                Requests.Cli.Serial.Response,
                new Requests.Cli.Serial.Request({
                    source,
                    parser: cli.state().parser(),
                }),
            )
                .then((response) => {
                    if (response.sessions === undefined) {
                        return;
                    }
                    cli.state().sessions(response.sessions);
                })
                .catch((err: Error) => {
                    cli.log().error(`Fail apply CLI.Serial: ${err.message}`);
                })
                .finally(() => {
                    resolve(checked.args);
                });
        });
    }

    public test(_cwd: string, args: string[]): string[] | Error {
        if (args.filter(a => ARGS.includes(a)).length > 1) {
            return new Error(`"${ARGS.join(', ')}" key(s) is defined multiple times.`);
        }
        const checked = this.find(args);
        if (checked.settings === undefined) {
            return checked.args;
        }
        const source = this.extract(checked.settings);
        if (source instanceof Error) {
            return source;
        }
        return checked.args;
    }

    public type(): Type {
        return Type.Action;
    }

    protected find(args: string[]): { args: string[]; settings: string | undefined } {
        const flag = args.findIndex((arg) => ARGS.includes(arg));
        if (flag === -1) {
            return { args, settings: undefined };
        }
        if (flag === args.length - 1) {
            args.pop();
            return { args, settings: undefined };
        }
        const settings = args[flag + 1];
        if (settings.trim().startsWith('-')) {
            args.pop();
            return { args, settings: undefined };
        }
        args.splice(flag, 2);
        return { args, settings };
    }

    protected extract(settings: string): SerialTransportSettings | Error {
        settings = settings.replace(/\s/gi, '');
        const parts = settings.split(';');
        if (parts.length !== 6) {
            return new Error(
                `Expecting definition for path; baud_rate; data_bits; flow_control; parity; stop_bits. Use -h (--help) for more details`,
            );
        }
        let error: Error | undefined;
        const parameters: SerialTransportSettings = {
            path: '',
            baud_rate: -1,
            data_bits: -1,
            flow_control: -1,
            parity: -1,
            stop_bits: -1,
        };
        const keys = ['path', 'baud_rate', 'data_bits', 'flow_control', 'parity', 'stop_bits'];
        parts.forEach((p, i) => {
            if (error instanceof Error) {
                return;
            }
            if (i === 0 && p.trim().length === 0) {
                error = new Error(`Path has invalid value.`);
                return;
            }
            if (i === 0) {
                (parameters as unknown as { [key: string]: string | number })[keys[i]] = p;
            } else if (i !== 0) {
                const value = parseInt(p, 10);
                if (isNaN(value) || !isFinite(value)) {
                    error = new Error(`Parameter "${keys[i]}" has invalid value.`);
                    return;
                }
                (parameters as unknown as { [key: string]: string | number })[keys[i]] = value;
            }
        });
        if (error instanceof Error) {
            return error;
        }
        return parameters;
    }
}
