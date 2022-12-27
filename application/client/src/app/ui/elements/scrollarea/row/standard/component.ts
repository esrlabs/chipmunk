import {
    Component,
    Input,
    AfterContentInit,
    HostBinding,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    SkipSelf,
    ViewEncapsulation,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Row } from '@schema/content/row';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';

@Component({
    selector: 'app-scrollarea-row-standard',
    styleUrls: ['./styles.less'],
    template: '',
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
})
@Ilc()
export class Standard extends ChangesDetector implements AfterContentInit {
    @Input() public row!: Row;

    private _sanitizer: DomSanitizer;

    constructor(@SkipSelf() selfCdRef: ChangeDetectorRef, sanitizer: DomSanitizer) {
        super(selfCdRef);
        this._sanitizer = sanitizer;
    }

    @HostBinding('class') classes = 'row';
    @HostBinding('style.background') background = '';
    @HostBinding('style.color') color = '';
    @HostBinding('innerHTML') html: SafeHtml | string = '';

    public ngAfterContentInit() {
        this.update();
        this.env().subscriber.register(
            this.row.change.subscribe(() => {
                this.update();
                this.markChangesForCheck();
            }),
        );
    }

    protected update() {
        this.html = this._sanitizer.bypassSecurityTrustHtml(this.row.html);
        this.background = this.row.background === undefined ? '' : this.row.background;
        this.color = this.row.color === undefined ? '' : this.row.color;
    }
}
export interface Standard extends IlcInterface {}
