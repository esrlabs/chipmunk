import {
    Component,
    ChangeDetectorRef,
    ViewChild,
    ElementRef,
    AfterContentInit,
    AfterViewInit,
    Input,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Initial } from '@env/decorators/initial';
import { Owner } from '@schema/content/row';

export type CloseHandler = () => void;

@Component({
    selector: 'app-dialogs-jumpto',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Initial()
@Ilc()
export class JumpTo extends ChangesDetector implements AfterViewInit, AfterContentInit {
    @ViewChild('rowinput') ref!: ElementRef<HTMLInputElement>;
    @Input() close!: CloseHandler;
    public value: string = '';
    public key: string = 'ctrl';

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.key = this.ilc().services.system.env.platform().darwin() ? 'Cmd' : 'Ctrl';
    }

    public ngAfterViewInit(): void {
        this.ref.nativeElement.focus();
    }

    public focus() {
        this.ref.nativeElement.focus();
    }

    public change(value: string) {
        const line = parseInt(value, 10);
        if (!isFinite(line) || isNaN(line)) {
            return;
        }
        const session = this.ilc().services.system.session.active().session();
        if (session === undefined) {
            return;
        }
        if (session.stream.len() <= line) {
            return;
        }
        session.cursor.select(line, Owner.Bookmark, undefined, undefined);
        this.ref.nativeElement.focus();
    }

    public keydown(event: KeyboardEvent) {
        const session = this.ilc().services.system.session.active().session();
        if (session === undefined) {
            return;
        }
        if (event.key === 'Enter') {
            if (
                event.ctrlKey ||
                (this.ilc().services.system.env.platform().darwin() && event.metaKey)
            ) {
                session.switch().toolbar.details();
            }
            this.close();
        }
    }
}
export interface JumpTo extends IlcInterface {}
