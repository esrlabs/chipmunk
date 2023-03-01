import {
    Component,
    ChangeDetectorRef,
    HostListener,
    Input,
    ViewEncapsulation,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { AttachmentInfo } from './attachment.info';
import { State } from './state';
import { Initial } from '@env/decorators/initial';
import { Attachment } from '@platform/types/parsers/dlt';

@Component({
    selector: 'app-attachments-list',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
})
@Initial()
@Ilc()
export class AttachmentsListSelector extends ChangesDetector {
    @Input() public list!: [string, Attachment][];
    @Input() public selected!: (attachment: AttachmentInfo) => void;
    @Input() public close!: () => void;
    @HostListener('window:keydown', ['$event'])
    handleKeyDown(event: KeyboardEvent) {
        if (this.state.filter.keyboard(event)) {
            this.state.update();
            this.detectChanges();
        }
    }

    public state!: State;

    constructor(cdRef: ChangeDetectorRef, private _sanitizer: DomSanitizer) {
        super(cdRef);
    }
    
    public ngAfterContentInit(): void {
        this.state = new State(this.ilc(), this.list);
    }

    public ngOnSelect(attachment: AttachmentInfo) {
        this.selected(attachment);
        this.close();
    }

    public safeHtml(html: string): SafeHtml {
        return this._sanitizer.bypassSecurityTrustHtml(html);
    }

    public attachments(): AttachmentInfo[] {
        return this.state.list.filter((item) => !item.hidden());
    }
}
export interface AttachmentsListSelector extends IlcInterface {}
