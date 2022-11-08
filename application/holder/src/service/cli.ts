import {
    SetupService,
    Interface,
    Implementation,
    register,
    DependOn,
} from 'platform/entity/service';
import { services } from '@register/services';
import { electron } from '@service/electron';
import { paths } from '@service/paths';
import { DEV_EXECUTOR_PATH } from '@loader/cli';
import * as Actions from './cli/index';

import * as Events from 'platform/ipc/event';

@DependOn(paths)
@DependOn(electron)
@SetupService(services['cli'])
export class Service extends Implementation {
    public readonly cwd: string;

    protected args: string[] = [];
    protected sessions: string[] = [];

    constructor() {
        super();
        this.cwd = process.cwd();
    }

    public override ready(): Promise<void> {
        this.log().debug(`Incoming arguments:\n\t${process.argv.join('\n\t')}`);
        this.log().verbose(`TTY: ${process.stdout.isTTY ? 'connected' : 'unavailable'}`);
        this.log().debug(`CWD: ${process.cwd()}`);
        this.log().verbose(`Executor: ${process.execPath}`);
        const executor = process.argv.shift();
        if (executor === undefined) {
            // Unexpected amount of arguments
            return Promise.resolve();
        }
        if (executor.indexOf(DEV_EXECUTOR_PATH) !== -1) {
            const mod = process.argv.findIndex((arg) => {
                return arg.toLowerCase().endsWith('.js');
            });
            if (mod === -1) {
                this.log().warn(
                    `Application in dev-mode (running with electron), but JS module isn't found`,
                );
                return Promise.resolve();
            } else {
                this.log().debug(
                    `Application in dev-mode (running with electron); main module (index: ${mod}): ${process.argv[mod]}`,
                );
            }
            this.args = process.argv.splice(mod + 1, process.argv.length);
        } else {
            this.args = process.argv.splice(0, process.argv.length);
        }
        if (this.args.length === 0) {
            this.log().debug(`No any CLI actions would be applied: no income arguments.`);
        } else {
            this.log().debug(`Accepted arguments:\n\t${this.args.join('\n\t')}`);
        }
        this.register(
            Events.IpcEvent.subscribe(
                Events.State.Client.Event,
                (event: Events.State.Client.Event) => {
                    if (event.state !== Events.State.Client.State.Ready) {
                        return;
                    }
                    this.check().catch((err: Error) => {
                        this.log().error(`Fail to proccess CLI actions: ${err.message}`);
                    });
                },
            ),
        );
        return Promise.resolve();
    }

    public setSessions(sessions: string[]): void {
        this.sessions = sessions;
    }

    public getSessions(): string[] {
        return this.sessions;
    }

    protected async check(): Promise<void> {
        const actions = [new Actions.OpenFile(), new Actions.ConcatFiles(), new Actions.Search()];
        console.log(actions);
        for (const action of actions) {
            this.args = await action.execute(this, this.args);
        }
    }
}
export interface Service extends Interface {}
export const cli = register(new Service());
