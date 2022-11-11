import { CLIAction, Type } from './action';
import { Service } from '@service/cli';

import * as Requests from 'platform/ipc/request';

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
            Requests.IpcRequest.send(
                Requests.Cli.Stdout.Response,
                new Requests.Cli.Stdout.Request({
                    commands: this.commands,
                    cwd: this.cwd,
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
