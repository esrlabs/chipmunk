import { Render } from '@schema/render/index';
import { Services } from '@service/ilc';
import { Instance as Logger } from '@platform/env/logger';
import { Locker, Level, lockers } from '@ui/service/lockers';
import { components } from '@env/decorators/initial';
import { Session } from '../session/session';
import { SourceDefinition } from '@platform/types/transport';

export abstract class StreamOpener<Options> {
    protected readonly services: Services;
    protected readonly logger: Logger;

    constructor(services: Services, logger: Logger) {
        this.services = services;
        this.logger = logger;
    }

    abstract getRender(): Render<unknown>;
    abstract getSettingsComponentName(): string;
    abstract binding(session: Session, source: SourceDefinition, options?: Options): Promise<void>;
    abstract after(source: SourceDefinition, options?: Options): Promise<void>;
    abstract getStreamTabName(): string;
    abstract getStreamSettingsTabName(): string;

    public stream(
        source?: SourceDefinition,
        options?: Options,
        openPresetSettings?: boolean,
    ): Promise<void> {
        const getProgress = (uuid: string) => {
            return lockers.lock(new Locker(true, 'creating stream...').set().group(uuid).end(), {});
        };
        let session: Session | undefined;
        const open = (
            bind: boolean,
            used: { source: SourceDefinition; options: Options },
        ): Promise<string> => {
            return new Promise((resolve, reject) => {
                this.services.system.session
                    .add(bind)
                    .empty(this.getRender())
                    .then((created) => {
                        session = created;
                        this.binding(session, used.source, used.options)
                            .then(() => {
                                resolve(created.uuid());
                            })
                            .catch((err: Error) => {
                                this.logger.error(`Fail to connect: ${err.message}`);
                                reject(err);
                            });
                    })
                    .catch((err: Error) => {
                        this.logger.error(`Fail to create session: ${err.message}`);
                        reject(err);
                    });
            });
        };
        return new Promise((resolve, reject) => {
            if (source !== undefined && options !== undefined && openPresetSettings !== true) {
                open(true, { source, options })
                    .then(() => {
                        resolve();
                    })
                    .catch(reject);
            } else {
                const api = this.services.system.session.add().tab({
                    name: this.getStreamSettingsTabName(),
                    content: {
                        factory: components.get(this.getSettingsComponentName()),
                        inputs: {
                            getTabApi: () => api,
                            options: { source, options },
                            done: (
                                redefined: { source: SourceDefinition; options: Options },
                                cb: (err: Error | undefined) => void,
                            ) => {
                                const progress = getProgress(api.getGUID());
                                open(false, redefined)
                                    .then((uuid: string) => {
                                        progress.popup.close();
                                        this.services.system.session.bind(
                                            uuid,
                                            this.getStreamTabName(),
                                        );
                                        this.after(redefined.source, redefined.options)
                                            .catch((err: Error) => {
                                                this.logger.error(
                                                    `Fail to call "after" action; error: ${err.message}`,
                                                );
                                            })
                                            .finally(() => {
                                                cb(undefined);
                                                resolve();
                                            });
                                    })
                                    .catch((err: Error) => {
                                        progress.locker
                                            .set()
                                            .message(err.message)
                                            .type(Level.error)
                                            .spinner(false);
                                        session !== undefined &&
                                            this.services.system.session.kill(session.uuid());
                                        // We do not reject, but let component know - we are not able to observe
                                        cb(err);
                                    });
                            },
                        },
                    },
                    active: true,
                });
            }
        });
    }
}
