import { CLIAction, Type } from './action';
import { Service } from '@service/cli';
import { getFileEntities } from '@env/fs';
import { FileType } from 'platform/types/observe/types/file';
import { globSync } from 'glob';
import { error } from 'platform/log/utils';

import * as fs from 'fs';
import * as path from 'path';
import * as Requests from 'platform/ipc/request';
import * as Factory from 'platform/types/observe/factory';
import * as Parser from 'platform/types/observe/parser';

export class Action extends CLIAction {
    protected files: string[] = [];
    protected error: Error[] = [];

    public argument(_target: string | undefined, cwd: string, arg: string): string {
        if (fs.existsSync(arg)) {
            this.files.push(arg);
            return arg;
        }
        if (fs.existsSync(path.resolve(cwd, arg))) {
            this.files.push(path.resolve(cwd, arg));
            return path.resolve(cwd, arg);
        }
        try {
            const files = globSync(arg);
            if (files.length === 0) {
                this.error.push(
                    new Error(`Fail to find file: ${arg} or ${path.resolve(cwd, arg)}`),
                );
                return '';
            }
            this.files = files;
            return arg;
        } catch (e) {
            this.error.push(new Error(`Fail to parse glob pattern: ${error(e)}`));
            return '';
        }
    }

    public errors(): Error[] {
        return this.error;
    }

    public async execute(cli: Service): Promise<void> {
        if (this.error.length > 0) {
            throw new Error(
                `Handler cannot be executed, because errors: \n${this.error
                    .map((e) => e.message)
                    .join('\n')}`,
            );
        }
        if (!this.defined()) {
            return;
        }
        const files = await getFileEntities(this.files);
        if (files instanceof Error) {
            throw files;
        }
        if (files.length === 0) {
            return;
        }
        const factory =
            files.length === 1
                ? new Factory.File().file(files[0].filename)
                : new Factory.Concat().files(files.map((f) => f.filename));

        switch (cli.state().parser()) {
            case Parser.Protocol.Text:
                factory.asText();
                break;
            case Parser.Protocol.Dlt:
                factory.asDlt(Parser.Dlt.Configuration.initial()).type(FileType.Binary);
                break;
            case Parser.Protocol.SomeIp:
                factory.asSomeip(Parser.SomeIp.Configuration.initial()).type(FileType.Binary);
                break;
            case Parser.Protocol.Plugin:
                throw new Error("Plugins aren't supperted in CLI yet.");
        }

        const observe = factory.get();

        return new Promise((resolve, _reject) => {
            Requests.IpcRequest.send(
                Requests.Cli.Observe.Response,
                new Requests.Cli.Observe.Request({
                    observe: [observe.sterilized()],
                }),
            )
                .then((response) => {
                    if (response.session === undefined) {
                        return;
                    }
                    cli.state().sessions([response.session]);
                })
                .catch((err: Error) => {
                    cli.log().error(`Fail apply open-action: ${err.message}`);
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
