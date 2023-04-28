import { Component, Input, AfterContentInit, ChangeDetectorRef } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Attachment } from '@platform/types/content';
import { URLFileReader } from '@env/urlfilereader';
import { ChangesDetector } from '@ui/env/extentions/changes';

const MAX_LINES_COUNT = 1000;

@Component({
    selector: 'app-views-attachments-item-text-preview',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class Preview extends ChangesDetector implements AfterContentInit {
    @Input() attachment!: Attachment;

    public lines: string[] = [];

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        new URLFileReader(`attachment://text`)
            .read()
            .then((response) => {
                if (typeof response !== 'string') {
                    this.log().error(`Expecting to get a text for ${this.attachment.name}.`);
                    return;
                }
                this.lines = response.split(/[\n\r]/gi);
                if (this.lines.length > MAX_LINES_COUNT) {
                    const cutted = this.lines.length - MAX_LINES_COUNT;
                    this.lines.splice(MAX_LINES_COUNT, cutted);
                    this.lines.push(`... (more ${cutted} lines) ...`);
                }
                this.detectChanges();
            })
            .catch((err: Error) => {
                this.log().error(`Fail to get a text for ${this.attachment.name}: ${err.message}.`);
            });
    }
}
export interface Preview extends IlcInterface {}
