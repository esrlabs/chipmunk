import { FileHolder } from './file.holder';
import { bytesToStr } from '@env/str';
import { File, FileType } from '@platform/types/files';
import { Subject } from '@platform/env/subscription';
import { EContextActionType, IContextAction } from './structure/component';
import { Holder } from '@module/matcher';
import { TabControls } from '@service/session';
import { Instance } from '@platform/env/logger';
import { InternalAPI } from '@service/ilc';
import { Filter } from '@ui/env/entities/filter';
import { Level, Locker } from '@ui/service/lockers';
import { getUniqueColorTo } from '@ui/styles/colors';

export class State extends Holder {
    public readonly filesUpdate: Subject<FileHolder[]> = new Subject();

    private _ilc!: InternalAPI;
    private _tab!: TabControls;
    private _files: FileHolder[] = [];
    private _filter!: Filter;
    private _log!: Instance;
    private _usedColors: string[] = [];
    private _selectedCount: number = 0;
    private _selectedTotalSize: number = 0;
    private _selectedTypes: FileType[] = [];
    private _selectedFiles: FileHolder[] = [];

    constructor() {
        super();
    }

    public init(ilc: InternalAPI, tab: TabControls, files: File[], log: Instance) {
        this._ilc = ilc;
        this._tab = tab;
        this._files = files.map((file: File) => {
            const color = getUniqueColorTo(this._usedColors);
            this._usedColors.push(color);
            return new FileHolder(this.matcher, file, color);
        });
        this._filter = new Filter(this._ilc);
        this._log = log;
        this._updateSummary();
    }

    public get selectedFiles(): FileHolder[] {
        return this._selectedFiles;
    }

    public get filter(): Filter {
        return this._filter;
    }

    public get files(): FileHolder[] {
        return this._files;
    }

    public get selectedCount(): number {
        return this._selectedCount;
    }

    public get selectedSize(): string {
        return bytesToStr(this._selectedTotalSize);
    }

    public buttonState(): {
        openable: boolean;
        concatable: boolean;
    } {
        return {
            openable:
                this._selectedFiles.length > 0 &&
                ![FileType.Dlt, FileType.Pcap, FileType.SomeIP].some((type) =>
                    this._selectedTypes.includes(type),
                ),
            concatable:
                this._selectedFiles.length > 0 &&
                ((this._selectedTypes.length === 1 && this._selectedTypes[0] !== FileType.SomeIP) ||
                    (this._selectedTypes.length === 2 &&
                        this._selectedTypes.includes(FileType.Any) &&
                        this._selectedTypes.includes(FileType.Text))),
        };
    }

    public buttonAction(): {
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
                    this._selectedTypes.length === 1 ? this._selectedTypes[0] : FileType.Text;
                const files: string[] = this._selectedFiles.map(
                    (file: FileHolder) => file.filename,
                );
                (() => {
                    switch (fileType) {
                        case FileType.Text:
                        case FileType.Any:
                            return this._ilc.services.system.opener.concat(files).text();
                        case FileType.Dlt:
                            return this._ilc.services.system.opener.concat(files).dlt();
                        case FileType.Pcap:
                            return this._ilc.services.system.opener.concat(files).pcap();
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
                        this._ilc.services.ui.lockers.lock(
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
                (files === undefined ? this._selectedFiles : files).forEach((file: FileHolder) => {
                    switch (file.type) {
                        case FileType.Any:
                        case FileType.Text:
                            this._ilc.services.system.opener
                                .file(file.filename)
                                .text()
                                .catch((err: Error) => {
                                    this._log.error(
                                        `Fail to open text file; error: ${err.message}`,
                                    );
                                });
                            break;
                        case FileType.Dlt:
                            this._ilc.services.system.opener
                                .file(file.filename)
                                .dlt()
                                .catch((err: Error) => {
                                    this._log.error(`Fail to open dlt file; error: ${err.message}`);
                                });
                            break;
                        case FileType.Pcap:
                            this._ilc.services.system.opener
                                .file(file.filename)
                                .pcap()
                                .catch((err: Error) => {
                                    this._log.error(
                                        `Fail to open pcap file; error: ${err.message}`,
                                    );
                                });
                            break;
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
            this._updateSummary();
        });
    }

    public onContext(event: IContextAction) {
        const files: FileHolder[] | undefined = event.files;
        switch (event.type) {
            case EContextActionType.open:
                this.buttonAction().openEach(files);
                break;
            case EContextActionType.update:
                if (files !== undefined) {
                    this._files =
                        files.length === 0
                            ? []
                            : this._files.filter((f: FileHolder) => !files.includes(f));
                }
                this._updateSummary();
                break;
        }
    }

    public onKeydown(event: KeyboardEvent) {
        if (this._filter.keyboard(event)) {
            this.matcher.search(this._filter.value());
            this.filesUpdate.emit(
                this._files
                    .sort((a: FileHolder, b: FileHolder) => b.getScore() - a.getScore())
                    .filter((file: FileHolder) => file.getScore() > 0),
            );
        }
    }

    public overviewColorWidth(size: number) {
        return (size / this._selectedTotalSize) * 100;
    }

    private _updateSummary() {
        this._selectedCount = 0;
        this._selectedTotalSize = 0;
        this._selectedTypes = [];
        this._selectedFiles = [];
        this._files.forEach((file: FileHolder) => {
            if (file.selected) {
                this._selectedCount++;
                this._selectedTotalSize += file.sizeInByte();
                !this._selectedTypes.includes(file.type) && this._selectedTypes.push(file.type);
                this._selectedFiles.push(file);
            }
        });
    }
}
