import { Component, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';
import { IPCMessages } from '../../../services/service.electron.ipc';
import { FilesList } from '../../../controller/controller.file.storage';

interface ICheckbox {
    checked: boolean;
    disabled: boolean;
}

@Component({
    selector: 'app-views-dialogs-multiplefilescation-map',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class DialogsMultipleFilesActionComponent implements AfterContentInit {

    @Input() files: IPCMessages.IFile[] = [];
    @Input() fileList: FilesList;

    public _ng_check: {[path: string]: ICheckbox} = {};

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    ngAfterContentInit() {
        this.files.forEach((file: IPCMessages.IFile) => {
            this._ng_check[file.path] = { checked: true, disabled: false };
            if (file.hasProblem) {
                this._removeFile(file);
                this._ng_check[file.path].checked = false;
                this._ng_check[file.path].disabled = true;
            } else if (file.isHidden || !file.hasParser) {
                this._removeFile(file);
                this._ng_check[file.path].checked = false;
            }
        });
    }

    private _removeFile(file: IPCMessages.IFile) {
        const cFileList = this.fileList.getFiles();
        cFileList.splice(cFileList.indexOf(file), 1);
    }

    public _ng_onChange() {
        this.fileList.setFiles(this.files.filter((file: IPCMessages.IFile) => this._ng_check[file.path].checked === true ));
    }

}
