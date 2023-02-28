import { Component, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { AttachmentAction } from './attachment.action';

@Component({
    selector: 'app-tabs-source-attachments',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class Attachments extends ChangesDetector implements AfterContentInit {
    @Input() attachment!: AttachmentAction;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.env().subscriber.register(
            this.attachment.subjects.get().scan.subscribe(() => {
                this.ngOnScan();
            }),
        );
        this.env().subscriber.register(
            this.attachment.subjects.get().extract.subscribe(() => {
                this.ngOnExtract();
            }),
        );
    }

    public ngOnScan(): void {
        this.attachment.subjects.get().scanned.emit();
    }

    public ngOnExtract() {
        this.attachment.subjects.get().extracted.emit();
    }
}
export interface Attachments extends IlcInterface {}
