import { Component, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Attachment } from '@platform/types/content';

@Component({
    selector: 'app-views-attachments-item-video-preview',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class Preview {
    @Input() attachment!: Attachment;
}
export interface Preview extends IlcInterface {}
