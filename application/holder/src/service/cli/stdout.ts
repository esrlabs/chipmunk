import { CLIAction, Type } from './action';
import { Service } from '@service/cli';

import * as Requests from 'platform/ipc/request';
import * as Factory from 'platform/types/observe/factory';

export class Action extends CLIAction {
    protected commands: string[] = [];
    protected cwd!: string;
    protected error: Error[] = [];

    public name(): string {
        return 'Grabbing from stdout';
    }

    public argument(cwd: string, arg: string): string {
        if (this.cwd === undefined) {
            this.cwd = cwd;
        }
        if (arg.trim() !== '') {
            this.commands.push(arg);
            return arg;
        }
        this.error.push(new Error(`Command cannot be defined as empty string.`));
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
        if (!this.defined()) {
            return Promise.resolve();
        }
        return new Promise((resolve, _reject) => {
            // TODO: Add support of multiple commands at once
            Requests.IpcRequest.send(
                Requests.Cli.Observe.Response,
                new Requests.Cli.Observe.Request({
                    observe: new Factory.Stream()
                        .process({
                            command: this.commands[0],
                            cwd: this.cwd,
                            envs: {},
                        })
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
                    cli.log().error(`Fail apply CLI.Command: ${err.message}`);
                })
                .finally(resolve);
        });
    }

    public type(): Type {
        return Type.Action;
    }

    public defined(): boolean {
        return this.commands.length > 0;
    }
}
