import {
    Component,
    OnDestroy,
    ViewChild,
    Input,
    AfterContentInit,
    AfterViewInit,
    ChangeDetectorRef,
    ElementRef,
    ViewEncapsulation,
} from '@angular/core';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { Session } from '@service/session';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { SearchInput } from '../input/input';
import { List } from '@env/storages/recent/list';
import { ChangesDetector } from '@ui/env/extentions/changes';

@Component({
    selector: 'app-views-search-nested',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
})
@Ilc()
export class ViewSearchNested
    extends ChangesDetector
    implements AfterViewInit, AfterContentInit, OnDestroy
{
    @Input() public session!: Session;

    @ViewChild('searchinput') searchInputRef!: ElementRef<HTMLInputElement>;
    @ViewChild(MatAutocompleteTrigger) recentPanelRef!: MatAutocompleteTrigger;

    public readonly input = new SearchInput();
    public readonly recent: List;
    public readonly progress: boolean = false;

    constructor(chRef: ChangeDetectorRef) {
        super(chRef);
        this.recent = new List(this.input.control, 'RecentNestedFilters', 'recent_nested_filters');
    }

    public ngOnDestroy(): void {
        this.session.search.state().nonActive = this.input.getNonActive();
        this.input.destroy();
    }

    public ngAfterContentInit(): void {
        const filter = this.session.search.state().nested().get();
        this.input.set().value(filter ? filter.filter : '');
    }

    public ngAfterViewInit(): void {
        this.input.bind(this.searchInputRef.nativeElement, this.recentPanelRef);
        this.input.actions.accept.subscribe(() => {
            if (this.input.value.trim() !== '') {
                const filter = this.input.asFilter();
                this.recent.update(filter.filter);
                this.session.search
                    .state()
                    .nested()
                    .set(filter)
                    .then((pos: number | undefined) => {
                        if (pos === undefined) {
                            return;
                        }
                    });
            } else {
                this.drop();
            }
        });
        this.input.actions.drop.subscribe(() => {
            this.drop();
        });
        this.input.actions.edit.subscribe(() => {
            this.detectChanges();
        });
        this.input.actions.recent.subscribe(() => {
            this.detectChanges();
        });
        this.input.focus();
    }

    public next() {
        this.session.search
            .state()
            .nested()
            .next()
            .catch((err: Error) => {
                this.log().error(`Fail go to next nested match: ${err.message}`);
            });
    }

    public prev() {
        this.session.search
            .state()
            .nested()
            .prev()
            .catch((err: Error) => {
                this.log().error(`Fail go to prev nested match: ${err.message}`);
            });
    }

    public drop() {
        this.session.search.state().nested().drop();
    }

    public close() {
        this.session.search.state().nested().toggle();
    }
}
export interface ViewSearchNested extends IlcInterface {}
