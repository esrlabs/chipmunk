import {
    Component,
    OnDestroy,
    ViewChild,
    Input,
    AfterContentInit,
    AfterViewInit,
    ChangeDetectorRef,
    ElementRef,
} from '@angular/core';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { Session } from '@service/session';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { SearchInput } from './input';
import { RecentList } from './recent';
import { Progress } from './progress';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { ISearchResults } from '@platform/types/filter';
import { ActiveSearch } from './active';

@Component({
    selector: 'app-views-search-input',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class ViewSearchInput
    extends ChangesDetector
    implements AfterViewInit, AfterContentInit, OnDestroy
{
    @Input() public session!: Session;

    @ViewChild('searchinput') searchInputRef!: ElementRef<HTMLInputElement>;
    @ViewChild(MatAutocompleteTrigger) recentPanelRef!: MatAutocompleteTrigger;

    public readonly input = new SearchInput();
    public readonly recent: RecentList;
    public active: ActiveSearch | undefined;
    public progress!: Progress;

    constructor(chRef: ChangeDetectorRef) {
        super(chRef);
        this.recent = new RecentList(this.input.control);
    }

    public ngOnDestroy(): void {
        this.input.destroy();
        this.progress.destroy();
    }

    public ngAfterContentInit(): void {
        this.progress = new Progress(this.session);
        this.env().subscriber.register(
            this.progress.updated.subscribe(() => {
                this.detectChanges();
            }),
        );
        this.env().subscriber.register(
            this.session.search
                .state()
                .subjects.get()
                .start.subscribe(() => {
                    this.progress.start();
                }),
        );
        this.env().subscriber.register(
            this.session.search
                .state()
                .subjects.get()
                .finish.subscribe((results: ISearchResults | undefined) => {
                    if (results !== undefined) {
                        this.progress.setFound(results.found);
                    }
                    this.progress.stop();
                }),
        );
    }

    public ngAfterViewInit(): void {
        this.input.bind(this.searchInputRef.nativeElement, this.recentPanelRef);
        this.input.actions.accept.subscribe(() => {
            const filter = this.input.asFilter();
            this.recent.update(filter.filter);
            this.session.search
                .state()
                .setActive(filter)
                .then(() => {
                    this.active = new ActiveSearch(filter);
                    this.input.drop();
                })
                .finally(() => {
                    this.markChangesForCheck();
                });
        });
        this.input.actions.drop.subscribe(() => {
            this.drop();
        });
        this.input.actions.edit.subscribe(() => {
            if (this.active === undefined) {
                return;
            }
            this.input.set(this.active.filter.filter);
            this.drop();
            this.markChangesForCheck();
        });
        this.input.actions.recent.subscribe(() => {
            this.markChangesForCheck();
        });
        const active = this.session.search.state().getActive();
        if (active !== undefined) {
            this.active = new ActiveSearch(active);
            this.input.drop();
        }
    }

    public ngOnKeyUpSearchInput(event: KeyboardEvent) {
        this.input.keyup(event);
    }

    public ngOnKeyDownSearchInput() {
        this.input.keydown();
    }

    public drop() {
        this.active = undefined;
        this.progress.hide();
        this.session.search
            .state()
            .reset()
            .catch((err: Error) => {
                this.log().error(`Fail to drop a search: ${err.message}`);
            })
            .finally(() => {
                this.markChangesForCheck();
            });
    }

    public onSaveAsFilter(): void {
        if (this.active === undefined) {
            return;
        }
        this.session.search.store().filters().addFromFilter(this.active.filter);
        this.drop();
    }
}
export interface ViewSearchInput extends IlcInterface {}
