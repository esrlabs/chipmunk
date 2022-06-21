import {
    Component,
    ChangeDetectorRef,
    HostListener,
    Inject,
    ViewEncapsulation,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Timezone } from './timezone';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { State } from './state';

@Component({
    selector: 'app-elements-timezone-selector',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
})
@Ilc()
export class ElementsTimezoneSelector extends ChangesDetector {
    @HostListener('window:keydown', ['$event'])
    handleKeyDown(event: KeyboardEvent) {
        if (this.state.filter.keyboard(event)) {
            this.state.update();
            this.detectChanges();
        }
    }

    public state: State;

    constructor(
        @Inject(MAT_BOTTOM_SHEET_DATA) public data: { selected: (timezone: Timezone) => void },
        cdRef: ChangeDetectorRef,
        private _bottomSheetRef: MatBottomSheetRef<ElementsTimezoneSelector>,
        private _sanitizer: DomSanitizer,
    ) {
        super(cdRef);
        this.state = new State(this.ilc());
    }

    public ngOnSelect(timezine: Timezone) {
        this.data.selected(timezine);
        this._bottomSheetRef.dismiss();
    }

    public safeHtml(html: string): SafeHtml {
        return this._sanitizer.bypassSecurityTrustHtml(html);
    }

    public timezones(): Timezone[] {
        return this.state.timezones.filter((t) => !t.hidden);
    }
}
export interface ElementsTimezoneSelector extends IlcInterface {}
