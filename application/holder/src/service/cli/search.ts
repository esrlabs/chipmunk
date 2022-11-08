import { CLIAction } from './action';
import { Service } from '@service/cli';
import { fromStr } from 'platform/env/regex';

import * as Requests from 'platform/ipc/request';

const ARGS = ['-S', '--search'];

export class Action extends CLIAction {
    static help(): {
        keys: string;
        desc: string;
        examples: string[];
    } {
        return {
            keys: ARGS.join(' '),
            desc: `Will set up filters for opened tab(s). A search would be applied to each opened file(s). Search can be used with -O, -C. Values of filters should be separated with space. As soon as values of filters will be converted into regular expressions to define space in the filter's value could be used \\s`,
            examples: [
                `-O /path/file_name -S "error" "warning"`,
                `-O ./file_name_a ./file_name_b -S "error" "warning"`,
                `-C /path/file_name_a /path/file_name_b -S "error" "warning"`,
                `-C ./*.log -S "error" "warning"`,
            ],
        };
    }

    public execute(cli: Service, args: string[]): Promise<string[]> {
        if (cli.getSessions().length === 0) {
            return Promise.resolve(args);
        }
        const checked = this.find(args);
        if (checked.filters.length === 0) {
            return Promise.resolve(args);
        }
        const filters = this.validate(checked.filters);
        if (filters.length === 0) {
            return Promise.resolve(checked.args);
        }
        return new Promise((resolve, _reject) => {
            Requests.IpcRequest.send(
                Requests.Cli.Search.Response,
                new Requests.Cli.Search.Request({ sessions: cli.getSessions(), filters }),
            )
                .then((response) => {
                    if (response.error !== undefined) {
                        cli.log().error(`Fail apply search via CLI: ${response.error}`);
                    }
                })
                .catch((err: Error) => {
                    cli.log().error(`Fail apply CLI.Search: ${err.message}`);
                })
                .finally(() => {
                    resolve(checked.args);
                });
        });
    }

    protected find(args: string[]): { args: string[]; filters: string[] } {
        const filters: string[] = [];
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
            filters.push(...arg.split(' '));
            return false;
        });
        return {
            args,
            filters,
        };
    }

    protected validate(filters: string[]): string[] {
        return filters.filter((filter) => {
            return fromStr(filter) instanceof Error ? false : true;
        });
    }
}
