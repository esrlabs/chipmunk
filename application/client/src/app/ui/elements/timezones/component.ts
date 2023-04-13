import {
    Component,
    ChangeDetectorRef,
    Input,
    ViewEncapsulation,
    ViewChild,
    AfterViewInit,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Timezone } from './timezone';
import { State } from './state';
import { Initial } from '@env/decorators/initial';
import { HiddenFilter } from '@elements/filter.hidden/component';

@Component({
    selector: 'app-elements-timezone-selector',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
})
@Initial()
@Ilc()
export class ElementsTimezoneSelector extends ChangesDetector implements AfterViewInit {
    @Input() public selected!: (timezone: Timezone) => void;
    @Input() public close!: () => void;

    @ViewChild('filter') filter!: HiddenFilter;

    public state: State;

    constructor(cdRef: ChangeDetectorRef, private _sanitizer: DomSanitizer) {
        super(cdRef);
        this.state = new State();
    }

    public ngAfterViewInit(): void {
        this.env().subscriber.register(
            this.filter.filter.subjects.get().change.subscribe((value: string) => {
                this.state.update(value);
                this.detectChanges();
            }),
        );
        this.env().subscriber.register(
            this.filter.filter.subjects.get().drop.subscribe(() => {
                this.state.update('');
                this.detectChanges();
            }),
        );
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
