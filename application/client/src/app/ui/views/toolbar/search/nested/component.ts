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
import { ISearchFinishEvent } from '@service/session/dependencies/search/state';
import { Notification } from '@ui/service/notifications';
import { IFilter } from '@platform/types/filter';

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
        const filter = this.session.search.state().getNested();
        this.input.set().value(filter ? filter : '');
    }

    public ngAfterViewInit(): void {
        this.input.bind(this.searchInputRef.nativeElement, this.recentPanelRef);
        this.input.actions.accept.subscribe(() => {
            if (this.input.value.trim() !== '') {
                const filter = this.input.asFilter();
                this.recent.update(filter.filter);
                this.session.search.state().setNested(filter);
                this.session.search
                    .searchNextNested()
                    .then((pos: number | undefined) => {
                        console.log(`>>>>>>>>>>>>>>>>>>>>> next: ${pos}`);
                    })
                    .catch((err: Error) => {
                        this.log().error(`Fail apply nested search: ${err.message}`);
                    });
            } else {
                this.drop();
            }
        });
        this.input.actions.drop.subscribe(() => {
            this.drop();
        });
        this.input.actions.edit.subscribe(() => {
            console.log('>>>>>>>>>>>>>>>> Edit');
            // this.input.set().value(this.active.filter);
            // this.drop();
            this.detectChanges();
        });
        this.input.actions.recent.subscribe(() => {
            this.detectChanges();
        });
        this.input.focus();
    }

    public drop() {
        this.session.search.state().dropNested();
    }
}
export interface ViewSearchNested extends IlcInterface {}
