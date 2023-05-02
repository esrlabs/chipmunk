import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Attachment } from '@platform/types/content';
import { Subject } from '@platform/env/subscription';

@Component({
    selector: 'app-views-attachments-item-video-preview',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Ilc()
export class Preview {
    @Input() attachment!: Attachment;
    @Input() embedded!: boolean;
    @Input() updated!: Subject<void>;
}
export interface Preview extends IlcInterface {}
