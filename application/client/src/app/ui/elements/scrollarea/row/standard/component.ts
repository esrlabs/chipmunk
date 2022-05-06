import {
    Component,
    Input,
    AfterContentInit,
    HostBinding,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    OnDestroy,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Row } from '@schema/content/row';
import { Ilc, IlcInterface, Declarations } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Subscriber } from '@platform/env/subscription';

@Component({
    selector: 'app-scrollarea-row-standard',
    styleUrls: ['./styles.less'],
    template: '',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Ilc()
export class Standard extends ChangesDetector implements AfterContentInit, OnDestroy {
    @Input() public row!: Row;

    private _sanitizer: DomSanitizer;
    private _subscriber: Subscriber = new Subscriber();

    constructor(cdRef: ChangeDetectorRef, sanitizer: DomSanitizer) {
        super(cdRef);
        this._sanitizer = sanitizer;
    }

    @HostBinding('class') classes = 'row noreset';
    // @HostBinding('style.background') background = '';
    // @HostBinding('style.color') color = '';
    @HostBinding('innerHTML') html: SafeHtml | string = '';

    public ngOnDestroy(): void {
        this._subscriber.unsubscribe();
    }

    public ngAfterContentInit() {
        this.html = this._sanitizer.bypassSecurityTrustHtml(this.row.content);
        this._subscriber.register(
            this.row.change.subscribe(() => {
                this.html = this._sanitizer.bypassSecurityTrustHtml(this.row.content);
                this.markChangesForCheck();
            }),
        );
    }
}
export interface Standard extends IlcInterface {}
