import { IPC } from '../services/service.electron.ipc';

export class FilesList {
    private _files: IPC.IFile[] = [];

    constructor(files: IPC.IFile[]) {
        this._files = files;
    }

    public getFiles(): IPC.IFile[] {
        return this._files;
    }

    public setFiles(files: IPC.IFile[]) {
        this._files = files;
    }
}
