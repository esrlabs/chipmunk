import { Render } from '@schema/render/index';
import { Services } from '@service/ilc';
import { Logger } from '@platform/log';
import { components } from '@env/decorators/initial';
import { File } from '@platform/types/files';
import { Base } from './base';
import { isRenderMatch } from '@schema/render/tools';
import { lockers, Locker, Level } from '@ui/service/lockers';
import { Session } from '@service/session';

export abstract class FileOpener<Options, NamedOptions> extends Base<
    FileOpener<Options, NamedOptions>
> {
    protected readonly services: Services;
    protected readonly logger: Logger;

    constructor(services: Services, logger: Logger) {
        super();
        this.services = services;
        this.logger = logger;
    }

    abstract getRender(): Render<unknown>;
    abstract getSettings():
        | {
              name: string;
              component: string;
          }
        | undefined;

    abstract getNamedOptions(options: Options): NamedOptions;

    public async open(files: File[] | string[], options?: Options): Promise<string> {
        const targets: File[] = await this.services.system.bridge.files().getByPath(
            files.map((file) => {
                return typeof file === 'string' ? file : file.filename;
            }),
        );
        const open = (options?: Options): Promise<void> => {
            if (this.session !== undefined) {
                const matching = isRenderMatch(this.session, this.getRender());
                if (matching instanceof Error) {
                    return Promise.reject(matching);
                }
                if (!matching) {
                    return Promise.reject(
                        new Error(`Combination of renders in the scope of session isn't supported`),
                    );
                }
                return this.session.stream.concat(
                    files.map((_file, i) => {
                        return {
                            filename: targets[i].filename,
                            name: targets[i].name,
                            type: targets[i].type,
                            options:
                                options === undefined ? {} : (this.getNamedOptions(options) as {}),
                        };
                    }),
                );
            } else {
                const progress = lockers.lock(
                    new Locker(true, 'indexing file...')
                        .set()
                        .group(targets.map((t) => t.filename).join('|'))
                        .end(),
                    {
                        closable: false,
                    },
                );
                return this.services.system.session
                    .add()
                    .concat(
                        files.map((_file, i) => {
                            return {
                                filename: targets[i].filename,
                                name: targets[i].name,
                                type: targets[i].type,
                                options:
                                    options === undefined
                                        ? {}
                                        : (this.getNamedOptions(options) as {}),
                            };
                        }),
                        this.getRender(),
                    )
                    .then((session: Session) => {
                        this.assign(session);
                        progress.popup.close();
                        // this.services.system.recent
                        //     .add()
                        //     .file(
                        //         target,
                        //         options === undefined ? {} : (this.getNamedOptions(options) as {}),
                        //     )
                        //     .catch((err: Error) => {
                        //         this.logger.error(
                        //             `Fail to add recent action; error: ${err.message}`,
                        //         );
                        //     });
                        return Promise.resolve(undefined);
                    })
                    .catch((err: Error) => {
                        progress.locker.set().message(err.message).type(Level.error).spinner(false);
                        return Promise.reject(err);
                    });
            }
        };
        return new Promise((resolve, reject) => {
            const settings = this.getSettings();
            if (options !== undefined || settings === undefined) {
                open(options)
                    .then(() => {
                        if (this.session === undefined) {
                            reject(new Error(`Concat files handler: session isn't created.`));
                        } else {
                            resolve(this.session.uuid());
                        }
                    })
                    .catch(reject);
            } else {
                const api = this.services.system.session.add().tab({
                    name: settings.name,
                    content: {
                        factory: components.get(settings.component),
                        inputs: {
                            getTabApi: () => api,
                            files: targets,
                            done: (opt?: Options) => {
                                open(opt)
                                    .then(() => {
                                        if (this.session === undefined) {
                                            reject(
                                                new Error(
                                                    `Concat files handler: session isn't created.`,
                                                ),
                                            );
                                        } else {
                                            resolve(this.session.uuid());
                                        }
                                    })
                                    .catch(reject);
                            },
                        },
                    },
                    active: true,
                });
            }
        });
    }
}
