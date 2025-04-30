import { Component, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { bytesToStr, timestampToUTC } from '@env/str';
import { State } from './state';
import { Element } from '../../element';

@Component({
    selector: 'app-settings-scheme-nested-dictionary',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Initial()
@Ilc()
export class NestedDictionary extends ChangesDetector implements AfterContentInit {
    @Input() element!: Element;

    protected state: State | undefined;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.state = this.element.nested_dictionary
            ? new State(this.element.nested_dictionary.items)
            : undefined;
    }

    public ngOnEntitySelect() {
        if (!this.state) {
            return;
        }
        this.state.buildSummary().selected();
        this.detectChanges();
    }

    public ngContextMenu(event: MouseEvent) {
        const state = this.state;
        if (!state) {
            return;
        }
        const after = () => {
            state.buildSummary().selected();
            this.detectChanges();
        };
        this.ilc().emitter.ui.contextmenu.open({
            items: [
                {
                    caption: 'Select all',
                    handler: () => {
                        state.structure.forEach((section) => {
                            section.entities.forEach((e) => e.select());
                        });
                        after();
                    },
                },
                {
                    caption: 'Unselect all',
                    handler: () => {
                        state.structure.forEach((section) => {
                            section.entities.forEach((e) => e.unselect());
                        });
                        after();
                    },
                },
                {
                    caption: 'Reverse selection',
                    handler: () => {
                        state.structure.forEach((section) => {
                            section.entities.forEach((e) => e.toggle());
                        });
                        after();
                    },
                },
                {},
                {
                    caption: 'Select with fotal',
                    handler: () => {
                        state.structure.forEach((section) => {
                            // section.entities.forEach((e) => {
                            //     e.log_fatal > 0 && e.select();
                            // });
                        });
                        after();
                    },
                },
                {
                    caption: 'Select with errors',
                    handler: () => {
                        state.structure.forEach((section) => {
                            // section.entities.forEach((e) => {
                            //     e.log_error > 0 && e.select();
                            // });
                        });
                        after();
                    },
                },
                {
                    caption: 'Select with warnings',
                    handler: () => {
                        state.structure.forEach((section) => {
                            // section.entities.forEach((e) => {
                            //     e.log_warning > 0 && e.select();
                            // });
                        });
                        after();
                    },
                },
                {},
                {
                    caption: 'Unselect without fotal',
                    handler: () => {
                        state.structure.forEach((section) => {
                            // section.entities.forEach((e) => {
                            //     e.log_fatal === 0 && e.unselect();
                            // });
                        });
                        after();
                    },
                },
                {
                    caption: 'Unselect without errors',
                    handler: () => {
                        state.structure.forEach((section) => {
                            // section.entities.forEach((e) => {
                            //     e.log_error === 0 && e.unselect();
                            // });
                        });
                        after();
                    },
                },
                {
                    caption: 'Unselect without warnings',
                    handler: () => {
                        state.structure.forEach((section) => {
                            // section.entities.forEach((e) => {
                            //     e.log_warning === 0 && e.unselect();
                            // });
                        });
                        after();
                    },
                },
            ],
            x: event.x,
            y: event.y,
        });
    }
}
export interface NestedDictionary extends IlcInterface {}
