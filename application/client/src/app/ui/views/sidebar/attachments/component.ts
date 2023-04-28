import { Component, Input, ChangeDetectorRef, AfterContentInit } from '@angular/core';
import { Session } from '@service/session';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Attachment } from '@platform/types/content';
import { IComponentDesc } from '@elements/containers/dynamic/component';
import { Preview as ImagePreview } from './attachment/previews/image/component';
import { Preview as TextPreview } from './attachment/previews/text/component';
import { Preview as UnknownPreview } from './attachment/previews/unknown/component';
import { Preview as VideoPreview } from './attachment/previews/video/component';
import { Preview as AudioPreview } from './attachment/previews/audio/component';

@Component({
    selector: 'app-views-attachments-list',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class Attachments extends ChangesDetector implements AfterContentInit {
    @Input() session!: Session;

    public attachments: Attachment[] = [];
    public selected: Attachment | undefined;
    public preview: IComponentDesc | undefined;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.env().subscriber.register(
            this.session.attachments.subjects.get().updated.subscribe(this.update.bind(this)),
        );
        this.update();
    }

    public select(attachment: Attachment): void {
        if (this.selected !== undefined && this.selected.uuid === attachment.uuid) {
            this.selected = undefined;
            this.preview = undefined;
        } else {
            this.selected = attachment;
            this.preview = this.getPreviewComponent(attachment);
        }
        this.detectChanges();
    }

    protected getPreviewComponent(target: Attachment): IComponentDesc {
        if (target.is().image()) {
            return {
                factory: ImagePreview,
                inputs: {
                    attachment: target,
                },
            };
        } else if (target.is().video()) {
            return {
                factory: VideoPreview,
                inputs: {
                    attachment: target,
                },
            };
        } else if (target.is().audio()) {
            return {
                factory: AudioPreview,
                inputs: {
                    attachment: target,
                },
            };
        } else if (target.is().text()) {
            return {
                factory: TextPreview,
                inputs: {
                    attachment: target,
                },
            };
        } else {
            return {
                factory: UnknownPreview,
                inputs: {
                    attachment: target,
                },
            };
        }
    }

    protected update(): void {
        this.attachments = Array.from(this.session.attachments.attachments.values());
        this.detectChanges();
    }
}
export interface Attachments extends IlcInterface {}
