/**
 * @module system
 * @description Module cares abopu loading of application
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

export enum ExitCodes {
    normal = 0,
    update = 131,
    restart = 132,
}

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
                this.shutdown().close();
            });
            process.on('SIGQUIT', () => {
                this.emitters.push('NodeJS::SIGQUIT');
                this.shutdown().close();
            });
            process.on('SIGINT', () => {
                this.emitters.push('NodeJS::SIGINT');
                this.shutdown().close();
            });
            process.on('SIGTERM', () => {
                this.emitters.push('NodeJS::SIGTERM');
                this.shutdown().close();
            });
            app.on('will-quit', (event: Event) => {
                this.emitters.push('Electron::will-quit');
                event.preventDefault();
                this.shutdown().close();
            });
            app.on('before-quit', (event: Event) => {
                this.emitters.push('Electron::before-quit');
                event.preventDefault();
                this.shutdown().close();
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
        update(): Promise<void>;
        restart(): Promise<void>;
        close(): Promise<void>;
    } {
        return {
            update: (): Promise<void> => {
                return this._shutdown(ExitCodes.update);
            },
            restart: (): Promise<void> => {
                return this._shutdown(ExitCodes.restart);
            },
            close: (): Promise<void> => {
                return this._shutdown(ExitCodes.normal);
            },
        };
    }

    private async _shutdown(code: ExitCodes): Promise<void> {
        if (this.lock.isLocked()) {
            return Promise.resolve();
        }
        this.lock.lock();
        this.logger.debug(`Application would be closed.`);
        process.stdin.resume();
        await system.destroy().catch((error: Error) => {
            this.logger.warn(`Fail correctly close app due error: ${error.message}`);
        });
        this.logger.debug(`Application is ready be closed with code: ${code}.`);
        this.logger.debug(`On close events stack: ${this.emitters.join(', ')}.`);
        process.exit(code);
    }
}

declare const global: ChipmunkGlobal;

global.application = new Application();
