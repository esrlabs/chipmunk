import { FileHolder } from './file.holder';
import { bytesToStr } from '@env/str';
import { File } from '@platform/types/files';
import { FileType } from '@platform/types/observe/types/file';
import { Subject } from '@platform/env/subscription';
import { EEventType, IEvent } from './structure/component';
import { Holder } from '@module/matcher';
import { TabControls } from '@service/session';
import { IlcInterface } from '@service/ilc';
import { Level, Locker } from '@ui/service/lockers';
import { getUniqueColorTo } from '@ui/styles/colors';
import { Sort } from '@angular/material/sort';
import { ChangesDetector } from '@ui/env/extentions/changes';

import * as Factory from '@platform/types/observe/factory';

export interface IMultifile {
    usedColors: string[];
    files: FileHolder[];
}

export class State extends Holder {
    private readonly _filesUpdate: Subject<FileHolder[]> = new Subject();
    private _ref!: IlcInterface & ChangesDetector;
    private _tab!: TabControls;
    private _files: FileHolder[] = [];
    private _usedColors: string[] = [];
    private _selected: {
        count: number;
        files: FileHolder[];
        totalSize: number;
        typeCount: { [key: string]: number };
        types: FileType[];
    } = {
        count: 0,
        files: [],
        totalSize: 0,
        typeCount: {},
        types: [],
    };
    private _sortConfig: Sort = { active: '', direction: '' };

    public path: string | undefined;

    constructor() {
        super();
    }

    public init(ref: IlcInterface & ChangesDetector, tab: TabControls, files: File[]): void {
        this._ref = ref;
        this._tab = tab;
        if (files.length > 0) {
            this.path = files[0].path;
        }
        files.forEach((file: File) => {
            const color = getUniqueColorTo(this._usedColors);
            this._usedColors.push(color);
            this._files.push(new FileHolder(this.matcher, file, color));
            if (this.path !== undefined && file.path !== this.path) {
                this.path = undefined;
            }
        });
        this.update();
    }

    public restore(ref: IlcInterface & ChangesDetector) {
        this._ref = ref;
    }

    public set sortConfig(config: Sort) {
        this._sortConfig = config;
    }

    public get sortConfig(): Sort {
        return this._sortConfig;
    }

    public get filesUpdate(): Subject<FileHolder[]> {
        return this._filesUpdate;
    }

    public get selectedFiles(): FileHolder[] {
        return this._selected.files;
    }

    public get files(): FileHolder[] {
        return this._files;
    }

    public get selectedCount(): number {
        return this._selected.count;
    }

    public get selectedSize(): string {
        return bytesToStr(this._selected.totalSize);
    }

    public get selectedTypes(): FileType[] {
        return this._selected.types;
    }

    public getTypeCount(type: FileType): number {
        const count: number | undefined = this._selected.typeCount[type];
        return count === undefined ? 0 : count;
    }

    public selectOnly(type: FileType) {
        this._files.forEach((file: FileHolder) => {
            if (file.type === type) {
                file.select();
            } else {
                file.unselect();
            }
        });
        this.update();
    }

    public isConcatable(): boolean {
        // TODO: Needs some rework! This method should consider parser
        // TODO AAZ: Ask how to integrate plugins here.
        return (
            this._selected.types.length === 1 ||
            (this._selected.types.length === 2 &&
                this._selected.types.includes(FileType.Text) &&
                this._selected.types.includes(FileType.Binary))
        );
    }

    public action(): {
        cancel: () => void;
        concat: () => void;
        openEach: (files?: FileHolder[]) => void;
        addFiles: () => void;
    } {
        return {
            cancel: () => {
                this._tab.close();
            },
            concat: () => {
                const fileType: FileType =
                    this._selected.types.length === 1 ? this._selected.types[0] : FileType.Text;
                const files: string[] = this._selected.files.map(
                    (file: FileHolder) => file.filename,
                );
                (() => {
                    switch (fileType) {
                        case FileType.Text:
                            return this._ref
                                .ilc()
                                .services.system.session.initialize()
                                .observe(
                                    new Factory.Concat()
                                        .asText()
                                        .type(Factory.FileType.Text)
                                        .files(files)
                                        .get(),
                                );
                        case FileType.PcapNG:
                            return this._ref
                                .ilc()
                                .services.system.session.initialize()
                                .configure(
                                    new Factory.Concat()
                                        .asDlt()
                                        .type(Factory.FileType.PcapNG)
                                        .files(files)
                                        .get(),
                                );
                        case FileType.PcapLegacy:
                            return this._ref
                                .ilc()
                                .services.system.session.initialize()
                                .configure(
                                    new Factory.Concat()
                                        .asDlt()
                                        .type(Factory.FileType.PcapLegacy)
                                        .files(files)
                                        .get(),
                                );
                        case FileType.Binary:
                            return this._ref
                                .ilc()
                                .services.system.session.initialize()
                                .configure(
                                    new Factory.Concat()
                                        .asDlt()
                                        .type(Factory.FileType.Binary)
                                        .files(files)
                                        .get(),
                                );
                        case FileType.Plugins:
                            return this._ref
                                .ilc()
                                .services.system.session.initialize()
                                .configure(
                                    new Factory.Concat()
                                        .asPlugin()
                                        .type(Factory.FileType.Plugins)
                                        .files(files)
                                        .get(),
                                );
                        default:
                            return Promise.reject(
                                new Error(`Unsupported type ${this.files[0].type}`),
                            );
                    }
                })()
                    .then(() => {
                        this._tab.close();
                    })
                    .catch((err: Error) => {
                        this._ref
                            .ilc()
                            .services.ui.lockers.lock(
                                new Locker(true, err.message)
                                    .set()
                                    .message(err.message)
                                    .type(Level.error)
                                    .spinner(false)
                                    .end(),
                                {
                                    closable: true,
                                },
                            );
                    });
            },
            openEach: (files?: FileHolder[]) => {
                (files === undefined ? this._selected.files : files).forEach((file: FileHolder) => {
                    switch (file.type) {
                        case FileType.Text:
                            this._ref
                                .ilc()
                                .services.system.session.initialize()
                                .observe(
                                    new Factory.File()
                                        .asText()
                                        .type(Factory.FileType.Text)
                                        .file(file.filename)
                                        .get(),
                                )
                                .catch((err: Error) => {
                                    this._ref
                                        .ilc()
                                        .logger.error(
                                            `Fail to open text file; error: ${err.message}`,
                                        );
                                });
                            break;
                        case FileType.Binary:
                            this._ref
                                .ilc()
                                .services.system.session.initialize()
                                .configure(
                                    new Factory.File()
                                        .asDlt()
                                        .type(Factory.FileType.Binary)
                                        .file(file.filename)
                                        .get(),
                                )
                                .catch((err: Error) => {
                                    this._ref
                                        .ilc()
                                        .logger.error(
                                            `Fail to open dlt file; error: ${err.message}`,
                                        );
                                });
                            break;
                        case FileType.PcapNG:
                            this._ref
                                .ilc()
                                .services.system.session.initialize()
                                .configure(
                                    new Factory.File()
                                        .asDlt()
                                        .type(Factory.FileType.PcapNG)
                                        .file(file.filename)
                                        .get(),
                                )
                                .catch((err: Error) => {
                                    this._ref
                                        .ilc()
                                        .logger.error(
                                            `Fail to open dlt file; error: ${err.message}`,
                                        );
                                });
                            break;
                        case FileType.PcapLegacy:
                            this._ref
                                .ilc()
                                .services.system.session.initialize()
                                .configure(
                                    new Factory.File()
                                        .asDlt()
                                        .type(Factory.FileType.PcapLegacy)
                                        .file(file.filename)
                                        .get(),
                                )
                                .catch((err: Error) => {
                                    this._ref
                                        .ilc()
                                        .logger.error(
                                            `Fail to open dlt file; error: ${err.message}`,
                                        );
                                });
                            break;
                        case FileType.Plugins:
                            this._ref
                                .ilc()
                                .services.system.session.initialize()
                                .configure(
                                    new Factory.File()
                                        .asPlugin()
                                        .type(Factory.FileType.Plugins)
                                        .file(file.filename)
                                        .get(),
                                )
                                .catch((err: Error) => {
                                    this._ref
                                        .ilc()
                                        .logger.error(
                                            `Fail to open file with plugins; error: ${err.message}`,
                                        );
                                });
                            break;
                        default:
                            throw new Error(`Not covered type ${this.files[0].type}`);
                    }
                });
                this._tab.close();
            },
            addFiles: () => {
                /* TODO */
            },
        };
    }

    public onDropped(files: File[]) {
        files.forEach((result: File) => {
            if (this._files.find((file: FileHolder) => file.filename === result.filename)) {
                return;
            }
            const color = getUniqueColorTo(this._usedColors);
            this._usedColors.push(color);
            this._files.push(new FileHolder(this.matcher, result, color));
            this.filesUpdate.emit(this._files);
            this.update();
        });
    }

    public event(event: IEvent) {
        switch (event.type) {
            case EEventType.open:
                this.action().openEach(event.files);
                break;
            case EEventType.select:
                this.update();
                break;
            case EEventType.sort:
                this._files = event.files;
                this.update();
                break;
            case EEventType.update:
                this._files =
                    event.files.length === 0
                        ? []
                        : this._files.filter((f: FileHolder) => !event.files.includes(f));
                this.update();
                break;
        }
        this._ref !== undefined && this._ref.detectChanges();
    }

    public filter(value: string) {
        this.matcher.search(value);
        this.filesUpdate.emit(
            this._files
                .sort((a: FileHolder, b: FileHolder) => b.getScore() - a.getScore())
                .filter((file: FileHolder) => file.getScore() > 0),
        );
    }

    public overviewColorWidth(size: number) {
        return (size / this._selected.totalSize) * 100;
    }

    protected update() {
        this._selected = {
            count: 0,
            files: [],
            totalSize: 0,
            typeCount: {},
            types: [],
        };
        this._files.forEach((file: FileHolder) => {
            if (file.selected) {
                this._selected.count++;
                this._selected.totalSize += file.sizeInByte();
                !this._selected.types.includes(file.type) && this._selected.types.push(file.type);
                if (this._selected.typeCount[file.type] === undefined) {
                    this._selected.typeCount[file.type] = 1;
                } else {
                    this._selected.typeCount[file.type] += 1;
                }
                this._selected.files.push(file);
            }
        });
    }
}
