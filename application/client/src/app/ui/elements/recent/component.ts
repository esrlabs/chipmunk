import {
    Component,
    AfterContentInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    ViewEncapsulation,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { Action } from '@service/recent/action';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State } from './state';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
    selector: 'app-recent-actions',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
})
@Initial()
@Ilc()
export class RecentActions extends ChangesDetector implements AfterContentInit {
    public readonly state: State;

    constructor(cdRef: ChangeDetectorRef, private _sanitizer: DomSanitizer) {
        super(cdRef);
        this.state = new State(this);
        this.env().subscriber.register(
            this.state.update.subscribe(() => {
                this.markChangesForCheck();
            }),
        );
    }

    public ngAfterContentInit(): void {
        this.markChangesForCheck();
    }

    public onDefaultAction(action: Action) {
        action.apply(this.state.remove.bind(this.state));
    }

    public onAllActions(event: MouseEvent, action: Action) {
        const items = [
            ...action.getActions(this.state.remove.bind(this.state)),
            {},
            {
                caption: 'Remove recent',
                handler: () => {
                    this.state.remove([action.uuid]);
                },
            },
            {
                caption: 'Clear All',
                handler: () => {
                    console.log(`Not implemented`);
                },
            },
        ];
        this.ilc().emitter.ui.contextmenu.open({
            items,
            x: event.x,
            y: event.y,
        });
    }

    public safeHtml(html: string): SafeHtml {
        return this._sanitizer.bypassSecurityTrustHtml(html);
    }
}
export interface RecentActions extends IlcInterface {}
