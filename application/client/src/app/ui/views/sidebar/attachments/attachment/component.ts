import { Component, Input, AfterContentInit, ChangeDetectionStrategy } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Attachment } from '@platform/types/content';
import { bytesToStr } from '@env/str';

@Component({
    selector: 'app-views-attachments-item',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Ilc()
export class Item implements AfterContentInit {
    @Input() attachment!: Attachment;

    public ext!: string;
    public size!: string;

    public ngAfterContentInit(): void {
        this.ext = this.attachment.extAsString();
        this.size = bytesToStr(this.attachment.size);
    }
}
export interface Item extends IlcInterface {}
