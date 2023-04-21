import { Component, Input, ChangeDetectorRef, ElementRef, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { File } from '@platform/types/files';
import { Element } from '../element';
import { Mutable } from '@platform/types/unity/mutable';
import { stop } from '@ui/env/dom';

@Component({
    selector: 'app-views-observed-file',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class Item extends ChangesDetector implements AfterContentInit {
    @Input() element!: Element;

    public readonly file: File | undefined;

    constructor(cdRef: ChangeDetectorRef, private _self: ElementRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        if (this.element.file === undefined) {
            this.log().error(`Field "file" in Element is undefined`);
            return;
        }
        (this as Mutable<Item>).file = this.element.file;
    }

    public isActive(): boolean {
        return this.element.source.observer !== undefined;
    }

    public openAsNew(event: MouseEvent): void {
        stop(event);
        this.element.provider.openAsNew(this.element.source).catch((err: Error) => {
            this.log().error(`Fail to restart file: ${err.message}`);
        });
    }

    public stop(event: MouseEvent): void {
        stop(event);
        const observer = this.element.source.observer;
        if (observer === undefined) {
            return;
        }
        observer.abort().catch((err: Error) => {
            this.log().error(`Fail to abort file tailing: ${err.message}`);
        });
    }
}
export interface Item extends IlcInterface {}
