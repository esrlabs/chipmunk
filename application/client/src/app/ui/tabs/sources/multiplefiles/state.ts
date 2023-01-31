import { FileHolder } from './file.holder';
import { bytesToStr } from '@env/str';
import { FileType } from '@platform/types/files';
import { CancelablePromise, TEventHandler } from '@platform/env/promise';
import { Subject } from '@platform/env/subscription';
import { Instance } from '@platform/env/logger';
import { FormControl } from '@angular/forms';

export type TFilesSearchResults = { [key: string]: number };

export class State {
    public files: FileHolder[] = [];
    public input: {
        control: FormControl;
        searching: boolean;
    } = {
        control: new FormControl(),
        searching: false,
    };
    public searchUpdate: Subject<TFilesSearchResults> = new Subject();

    private _log!: Instance;
    private _concatable: boolean = false;
    private _openable: boolean = false;
    private _selectedCount: number = 0;
    private _selectedSize: string = '0 b';
    private _destination: string = '';
    private _selectedTypes: FileType[] = [];
    private _aborting: boolean = false;
    private _searching:
        | CancelablePromise<TFilesSearchResults, void, string, TEventHandler>
        | undefined;

    public destroy() {
        this.searchUpdate.destroy();
    }

    public set log(log: Instance) {
        this._log = log;
    }

    public get openable(): boolean {
        return this._openable;
    }

    public get concatable(): boolean {
        return this._concatable;
    }

    public get selectedCount(): number {
        return this._selectedCount;
    }

    public get selectedSize(): string {
        return this._selectedSize;
    }

    public get destination(): string {
        return this._destination;
    }

    public countAndCheck() {
        this._selectedTypes = [];
        let size = 0;
        this._selectedCount = 0;
        this.files.forEach((file: FileHolder) => {
            if (file.selected) {
                this._selectedCount++;
                size += file.sizeInByte();
                if (!this._selectedTypes.includes(file.type)) {
                    this._selectedTypes.push(file.type);
                }
            }
        });
        this._selectedSize = bytesToStr(size);
        this._openable = ![FileType.Dlt, FileType.Pcap, FileType.SomeIP].some((type) =>
            this._selectedTypes.includes(type),
        );
        this._concatable =
            (this._selectedTypes.length === 1 && !this._selectedTypes.includes(FileType.SomeIP)) ||
            (this._selectedTypes.length === 2 &&
                this._selectedTypes.includes(FileType.Any) &&
                this._selectedTypes.includes(FileType.Text));
    }

    public onKeyup(event: KeyboardEvent) {
        switch (event.key) {
            case 'Alt':
            case 'Shift':
            case 'Control':
            case 'Meta':
                return;
        }
        if (event.key === 'Escape' || this.input.control.value.trim() === '') {
            if (this._searching) {
                this._aborting && this._searching.stopCancelation();
                this._searching
                    .abort()
                    .catch((error: Error) => {
                        this._log &&
                            this._log.error(
                                `Failed to abort search operation due to error: ${error.message}`,
                            );
                    })
                    .finally(() => {
                        this._searching = undefined;
                    });
            }
            this.input.control.setValue('');
            this.searchUpdate.emit({});
        } else if (this.input.control.value.trim() !== '') {
            if (!this._searching) {
                this._search();
            } else {
                if (!this._aborting) {
                    this._aborting = true;
                    this._searching
                        .abort()
                        .catch((error: Error) => {
                            this._log &&
                                this._log.error(
                                    `Failed to abort search operation due to error: ${error.message}`,
                                );
                        })
                        .finally(() => {
                            this._aborting = false;
                            this._search();
                        });
                }
            }
        }
    }

    private _search() {
        this.input.searching = true;
        this._searching = this._searchInTextFiles(
            this.files.map((file: FileHolder) => file.name),
            this.input.control.value,
        )
            .then((result: TFilesSearchResults) => {
                this.searchUpdate.emit(result);
            })
            .catch((error: Error) => {
                this._log &&
                    this._log.error(
                        `Failed to run search operation due to error: ${error.message}`,
                    );
            })
            .finally(() => {
                this.input.searching = false;
                this._searching = undefined;
            });
    }

    // Temporary method until it's really implemented
    private _searchInTextFiles(
        files: string[],
        term: string,
    ): CancelablePromise<TFilesSearchResults> {
        this._log && this._log.info(`Searching for: ${term}`);
        return new CancelablePromise((resolve, _reject) => {
            setTimeout(() => {
                const results: TFilesSearchResults = {};
                files.forEach((file: string) => {
                    results[file] = Math.round(Math.random() * 100);
                });
                resolve(results);
            }, Math.random() * 1000);
        });
    }
}
