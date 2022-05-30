import {
    Component,
    AfterContentInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    HostListener,
    ViewEncapsulation,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { Action } from '@service/recent/action';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State } from './state';
import { Subscriber } from '@platform/env/subscription';
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
    public readonly state: State = new State();

    @HostListener('window:keydown', ['$event'])
    handleKeyDown(event: KeyboardEvent) {
        if (this.state.filter.keyboard(event)) {
            this.state.filtering();
            this.detectChanges();
        }
    }

    constructor(cdRef: ChangeDetectorRef, private _sanitizer: DomSanitizer) {
        super(cdRef);
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
        action.apply();
    }

    public onAllActions(event: MouseEvent, action: Action) {
        const items = [
            ...action.getActions(),
            {},
            { caption: 'Remove recent', handler: () => {} },
            { caption: 'Clear All', handler: () => {} },
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
