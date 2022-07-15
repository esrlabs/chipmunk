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
import { Timezone } from './timezone';
import { State } from './state';
import { Initial } from '@env/decorators/initial';

@Component({
    selector: 'app-elements-timezone-selector',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
})
@Initial()
@Ilc()
export class ElementsTimezoneSelector extends ChangesDetector {
    @Input() public selected!: (timezone: Timezone) => void;
    @Input() public close!: () => void;
    @HostListener('window:keydown', ['$event'])
    handleKeyDown(event: KeyboardEvent) {
        if (this.state.filter.keyboard(event)) {
            this.state.update();
            this.detectChanges();
        }
    }

    public state: State;

    constructor(cdRef: ChangeDetectorRef, private _sanitizer: DomSanitizer) {
        super(cdRef);
        this.state = new State(this.ilc());
    }

    public ngOnSelect(timezine: Timezone) {
        this.selected(timezine);
        this.close();
    }

    public safeHtml(html: string): SafeHtml {
        return this._sanitizer.bypassSecurityTrustHtml(html);
    }

    public timezones(): Timezone[] {
        return this.state.timezones.filter((t) => !t.hidden());
    }
}
export interface ElementsTimezoneSelector extends IlcInterface {}
