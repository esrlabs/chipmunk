import { CLIAction } from './action';
import { Service } from '@service/cli';

import * as fs from 'fs';
import * as path from 'path';
import * as Requests from 'platform/ipc/request';

const ARGS = ['-O', '--open'];

export class Action extends CLIAction {
    static help(): {
        keys: string;
        desc: string;
        examples: string[];
    } {
        return {
            keys: ARGS.join(' '),
            desc: `Will open given file(s) in separated tabs (sessions). Opening of file is a default command, if file path is a first argument.`,
            examples: [
                `/path/file_name`,
                `-O /path/file_name`,
                `-O /path/file_name_a /path/file_name_b`,
                `/path/file_name.log`,
            ],
        };
    }

    public execute(cli: Service, args: string[]): Promise<string[]> {
        let checked = this.findWithKey(args);
        if (checked.files.length === 0) {
            checked = this.findWithoutKey(args);
        }
        if (checked.files.length === 0) {
            return Promise.resolve(args);
        }
        const files = this.validate(cli.cwd, checked.files);
        if (files.length === 0) {
            return Promise.resolve(checked.args);
        }
        return new Promise((resolve, _reject) => {
            Requests.IpcRequest.send(
                Requests.Cli.Open.Response,
                new Requests.Cli.Open.Request({ files }),
            )
                .then((response) => {
                    if (response.sessions === undefined) {
                        return;
                    }
                    cli.setSessions(response.sessions);
                })
                .catch((err: Error) => {
                    cli.log().error(`Fail apply CLI.Open: ${err.message}`);
                })
                .finally(() => {
                    resolve(checked.args);
                });
        });
    }

    protected findWithKey(args: string[]): { args: string[]; files: string[] } {
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

    protected findWithoutKey(args: string[]): { args: string[]; files: string[] } {
        const files: string[] = [];
        let stopped = false;
        args = args.filter((arg) => {
            if (stopped) {
                return true;
            }
            if (arg.trim().startsWith('-')) {
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
