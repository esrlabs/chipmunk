import {
    Component,
    Input,
    AfterContentInit,
    ChangeDetectorRef,
    ChangeDetectionStrategy,
    HostBinding,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Attachment } from '@platform/types/content';
import { bytesToStr } from '@env/str';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Locker } from '@ui/service/lockers';
import { Notification } from '@ui/service/notifications';
import { Subject } from '@platform/env/subscription';

@Component({
    selector: 'app-views-attachments-preview',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Initial()
@Ilc()
export class Preview extends ChangesDetector implements AfterContentInit {
    @Input() attachment!: Attachment;
    @Input() embedded!: boolean;
    @Input() close!: () => void;

    @HostBinding('class.popup') get popup() {
        return !this.embedded;
    }

    set popup(value: boolean) {
        //
    }

    public ext!: string;
    public size!: string;
    public type!: 'audio' | 'video' | 'text' | 'image' | 'unknown';
    public updated: Subject<void> = new Subject<void>();

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.update();
    }

    public assign(attachment: Attachment): void {
        this.attachment = attachment;
        this.update().detectChanges();
        this.updated.emit();
    }

    public async saveAs(): Promise<void> {
        const bridge = this.ilc().services.system.bridge;
        const dest = await bridge.files().select.save();
        if (dest === undefined) {
            return;
        }
        const message = this.ilc().services.ui.lockers.lock(new Locker(true, `Saving...`), {
            closable: false,
        });
        bridge
            .files()
            .cp(this.attachment.filepath, dest)
            .catch((err: Error) => {
                this.ilc().services.ui.notifications.notify(
                    new Notification({
                        message: err.message,
                        actions: [],
                    }),
                );
            })
            .finally(() => {
                message.popup.close();
            });
    }

    protected update(): Preview {
        this.ext = this.attachment.extAsString();
        this.size = bytesToStr(this.attachment.size);
        if (this.attachment.is().image()) {
            this.type = 'image';
        } else if (this.attachment.is().video()) {
            this.type = 'video';
        } else if (this.attachment.is().audio()) {
            this.type = 'audio';
        } else if (this.attachment.is().text()) {
            this.type = 'text';
        } else {
            this.type = 'unknown';
        }
        return this;
    }
}
export interface Preview extends IlcInterface {}
