import { CLIAction, Type } from './action';
import { Service } from '@service/cli';

import * as fs from 'fs';
import * as path from 'path';
import * as Requests from 'platform/ipc/request';

const ARGS = ['-C', '--concat'];

export class Action extends CLIAction {
    static help(): {
        keys: string;
        desc: string;
        examples: string[];
    } {
        return {
            keys: ARGS.join(' '),
            desc: `Concatenate the given list of files. Files with different types would be concatenated in separate tabs (sessions). As input can be used mask`,
            examples: [
                `cm -C /path/file_name_a /path/file_name_b`,
                `cm -C *.log`,
                `cm -C /path/*.log /path/file_name.log`,
            ],
        };
    }

    public name(): string {
        return 'Concat files';
    }

    public execute(cli: Service, args: string[]): Promise<string[]> {
        const checked = this.find(args);
        if (checked.files.length === 0) {
            return Promise.resolve(args);
        }
        const files = this.validate(cli.cwd, checked.files);
        if (files.invalid.length !== 0) {
            return Promise.reject(new Error(`Invalid files: ${files.invalid.join(', ')}`));
        }
        if (files.valid.length === 0) {
            return Promise.resolve(checked.args);
        }
        return new Promise((resolve, _reject) => {
            Requests.IpcRequest.send(
                Requests.Cli.Concat.Response,
                new Requests.Cli.Concat.Request({ files: files.valid }),
            )
                .then((response) => {
                    if (response.sessions === undefined) {
                        return;
                    }
                    cli.state().sessions(response.sessions);
                })
                .catch((err: Error) => {
                    cli.log().error(`Fail apply CLI.Concat: ${err.message}`);
                })
                .finally(() => {
                    resolve(checked.args);
                });
        });
    }

    public test(cwd: string, args: string[]): string[] | Error {
        const checked = this.find(args);
        if (checked.files.length === 0) {
            return args;
        }
        const files = this.validate(cwd, checked.files);
        if (files.invalid.length === 0) {
            return checked.args;
        } else {
            return new Error(`Invalid paths: \n${files.invalid.join('\n\t')}`);
        }
    }

    public type(): Type {
        return Type.Action;
    }

    protected find(args: string[]): { args: string[]; files: string[] } {
        const files: string[] = [];
        let started = false;
        let stopped = false;
        args = args.filter((arg) => {
            if (stopped) {
                return true;
            }
            if (ARGS.includes(arg)) {
                started = true;
                return false;
            }
            if (!started) {
                return true;
            }
            if (started && arg.trim().startsWith('-')) {
                stopped = true;
                return true;
            }
            files.push(arg);
            return false;
        });
        return {
            args,
            files,
        };
    }

    protected validate(cwd: string, files: string[]): { valid: string[]; invalid: string[] } {
        const result: { valid: string[]; invalid: string[] } = {
            valid: [],
            invalid: [],
        };
        files.forEach((file) => {
            if (fs.existsSync(file)) {
                result.valid.push(file);
                return;
            }
            if (fs.existsSync(path.resolve(cwd, file))) {
                result.valid.push(path.resolve(cwd, file));
                return;
            }
            result.invalid.push(file);
        });
        return result;
    }
}
