import { Component, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Element, TimezoneSelectorElement } from '../../element';
import { components } from '@env/decorators/initial';
import { Timezone } from '@ui/elements/timezones/timezone';

interface Tz {
    name: string;
    utc: string;
    offset: number;
}

@Component({
    selector: 'app-settings-scheme-tz-selector',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Initial()
@Ilc()
export class TimezoneSelector extends ChangesDetector implements AfterContentInit {
    @Input() element!: Element;
    @Input() inner!: TimezoneSelectorElement;

    public tz: Tz | undefined;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {}

    public ngOnSelect() {
        const subscription = this.ilc()
            .services.ui.popup.open({
                component: {
                    factory: components.get('app-elements-timezone-selector'),
                    inputs: {
                        selected: (timezone: Timezone): void => {
                            if (timezone.name.toLowerCase().startsWith('utc')) {
                                this.tz = undefined;
                            } else {
                                this.tz = {
                                    name: timezone.name,
                                    offset: timezone.offset,
                                    utc: timezone.utc,
                                };
                            }
                            this.element.setValue(this.tz ? this.tz.offset : -1);
                            this.element.change();
                            this.detectChanges();
                        },
                    },
                },
                closeOnKey: 'Escape',
                size: { width: 350 },
                uuid: 'app-elements-timezone-selector',
            })
            .subjects.get()
            .closed.subscribe(() => {
                subscription.unsubscribe();
            });
    }

    public ngOnDrop() {
        this.tz = undefined;
        this.detectChanges();
    }
}
export interface TimezoneSelector extends IlcInterface {}
