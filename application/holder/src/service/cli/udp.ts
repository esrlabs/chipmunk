import { CLIAction, Type } from './action';
import { Service } from '@service/cli';

import * as Requests from 'platform/ipc/request';
import * as Factory from 'platform/types/observe/factory';
import * as $ from 'platform/types/observe';

export class Action extends CLIAction {
    protected settings: $.Origin.Stream.Stream.UDP.IConfiguration | undefined;
    protected error: Error[] = [];

    public name(): string {
        return 'UDP connecting';
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
                        .udp(this.settings)
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
                    cli.log().error(`Fail apply CLI.Udp: ${err.message}`);
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

    protected extract(settings: string): $.Origin.Stream.Stream.UDP.IConfiguration | Error {
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
