import {
    Component,
    AfterViewInit,
    AfterContentInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    ViewEncapsulation,
    Input,
    ViewChild,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { Action } from '@service/recent/action';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State, CloseHandler } from './state';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { InputFilter } from '@elements/filter/component';
import { ParserName, Origin } from '@platform/types/observe';

@Component({
    selector: 'app-recent-actions-mini',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
})
@Initial()
@Ilc()
export class RecentActionsMini extends ChangesDetector implements AfterViewInit, AfterContentInit {
    @ViewChild('filter') public filterInputRef!: InputFilter;
    @Input() close: CloseHandler | undefined;
    @Input() public parser?: ParserName;
    @Input() public origin?: Origin;

    public state!: State;

    constructor(cdRef: ChangeDetectorRef, private _sanitizer: DomSanitizer) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.state = new State(this, this.origin, this.parser);
        this.env().subscriber.register(
            this.state.update.subscribe(() => {
                this.detectChanges();
            }),
        );
        this.close !== undefined && this.state.bind(this.close);
    }

    public ngAfterViewInit(): void {
        this.detectChanges();
        this.filterInputRef !== undefined &&
            this.state.filter.bind(this.filterInputRef.getInputElementRef()).focus();
    }

    public onDefaultAction(action: Action) {
        action.apply(this.state.remove.bind(this.state));
        this.close !== undefined && this.close();
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
                    this.state.removeAll();
                },
            },
        ];
        this.ilc().emitter.ui.contextmenu.open({
            items,
            x: event.x,
            y: event.y,
            after: () => {
                this.close !== undefined && this.close();
            },
        });
    }

    public safeHtml(html: string): SafeHtml {
        return this._sanitizer.bypassSecurityTrustHtml(html);
    }
}
export interface RecentActionsMini extends IlcInterface {}
