import { Component, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Element, FilesFolderSelectorElement } from '../../element';
import { bridge } from '@service/bridge';
import { File } from '@platform/types/files';

interface Path {
    name: string;
    path: string;
}

@Component({
    selector: 'app-settings-scheme-files-selector',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Initial()
@Ilc()
export class FilesSelector extends ChangesDetector implements AfterContentInit {
    @Input() element!: Element;
    @Input() inner!: FilesFolderSelectorElement;

    public paths: Path[] = [];

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {}

    public ngAddTarget() {
        function dialog(exts: string): Promise<File[]> {
            if (exts.trim() === '') {
                return bridge.files().select.any();
            } else {
                return bridge.files().select.custom(exts);
            }
        }
        dialog(this.inner.exts.join(','))
            .then((paths: File[]) => {
                paths = paths.filter((added) => {
                    return this.paths.find((exist) => exist.path === added.filename) === undefined;
                });
                this.paths = this.paths.concat(
                    paths.map((file) => {
                        return { path: file.filename, name: file.name };
                    }),
                );
            })
            .catch((err: Error) => {
                this.log().error(`Fail to open xml (fibex) file(s): ${err.message}`);
            })
            .finally(() => {
                this.detectChanges();
            });
    }

    public ngOnRemovePath(path: string) {
        this.paths = this.paths.filter((item) => item.path !== path);
        this.detectChanges();
    }
}
export interface FilesSelector extends IlcInterface {}
