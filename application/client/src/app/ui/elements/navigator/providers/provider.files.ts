import { IFileDescription } from './entity';
import { Provider as Base, INoContentActions, IStatistics } from './provider';
import { favorites } from '@service/favorites';
import { bridge } from '@service/bridge';
import { EntityType, getFileName } from '@platform/types/files';
import { notifications, Notification } from '@ui/service/notifications';
import { getFileTypeByFilename } from '@platform/types/observe/types/file';

import * as Factory from '@platform/types/observe/factory';
import { IMenuItem } from '@ui/service/contextmenu';

const DEFAULT_DEEP = 5;
const DEFAULT_LEN = 20000;

export class Provider extends Base<IFileDescription> {
    protected count: number = 0;
    protected roots: string[] = [];

    protected async scan(roots: string[], folders: string[]): Promise<IFileDescription[]> {
        if (this.isAborted()) {
            return Promise.resolve([]);
        }
        // User can add into favorites nested folder - we should preven duplicates in such cases
        for (const path of roots) {
            if (folders.indexOf(path) !== -1) {
                return Promise.resolve([]);
            } else {
                folders.push(path);
            }
        }
        let allScanning = '';
        for (const path of roots) {
            if (allScanning.length > 0) {
                allScanning = `${allScanning} - ${getFileName(path)}`;
            } else {
                allScanning = `${getFileName(path)}`;
            }
        }
        const data = await bridge.files().ls({
            paths: roots,
            depth: DEFAULT_DEEP,
            max: DEFAULT_LEN,
            include: { files: true, folders: false },
        });
        const items: IFileDescription[] = [];
        data.entities.forEach((entity) => {
            if (this.isAborted()) {
                return;
            }
            if (entity.type === EntityType.File && entity.details !== undefined) {
                items.push({
                    filename: entity.fullname,
                    name: entity.name,
                    parent: entity.details.path,
                });
            }
        });
        let files: IFileDescription[] = [];
        files = files.concat(items);
        if (data.max) {
            notifications.notify(
                new Notification({
                    message: `Too many files in: ${allScanning}`,
                    actions: [],
                }),
            );
        }
        this.roots = roots;
        this.count = files.length;
        return Promise.resolve(files);
    }

    protected open(item: IFileDescription): {
        dlt(): void;
        pcapng(): void;
        pcap(): void;
        text(): void;
        auto(): void;
    } {
        return {
            dlt: (): void => {
                this.ilc
                    .ilc()
                    .services.system.session.initialize()
                    .configure(
                        new Factory.File()
                            .asDlt()
                            .type(Factory.FileType.Binary)
                            .file(item.filename)
                            .get(),
                    )
                    .catch((err: Error) => {
                        this.ilc.log().error(`Fail to open text file; error: ${err.message}`);
                    });
            },
            pcapng: (): void => {
                this.ilc
                    .ilc()
                    .services.system.session.initialize()
                    .configure(
                        new Factory.File()
                            .asDlt()
                            .type(Factory.FileType.PcapNG)
                            .file(item.filename)
                            .get(),
                    )
                    .catch((err: Error) => {
                        this.ilc.log().error(`Fail to open text file; error: ${err.message}`);
                    });
            },
            pcap: (): void => {
                this.ilc
                    .ilc()
                    .services.system.session.initialize()
                    .configure(
                        new Factory.File()
                            .asDlt()
                            .type(Factory.FileType.PcapLegacy)
                            .file(item.filename)
                            .get(),
                    )
                    .catch((err: Error) => {
                        this.ilc.log().error(`Fail to open text file; error: ${err.message}`);
                    });
            },
            text: (): void => {
                this.ilc
                    .ilc()
                    .services.system.session.initialize()
                    .observe(
                        new Factory.File()
                            .asText()
                            .type(Factory.FileType.Text)
                            .file(item.filename)
                            .get(),
                    )
                    .catch((err: Error) => {
                        this.ilc.log().error(`Fail to open text file; error: ${err.message}`);
                    });
            },
            auto: (): void => {
                const filetype = getFileTypeByFilename(item.filename);
                if (filetype === Factory.FileType.Text) {
                    this.ilc
                        .ilc()
                        .services.system.session.initialize()
                        .observe(
                            new Factory.File().asText().type(filetype).file(item.filename).get(),
                        )
                        .catch((err: Error) => {
                            this.ilc.log().error(`Fail to open text file; error: ${err.message}`);
                        });
                } else {
                    this.ilc
                        .ilc()
                        .services.system.session.initialize()
                        .configure(
                            new Factory.File()
                                .type(filetype)
                                .file(item.filename)
                                .guessParser()
                                .get(),
                        )
                        .catch((err: Error) => {
                            this.ilc.log().error(`Fail to open text file; error: ${err.message}`);
                        });
                }
            },
        };
    }

    protected asFileDescription(entity: unknown): IFileDescription | undefined {
        if (typeof entity !== 'object' || entity === undefined || entity === null) {
            return;
        }
        let valid = true;
        ['parent', 'filename', 'name'].forEach((prop) => {
            if (!valid) {
                return;
            }
            if (typeof (entity as { [key: string]: string })[prop] !== 'string') {
                valid = false;
            }
        });
        if (!valid) {
            return;
        }
        return entity as IFileDescription;
    }

    protected addRoot(): void {
        favorites
            .places()
            .selectAndAdd()
            .then(() => {
                // this.state
                //     .load()
                //     .catch((err: Error) => {
                //         this.ilc.log().error(`Fail to reload state favorites: ${err.message}`);
                //     })
                //     .finally(() => {
                //         this.ilc.detectChanges();
                //     });
            })
            .catch((err: Error) => {
                this.ilc.log().error(`Fail to add favorites: ${err.message}`);
            });
    }

    public async load(): Promise<IFileDescription[]> {
        const data = await favorites.places().get();
        return this.scan(
            data.filter((f) => f.exists).map((f) => f.path),
            [],
        );
    }

    public action(entity: unknown): void {
        const desc = this.asFileDescription(entity);
        if (desc === undefined) {
            return;
        }
        this.open(desc).auto();
    }

    public stat(): IStatistics {
        return {
            title: `Found ${this.count} file(s) in:`,
            total: this.count,
            info: this.roots,
        };
    }

    public getContextMenu(entity: unknown, close?: () => void): IMenuItem[] {
        const desc = this.asFileDescription(entity);
        if (desc === undefined) {
            return [];
        }
        return [
            {
                caption: 'Open as text',
                handler: () => {
                    this.open(desc).text();
                    close !== undefined && close();
                },
            },
            {
                caption: 'Open as DLT',
                handler: () => {
                    this.open(desc).dlt();
                    close !== undefined && close();
                },
            },
            {
                caption: 'Open as PcapNG',
                handler: () => {
                    this.open(desc).pcapng();
                    close !== undefined && close();
                },
            },
            {
                caption: 'Open as Pcap',
                handler: () => {
                    this.open(desc).pcap();
                    close !== undefined && close();
                },
            },
        ];
    }

    public title(): string {
        return `File(s)`;
    }

    public getNoContentActions(): INoContentActions {
        return {
            title: `You didn't add any locations into favorites yet. You always can add/remove favorite places on the home screen.`,
            buttons: [
                {
                    caption: `Add Folder(s) to Favorites`,
                    handler: this.addRoot.bind(this),
                },
            ],
        };
    }
}
