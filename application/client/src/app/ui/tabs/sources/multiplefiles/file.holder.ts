import { Matchee } from '@module/matcher';
import { bytesToStr } from '@env/str';
import { FileType, File } from '@platform/types/files';

import * as wasm from '@loader/wasm';

export class FileHolder extends Matchee {
    private _file: File;
    private _selected: boolean = true;

    constructor(matcher: wasm.Matcher, file: File) {
        super(matcher, { name: file.name, path: file.path });
        this._file = file;
    }

    public reverseSelect() {
        this._selected = !this._selected;
    }

    public select() {
        this._selected = true;
    }

    public unselect() {
        this._selected = false;
    }

    public get filename(): string {
        return this._file.filename;
    }

    public get modificationDate(): string {
        return new Date(this._file.stat.mtimeMs).toLocaleString('en-GB');
    }

    public get name(): string {
        return this._file.name;
    }

    public get path(): string {
        return this._file.path;
    }

    public get selected(): boolean {
        return this._selected;
    }

    public get size(): string {
        return bytesToStr(this._file.stat.size);
    }

    public sizeInByte(): number {
        return this._file.stat.size;
    }

    public get type(): FileType {
        return this._file.type;
    }
}
