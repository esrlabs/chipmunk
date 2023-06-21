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
    //         desc: `Will connect by TCP to given address. If argument -p (--parser) isn't used, would be used plaint text parser.`,
    //         examples: [
    //             `syntaxt: cm --tcp "addr"`,
    //             `cm --tcp "0.0.0.0:8888"`,
    //             `cm --tcp "0.0.0.0:8888" -S "error"`,
    //         ],
    //     };
    // }

    protected settings: $.Origin.Stream.Stream.TCP.IConfiguration | undefined;
    protected error: Error[] = [];

    public name(): string {
        return 'TCP connecting';
    }

    public argument(_cwd: string, arg: string): string {
        if (arg.trim().length > 0) {
            this.settings = { bind_addr: arg };
            return arg;
        }
        this.error.push(new Error(`Fail to parse settings "${arg}".`));
        return '';
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
                        .tcp(this.settings)
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
                    cli.log().error(`Fail apply CLI.Tcp: ${err.message}`);
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
}
