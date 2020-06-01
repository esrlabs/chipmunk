import { IPCMessages } from '../services/service.electron.ipc';

export class FilesList {

    private _files: IPCMessages.IFile[] = [];

    constructor(files: IPCMessages.IFile[]) {
        this._files = files;
    }

    public getFiles(): IPCMessages.IFile[] {
        return this._files;
    }

    public setFiles(files: IPCMessages.IFile[]) {
        this._files = files;
    }

}
