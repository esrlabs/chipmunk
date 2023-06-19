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
import { envvars } from '@loader/envvars';
import { isDevelopingExecuting } from '@loader/cli';
import { exec } from 'sudo-prompt';
import { getActions } from '@loader/cli';

import * as Actions from './cli/index';
import * as Events from 'platform/ipc/event';
import * as fs from 'fs';
import * as $ from 'platform/types/observe';

const UNIX_LOCAL_BIN = '/usr/local/bin';
const UNIX_SYMLINK_PATH = `${UNIX_LOCAL_BIN}/cm`;

@DependOn(paths)
@DependOn(electron)
@SetupService(services['cli'])
export class Service extends Implementation {
    public readonly cwd: string = process.cwd();

    protected args: string[] = [];

    private _available: boolean | undefined;
    private readonly _state: {
        sessions: string[];
        parser: $.Parser.Protocol;
    } = {
        sessions: [],
        parser: $.Parser.Protocol.Text,
    };

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
        if (isDevelopingExecuting(executor)) {
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

    public state(): {
        sessions(sessions?: string[]): string[];
        parser(parser?: $.Parser.Protocol): $.Parser.Protocol;
    } {
        return {
            sessions: (sessions?: string[]): string[] => {
                if (sessions !== undefined) {
                    this._state.sessions = sessions;
                }
                return this._state.sessions;
            },
            parser: (parser?: $.Parser.Protocol): $.Parser.Protocol => {
                if (parser !== undefined) {
                    this._state.parser = parser;
                }
                return this._state.parser;
            },
        };
    }

    public support(): {
        install(): Promise<void>;
        uninstall(): Promise<void>;
        toggle(): Promise<void>;
        exists(): Promise<boolean>;
        available(): Promise<boolean>;
    } {
        return {
            install: async (): Promise<void> => {
                if (await this.support().exists()) {
                    return Promise.resolve();
                }
                if (paths.isElectron()) {
                    return Promise.reject(
                        new Error(`No way to setup CLI because chipmunk is running via electron`),
                    );
                }
                return new Promise((resolve, reject) => {
                    const options = {
                        name: 'Chipmunk Command Line Tool',
                    };
                    const command: string = ((): string => {
                        switch (process.platform) {
                            case 'win32':
                                this.log().debug(
                                    `Would call: ${`setx PATH "%PATH%;${paths.getExec()}"`}`,
                                );
                                return `setx PATH "%PATH%;${paths.getExec()}"`;
                            default:
                                return `ln -s ${paths.getExec()} ${UNIX_SYMLINK_PATH}`;
                        }
                    })();
                    this.log().debug(`Would call: ${command} to setup CLI support`);
                    exec(
                        command,
                        options,
                        (
                            error: NodeJS.ErrnoException | null | undefined,
                            _stdout: unknown,
                            _stderr: unknown,
                        ) => {
                            if (error) {
                                return reject(
                                    new Error(
                                        this.log().warn(
                                            `Fail install command tool line due error: ${error.message}`,
                                        ),
                                    ),
                                );
                            }
                            resolve();
                        },
                    );
                });
            },
            uninstall: async (): Promise<void> => {
                if (await !this.support().exists()) {
                    return Promise.resolve();
                }
                if (paths.isElectron()) {
                    return Promise.reject(
                        new Error(
                            `No way to remove CLI support because chipmunk is running via electron`,
                        ),
                    );
                }
                return new Promise((resolve, reject) => {
                    const options = {
                        name: 'Chipmunk Command Line Tool',
                    };
                    const command: string | Error = ((): string | Error => {
                        switch (process.platform) {
                            case 'win32':
                                // Unfortunately on windows "setx" doesn't have option to delete variable.
                                // but overwriting doesn't give expecting result.
                                // One possible option to use reg delete HKCU\Environment /F /V PATH
                                // and after setup it again with setx, but it's dangerous
                                // Well temporary we wouldn't have uninstall for windows.
                                return new Error(
                                    `Isn't available on windows. Please remove path to chipmunk manualy from $PATH`,
                                );
                            default:
                                return `rm ${UNIX_SYMLINK_PATH}`;
                        }
                    })();
                    if (command instanceof Error) {
                        return reject(command);
                    }
                    exec(
                        command,
                        options,
                        (
                            error: NodeJS.ErrnoException | null | undefined,
                            _stdout: unknown,
                            _stderr: unknown,
                        ) => {
                            if (error) {
                                return reject(
                                    new Error(
                                        this.log().warn(
                                            `Fail uninstall command tool line due error: ${error.message}`,
                                        ),
                                    ),
                                );
                            }
                            resolve();
                        },
                    );
                });
            },
            toggle: async (): Promise<void> => {
                if (await this.support().exists()) {
                    return this.support().uninstall();
                } else {
                    return this.support().install();
                }
            },
            exists: async (): Promise<boolean> => {
                const vars = envvars.getOS();
                switch (process.platform) {
                    case 'win32':
                        return (
                            Object.keys(vars).find((key) => {
                                return typeof vars[key] === 'string'
                                    ? vars[key]?.indexOf(paths.getExec()) !== -1
                                    : false;
                            }) !== undefined
                        );
                    default:
                        return await fs.promises
                            .lstat(UNIX_SYMLINK_PATH)
                            .then((_) => true)
                            .catch((_err) => false);
                }
            },
            available: (): Promise<boolean> => {
                if (this._available !== undefined) {
                    return Promise.resolve(this._available);
                }
                if (process.platform === 'win32') {
                    this._available = true;
                    return Promise.resolve(this._available);
                }
                this._available = fs.existsSync(UNIX_LOCAL_BIN);
                return Promise.resolve(this._available);
            },
        };
    }

    protected async check(): Promise<void> {
        const actions = getActions();
        const runner = async (actions: Actions.CLIAction[]): Promise<void> => {
            for (const action of actions) {
                await action.execute(this);
            }
        };
        await runner(actions.filter((a) => a.type() === Actions.Type.StateModifier));
        await runner(actions.filter((a) => a.type() === Actions.Type.Action));
        await runner(actions.filter((a) => a.type() === Actions.Type.AfterActions));
        Events.IpcEvent.emit(new Events.Cli.Done.Event());
    }
}
export interface Service extends Interface {}
export const cli = register(new Service());
