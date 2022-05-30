import {
    Component,
    OnDestroy,
    ViewChild,
    Input,
    AfterContentInit,
    AfterViewInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    ElementRef,
} from '@angular/core';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { Session } from '@service/session';
import { Ilc, IlcInterface, Declarations, Channel } from '@env/decorators/component';
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
        this.progress = new Progress(this.session, this.ilc().channel);
        this.progress.updated.subscribe(() => {
            this.detectChanges();
        });
    }

    public ngAfterViewInit(): void {
        this.input.bind(this.searchInputRef.nativeElement, this.recentPanelRef);
        this.input.actions.accept.subscribe((filter: string) => {
            this.onActiveDrop(() => {
                this.progress.start();
                this.session.search
                    .search([this.input.asFilter()])
                    .then((results: ISearchResults) => {
                        this.active = new ActiveSearch(this.input.asFilter());
                        this.input.drop();
                        this.progress.setFound(results.found);
                    })
                    .catch((err: Error) => {
                        this.log().error(`Fail to make search: ${err.message}`);
                    })
                    .finally(() => {
                        this.progress.stop();
                        this.markChangesForCheck();
                    });
                this.markChangesForCheck();
            });
        });
        this.input.actions.drop.subscribe(() => {
            this.onActiveDrop();
        });
        this.input.actions.edit.subscribe(() => {
            if (this.active === undefined) {
                return;
            }
            this.input.set(this.active.filter.filter);
            this.onActiveDrop();
            this.markChangesForCheck();
        });
        this.input.actions.recent.subscribe(() => {
            this.markChangesForCheck();
        });
    }

    public ngOnKeyUpSearchInput(event: KeyboardEvent) {
        this.input.keyup(event);
    }

    public ngOnKeyDownSearchInput(event: KeyboardEvent) {
        this.input.keydown(event);
    }

    public onActiveDrop(cb?: () => void) {
        this.active = undefined;
        this.progress.hide();
        this.session.search
            .drop()
            .catch((err: Error) => {
                this.log().error(`Fail to drop a search: ${err.message}`);
            })
            .finally(() => {
                this.markChangesForCheck();
                if (cb !== undefined) {
                    cb();
                }
            });
    }

    public onSaveAsFilter(): void {
        if (this.active === undefined) {
            return;
        }
        this.session.search.store().filters().addFromFilter(this.active.filter);
    }
}
export interface ViewSearchInput extends IlcInterface {}
