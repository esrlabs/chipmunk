/**
 * @module system
 * @description Module cares about loading of application
 */
import './services';
import './controllers';
import { system } from 'platform/modules/system';
import { init as modulesInitialization } from '@module/index';
import { version } from '@module/version';
import { scope } from 'platform/env/scope';
import { Instance as Logger } from 'platform/env/logger';
import { app, Event } from 'electron';
import { LockToken } from 'platform/env/lock.token';
import { IApplication, ChipmunkGlobal } from '@register/global';
import { unbind } from '@env/logs';
import { tools } from 'rustcore';

import * as cases from './exitcases';

export type ExitCase = cases.Restart | cases.Update | undefined;

class Application implements IApplication {
    protected logger: Logger = scope.getLogger('app');
    protected lock: LockToken = LockToken.simple(false);
    protected emitters: string[] = [];

    constructor() {
        system
            .init({
                before: modulesInitialization,
            })
            .then(() => {
                this.logger.debug(`Starting chipmunk@${version.getVersion()}...`);
            })
            .catch((err: Error) => {
                this.logger.error(`Fail to run. Error: ${err.message}`);
            });
        app.whenReady().then(() => {
            process.on('exit', () => {
                this.emitters.push('NodeJS::exit');
                this.shutdown().close().catch((err: Error) => {
                    this.logger.error(`Fail to shutdown on "process:exit": ${err.message}`);
                });
            });
            process.on('SIGQUIT', () => {
                this.emitters.push('NodeJS::SIGQUIT');
                this.shutdown().close().catch((err: Error) => {
                    this.logger.error(`Fail to shutdown on "process:SIGQUIT": ${err.message}`);
                });
            });
            process.on('SIGINT', () => {
                this.emitters.push('NodeJS::SIGINT');
                this.shutdown().close().catch((err: Error) => {
                    this.logger.error(`Fail to shutdown on "process:SIGINT": ${err.message}`);
                });
            });
            process.on('SIGTERM', () => {
                this.emitters.push('NodeJS::SIGTERM');
                this.shutdown().close().catch((err: Error) => {
                    this.logger.error(`Fail to shutdown on "process:SIGTERM": ${err.message}`);
                });
            });
            app.on('will-quit', (event: Event) => {
                this.emitters.push('Electron::will-quit');
                event.preventDefault();
                this.shutdown().close().catch((err: Error) => {
                    this.logger.error(`Fail to shutdown on "app:will-quit": ${err.message}`);
                });
            });
            app.on('before-quit', (event: Event) => {
                this.emitters.push('Electron::before-quit');
                event.preventDefault();
                this.shutdown().close().catch((err: Error) => {
                    this.logger.error(`Fail to shutdown on "app:before-quit": ${err.message}`);
                });
            });
            process.on('uncaughtException', (error: Error) => {
                this.logger.error(`[BAD] UncaughtException: ${error.message}`);
            });
            process.on('unhandledRejection', (reason: Error) => {
                if (reason instanceof Error) {
                    this.logger.error(`[BAD] UnhandledRejection: ${reason.message}`);
                } else {
                    this.logger.error(
                        `[BAD] UnhandledRejection happened. No reason as error was provided.`,
                    );
                }
            });
        });
    }

    public shutdown(): {
        update(upd: cases.Update): Promise<void>;
        restart(cm: cases.Restart): Promise<void>;
        close(): Promise<void>;
    } {
        return {
            update: (upd: cases.Update): Promise<void> => {
                return this._shutdown(upd);
            },
            restart: (cm: cases.Restart): Promise<void> => {
                return this._shutdown(cm);
            },
            close: (): Promise<void> => {
                return this._shutdown(undefined);
            },
        };
    }

    private async _shutdown(exitcase: ExitCase): Promise<void> {
        if (this.lock.isLocked()) {
            this.logger.info(`shutdown signal would be ignored: applcation is shutdowning already`);
            return Promise.resolve();
        }
        this.lock.lock();
        this.logger.debug(`Application would be closed.`);
        process.stdin.resume();
        await system.destroy().catch((error: Error) => {
            this.logger.warn(`Fail correctly close app due error: ${error.message}`);
        });
        this.logger.debug(`On close events stack: ${this.emitters.join(', ')}.`);
        if (exitcase instanceof cases.Update) {
            tools
                .execute(exitcase.updater, [
                    exitcase.app,
                    exitcase.disto,
                    process.pid.toString(),
                    process.ppid.toString(),
                ])
                .catch((err: Error) => {
                    console.log(err.message);
                });
            this.logger.debug(`Application will be closed with UPDATE case.\n \
- updater: ${exitcase.updater}\n\
- disto: ${exitcase.disto}\n\
- PID: ${process.pid}\n\
- PPID: ${process.ppid}`);
            // spawn(
            //     `sleep 3 && ${exitcase.updater}`,
            //     [exitcase.app, exitcase.disto, process.pid.toString(), process.ppid.toString()],
            //     {
            //         shell: true,
            //         detached: true,
            //         stdio: 'ignore',
            //     },
            // );
        } else if (exitcase instanceof cases.Restart) {
            this.logger.debug(`Application will be closed with RESTART case.`);
        } else {
            this.logger.debug(`Application will be closed with REGULAR case.`);
        }
        await unbind();
        process.exit(0);
    }
}

declare const global: ChipmunkGlobal;

global.application = new Application();
