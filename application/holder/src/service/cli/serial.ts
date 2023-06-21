import { CLIAction, Type } from './action';
import { Service } from '@service/cli';

import * as Requests from 'platform/ipc/request';
import * as Factory from 'platform/types/observe/factory';
import * as $ from 'platform/types/observe';

export class Action extends CLIAction {
    // static help(): {
    //     keys: string;
    //     desc: string;
    //     examples: string[];
    // } {
    //     return {
    //         keys: ARGS.join(' '),
    //         desc: `Will connect to serial port using given settings. If argument -p (--parser) isn't used, would be used plaint text parser.`,
    //         examples: [
    //             `syntaxt: cm --serial "path;baud_rate;data_bits;flow_control;parity;stop_bits"`,
    //             `cm --serial "0.0.0.0:8888|234.2.2.2,0.0.0.0"`,
    //             `cm --serial "0.0.0.0:8888|234.2.2.2,0.0.0.0;234.2.2.3,0.0.0.0" -S "error"`,
    //         ],
    //     };
    // }

    protected settings: $.Origin.Stream.Stream.Serial.IConfiguration | undefined;
    protected error: Error[] = [];

    public name(): string {
        return 'Serial port connecting';
    }

    public argument(_cwd: string, arg: string): string {
        const settings = this.extract(arg);
        if (settings instanceof Error) {
            this.error.push(new Error(`Fail to parse settings "${arg}":  ${settings.message}`));
            return '';
        }
        this.settings = settings;
        return arg;
    }

    public errors(): Error[] {
        return this.error;
    }

    public execute(cli: Service): Promise<void> {
        if (this.error.length > 0) {
            return Promise.reject(
                new Error(
                    `Handler cannot be executed, because errors: \n${this.error
                        .map((e) => e.message)
                        .join('\n')}`,
                ),
            );
        }
        return new Promise((resolve, _reject) => {
            if (this.settings === undefined) {
                return resolve();
            }
            Requests.IpcRequest.send(
                Requests.Cli.Observe.Response,
                new Requests.Cli.Observe.Request({
                    observe: new Factory.Stream()
                        .serial(this.settings)
                        .protocol(cli.state().parser())
                        .get()
                        .sterilized(),
                }),
            )
                .then((response) => {
                    if (response.session === undefined) {
                        return;
                    }
                    cli.state().sessions([response.session]);
                })
                .catch((err: Error) => {
                    cli.log().error(`Fail apply CLI.Serial: ${err.message}`);
                })
                .finally(resolve);
        });
    }

    public type(): Type {
        return Type.Action;
    }

    public defined(): boolean {
        return this.settings !== undefined;
    }

    protected extract(settings: string): $.Origin.Stream.Stream.Serial.IConfiguration | Error {
        settings = settings.replace(/\s/gi, '');
        const parts = settings.split(';');
        if (parts.length !== 6) {
            return new Error(
                `Expecting definition for path; baud_rate; data_bits; flow_control; parity; stop_bits. Use -h (--help) for more details`,
            );
        }
        let error: Error | undefined;
        const parameters: $.Origin.Stream.Stream.Serial.IConfiguration = {
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
