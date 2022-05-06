import {
    Component,
    ChangeDetectorRef,
    HostListener,
    Inject,
    ViewEncapsulation,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Ilc, IlcInterface, Declarations } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Subscriber } from '@platform/env/subscription';
import { State } from '../state';
import { Timezone } from './timezone';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';

@Component({
    selector: 'app-tabs-source-dltfile-timezone',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
})
@Ilc()
export class TabSourceDltFileTimezone extends ChangesDetector {
    @HostListener('window:keydown', ['$event'])
    handleKeyDown(event: KeyboardEvent) {
        if (this.data.state.filters.timezone.keyboard(event)) {
            this.data.state.struct().timezones();
            this.detectChanges();
        }
    }

    constructor(
        @Inject(MAT_BOTTOM_SHEET_DATA) public data: { state: State },
        cdRef: ChangeDetectorRef,
        private _bottomSheetRef: MatBottomSheetRef<TabSourceDltFileTimezone>,
        private _sanitizer: DomSanitizer,
    ) {
        super(cdRef);
    }

    public ngOnSelect(timezine: Timezone) {
        this.data.state.timezone = timezine;
        this._bottomSheetRef.dismiss();
    }

    public safeHtml(html: string): SafeHtml {
        return this._sanitizer.bypassSecurityTrustHtml(html);
    }

    public timezones(): Timezone[] {
        return this.data.state.timezones.filter((t) => !t.hidden);
    }
}
export interface TabSourceDltFileTimezone extends IlcInterface {}
