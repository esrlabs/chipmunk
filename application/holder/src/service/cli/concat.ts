import { CLIAction, Type } from './action';
import { Service } from '@service/cli';

import * as fs from 'fs';
import * as path from 'path';
import * as Requests from 'platform/ipc/request';
import * as Factory from 'platform/types/observe/factory';

export class Action extends CLIAction {
    protected files: string[] = [];
    protected error: Error[] = [];

    public name(): string {
        return 'Concat files';
    }

    public argument(cwd: string, arg: string): string {
        if (fs.existsSync(arg)) {
            this.files.push(arg);
            return arg;
        }
        if (fs.existsSync(path.resolve(cwd, arg))) {
            this.files.push(path.resolve(cwd, arg));
            return path.resolve(cwd, arg);
        }
        this.error.push(new Error(`Fail to find file: ${arg} or ${path.resolve(cwd, arg)}`));
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
                Requests.Cli.Observe.Response,
                new Requests.Cli.Observe.Request({
                    observe: new Factory.Concat().files(this.files).get().sterilized(),
                }),
            )
                .then((response) => {
                    if (response.session === undefined) {
                        return;
                    }
                    cli.state().sessions([response.session]);
                })
                .catch((err: Error) => {
                    cli.log().error(`Fail apply ${this.name()} ${err.message}`);
                })
                .finally(resolve);
        });
    }

    public type(): Type {
        return Type.Action;
    }

    public defined(): boolean {
        return this.files.length > 0;
    }
}
