import { FileHolder } from './file.holder';
import { bytesToStr } from '@env/str';
import { FileType } from '@platform/types/files';

export class State {
    public files: FileHolder[] = [];

    private _concatable: boolean = false;
    private _openable: boolean = false;
    private _selectedCount: number = 0;
    private _selectedSize: string = '0 b';
    private _destination: string = '';
    private _selectedTypes: FileType[] = [];

    public get openable(): boolean {
        return this._openable;
    }

    public set openable(value: boolean) {
        this._openable = value;
    }

    public get concatable(): boolean {
        return this._concatable;
    }

    public set concatable(value: boolean) {
        this._concatable = value;
    }

    public get selectedCount(): number {
        return this._selectedCount;
    }

    public set selectedCount(count: number) {
        this._selectedCount = count;
    }

    public get selectedSize(): string {
        return this._selectedSize;
    }

    public set selectedSize(size: string) {
        this._selectedSize = size;
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

        this._openable = !this._selectedTypes.includes(FileType.Dlt);
        this._concatable =
            this._selectedTypes.length === 1 && this._selectedTypes.includes(FileType.Text);
    }
}
