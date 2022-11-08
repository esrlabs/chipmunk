import { CLIAction } from './action';
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
                `-C /path/file_name_a /path/file_name_b`,
                `-C *.log`,
                `-C /path/*.log /path/file_name.log`,
            ],
        };
    }
    public execute(cli: Service, args: string[]): Promise<string[]> {
        const checked = this.find(args);
        if (checked.files.length === 0) {
            return Promise.resolve(args);
        }
        const files = this.validate(cli.cwd, checked.files);
        if (files.length === 0) {
            return Promise.resolve(checked.args);
        }
        return new Promise((resolve, _reject) => {
            Requests.IpcRequest.send(
                Requests.Cli.Concat.Response,
                new Requests.Cli.Concat.Request({ files }),
            )
                .then((response) => {
                    if (response.sessions === undefined) {
                        return;
                    }
                    cli.setSessions(response.sessions);
                })
                .catch((err: Error) => {
                    cli.log().error(`Fail apply CLI.Concat: ${err.message}`);
                })
                .finally(() => {
                    resolve(checked.args);
                });
        });
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

    protected validate(cwd: string, files: string[]): string[] {
        return files
            .map((file) => {
                if (fs.existsSync(file)) {
                    return file;
                }
                if (fs.existsSync(path.resolve(cwd, file))) {
                    return path.resolve(cwd, file);
                }
                return undefined;
            })
            .filter((f) => f !== undefined) as string[];
    }
}
