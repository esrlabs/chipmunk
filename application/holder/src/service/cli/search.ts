import { CLIAction, Type } from './action';
import { Service } from '@service/cli';
import { fromStr } from 'platform/env/regex';

import * as Requests from 'platform/ipc/request';

export class Action extends CLIAction {
    // static help(): {
    //     keys: string;
    //     desc: string;
    //     examples: string[];
    // } {
    //     return {
    //         keys: ARGS.join(' '),
    //         desc: `Will set up filters for opened tab(s). A search would be applied to each opened file(s). Search can be used with -O, -C. Values of filters should be separated with space. As soon as values of filters will be converted into regular expressions to define space in the filter's value could be used \\s`,
    //         examples: [
    //             `cm -O /path/file_name -S "error" "warning"`,
    //             `cm -O ./file_name_a ./file_name_b -S "error" "warning"`,
    //             `cm -C /path/file_name_a /path/file_name_b -S "error" "warning"`,
    //             `cm -C ./*.log -S "error" "warning"`,
    //         ],
    //     };
    // }

    protected filters: string[] = [];
    protected error: Error[] = [];

    public name(): string {
        return 'Search setup';
    }

    public argument(_cwd: string, arg: string): string {
        const filter = fromStr(arg);
        if (!(filter instanceof Error)) {
            this.filters.push(arg);
            return arg;
        }
        this.error.push(
            new Error(`Fail to convert into RegExp value "${arg}": ${filter.message}.`),
        );
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
        if (cli.state().sessions().length === 0) {
            return Promise.resolve();
        }
        return new Promise((resolve, _reject) => {
            Requests.IpcRequest.send(
                Requests.Cli.Search.Response,
                new Requests.Cli.Search.Request({
                    sessions: cli.state().sessions(),
                    filters: this.filters,
                }),
            )
                .then((response) => {
                    if (response.error !== undefined) {
                        cli.log().error(`Fail apply search via CLI: ${response.error}`);
                    }
                })
                .catch((err: Error) => {
                    cli.log().error(`Fail apply CLI.Search: ${err.message}`);
                })
                .finally(resolve);
        });
    }

    public type(): Type {
        return Type.AfterActions;
    }

    public defined(): boolean {
        return this.filters.length > 0;
    }
}
