import {
    Component,
    AfterContentInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    ViewEncapsulation,
    Input,
    Output,
    EventEmitter,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { Action, AfterHandler } from '@service/recent/action';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State } from './state';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ParserName, Origin } from '@platform/types/observe';

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
    @Input() public parser?: ParserName;
    @Input() public origin?: Origin;
    @Input() public after?: AfterHandler;
    @Output() public applied: EventEmitter<void> = new EventEmitter();

    public state!: State;

    constructor(cdRef: ChangeDetectorRef, private _sanitizer: DomSanitizer) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.markChangesForCheck();
        this.state = new State(this, this.origin, this.parser);
        this.env().subscriber.register(
            this.state.update.subscribe(() => {
                this.detectChanges();
            }),
        );
        this.env().subscriber.register(this.state.entryUpdate());
    }

    public onDefaultAction(action: Action) {
        action.after(this.after).apply(this.state.remove.bind(this.state));
    }

    public onAllActions(event: MouseEvent, action: Action) {
        action.after(this.after);
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
                    this.state.removeAll();
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
