import { CLIAction, Type } from './action';
import { Service } from '@service/cli';
import { UDPTransportSettings } from 'platform/types/transport/udp';

import * as Requests from 'platform/ipc/request';

const ARGS = ['--udp'];

export class Action extends CLIAction {
    static help(): {
        keys: string;
        desc: string;
        examples: string[];
    } {
        return {
            keys: ARGS.join(' '),
            desc: `Will connect by UDP to given address and multicasts addresses. If argument -p (--parser) isn't used, would be used plaint text parser. Declaration on interface is optional.`,
            examples: [
                `syntaxt: cm --udp "addr|multicast_addr,[interface];..."`,
                `Multicast with interfaces`,
                `cm --udp "0.0.0.0:8888|234.2.2.2,0.0.0.0"`,
                `cm --udp "0.0.0.0:8888|234.2.2.2,0.0.0.0;234.2.2.3,0.0.0.0" -S "error"`,
                `Multicast without interfaces`,
                `cm --udp "0.0.0.0:8888|234.2.2.2"`,
                `cm --udp "0.0.0.0:8888|234.2.2.2;234.2.2.3"`,
            ],
        };
    }

    public name(): string {
        return 'UDP connecting';
    }

    public execute(cli: Service, args: string[]): Promise<string[]> {
        const checked = this.find(args);
        if (checked.settings === undefined) {
            return Promise.resolve(checked.args);
        } else if (checked.settings instanceof Error) {
            return Promise.reject(checked.settings);
        }
        const source = this.extract(checked.settings);
        if (source instanceof Error) {
            return Promise.reject(source);
        }
        return new Promise((resolve, _reject) => {
            Requests.IpcRequest.send(
                Requests.Cli.Udp.Response,
                new Requests.Cli.Udp.Request({
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
                    cli.log().error(`Fail apply CLI.Udp: ${err.message}`);
                })
                .finally(() => {
                    resolve(checked.args);
                });
        });
    }

    public test(_cwd: string, args: string[]): string[] | Error {
        const checked = this.find(args);
        if (checked.settings === undefined) {
            return checked.args;
        } else if (checked.settings instanceof Error) {
            return checked.settings;
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

    protected find(args: string[]): { args: string[]; settings: string | Error | undefined } {
        const flag = args.findIndex((arg) => ARGS.includes(arg));
        if (flag === -1) {
            return { args, settings: undefined };
        }
        if (flag === args.length - 1) {
            args.pop();
            return { args, settings: new Error(`Flag is found, but not connection parameters`) };
        }
        const settings = args[flag + 1];
        if (settings.trim().startsWith('-')) {
            args.pop();
            return {
                args,
                settings: new Error(`Flag is found, but not connection parameters has been found`),
            };
        }
        args.splice(flag, 2);
        return { args, settings };
    }

    protected extract(settings: string): UDPTransportSettings | Error {
        settings = settings.replace(/\s/gi, '');
        const parts = settings.split('|');
        if (parts.length !== 2) {
            return new Error(
                `Expecting definition for addr and multicast splitted with "|". Use -h (--help) for more details`,
            );
        }
        if (parts[0].length === 0) {
            return new Error(`Fail to find addr to connect. Use -h (--help) for more details`);
        }
        if (parts[1].length === 0) {
            return new Error(
                `Fail to find multicast defenitions. Use -h (--help) for more details`,
            );
        }
        let error: Error | undefined;
        const multicast = parts[1].split(';').map((pair) => {
            if (error !== undefined) {
                return {
                    multiaddr: '',
                    interface: undefined,
                };
            }
            const pairs = pair.split(',');
            if (pairs.length !== 1 && pairs.length !== 2) {
                error = new Error(
                    `Each multicast defenition should include address and interface (or at least mutlicast address). Use -h (--help) for more details `,
                );
            }
            if (pairs.length === 1 && pairs[0].length === 0) {
                error = new Error(
                    `Each multicast defenition should include at least address. Use -h (--help) for more details `,
                );
            }
            if (pairs.length === 2 && pairs[0].length === 0 && pairs[1].length === 0) {
                error = new Error(
                    `Each multicast defenition should include address and interface. Use -h (--help) for more details `,
                );
            }
            return {
                multiaddr: pairs[0],
                interface: pairs.length === 1 ? undefined : pairs[1],
            };
        });
        if (error instanceof Error) {
            return error;
        }
        return {
            bind_addr: parts[0],
            multicast,
        };
    }
}
