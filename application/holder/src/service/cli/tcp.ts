import { CLIAction, Type } from './action';
import { Service } from '@service/cli';
import { TCPTransportSettings } from 'platform/types/transport/tcp';

import * as Requests from 'platform/ipc/request';

const ARGS = ['--tcp'];

export class Action extends CLIAction {
    static help(): {
        keys: string;
        desc: string;
        examples: string[];
    } {
        return {
            keys: ARGS.join(' '),
            desc: `Will connect by TCP to given address. If argument -p (--parser) isn't used, would be used plaint text parser.`,
            examples: [
                `syntaxt: cm --tcp "addr"`,
                `cm --tcp "0.0.0.0:8888"`,
                `cm --tcp "0.0.0.0:8888" -S "error"`,
            ],
        };
    }

    public name(): string {
        return 'TCP connecting';
    }

    public execute(cli: Service, args: string[]): Promise<string[]> {
        const checked = this.find(args);
        if (checked.source === undefined) {
            return Promise.resolve(checked.args);
        } else if (checked.source instanceof Error) {
            return Promise.reject(checked.source);
        }
        const source = checked.source;
        return new Promise((resolve, _reject) => {
            Requests.IpcRequest.send(
                Requests.Cli.Tcp.Response,
                new Requests.Cli.Tcp.Request({
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
                    cli.log().error(`Fail apply CLI.Tcp: ${err.message}`);
                })
                .finally(() => {
                    resolve(checked.args);
                });
        });
    }

    public test(_cwd: string, args: string[]): string[] | Error {
        const checked = this.find(args);
        if (checked.source === undefined) {
            return checked.args;
        } else if (checked.source instanceof Error) {
            return checked.source;
        }
        return checked.args;
    }

    public type(): Type {
        return Type.Action;
    }

    protected find(args: string[]): {
        args: string[];
        source: TCPTransportSettings | Error | undefined;
    } {
        const flag = args.findIndex((arg) => ARGS.includes(arg));
        if (flag === -1) {
            return { args, source: undefined };
        }
        if (flag === args.length - 1) {
            args.pop();
            return { args, source: new Error(`Flag is found, but no address is missed`) };
        }
        const bind_addr = args[flag + 1];
        if (bind_addr.trim().startsWith('-')) {
            args.pop();
            return { args, source: new Error(`Flag is found, but no address has been found`) };
        }
        args.splice(flag, 2);
        return { args, source: { bind_addr } };
    }
}
