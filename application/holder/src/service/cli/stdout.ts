import { CLIAction, Type } from './action';
import { Service } from '@service/cli';

import * as Requests from 'platform/ipc/request';

const ARGS = ['--std', '--stdout'];

export class Action extends CLIAction {
    static help(): {
        keys: string;
        desc: string;
        examples: string[];
    } {
        return {
            keys: ARGS.join(' '),
            desc: `Will execute given command(s) and post output (stdout) into session. If argument -p (--parser) isn't used, would be used plaint text parser.`,
            examples: [
                `cm --std "journalctl -r"`,
                `cm --stdout "journalctl -r" -S "error"`,
                `cm --stdout "journalctl -r" "adb logcat" --search "error" "warning"`,
            ],
        };
    }

    public name(): string {
        return 'Grabbing from stdout';
    }

    public execute(cli: Service, args: string[]): Promise<string[]> {
        const checked = this.find(args);
        if (checked.commands.length === 0) {
            return Promise.resolve(checked.args);
        }
        return new Promise((resolve, _reject) => {
            Requests.IpcRequest.send(
                Requests.Cli.Stdout.Response,
                new Requests.Cli.Stdout.Request({
                    commands: checked.commands,
                    cwd: cli.cwd,
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
                .finally(() => {
                    resolve(checked.args);
                });
        });
    }

    public test(_cwd: string, args: string[]): string[] | Error {
        if (args.filter((a) => ARGS.includes(a)).length > 1) {
            return new Error(`"${ARGS.join(', ')}" key(s) is defined multiple times.`);
        }
        const checked = this.find(args);
        return checked.args;
    }

    public type(): Type {
        return Type.Action;
    }

    protected find(args: string[]): { args: string[]; commands: string[] } {
        const commands: string[] = [];
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
            commands.push(arg);
            return false;
        });
        return {
            args,
            commands,
        };
    }
}
