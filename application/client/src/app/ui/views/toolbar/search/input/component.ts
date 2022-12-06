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
import { List } from '@env/storages/recent/list';
import { Progress } from './progress';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { ActiveSearch } from './active';
import { Map } from '@service/session/dependencies/search/map';
import { IFilter } from '@platform/types/filter';

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
    public readonly recent: List;
    public active: ActiveSearch | undefined;
    public progress!: Progress;
    public map!: Map;

    constructor(chRef: ChangeDetectorRef) {
        super(chRef);
        this.recent = new List(this.input.control, 'RecentFilters', 'recent_filters');
    }

    public ngOnDestroy(): void {
        this.input.destroy();
        this.progress.destroy();
    }

    public ngAfterContentInit(): void {
        this.progress = new Progress(this.session);
        this.map = this.session.search.map;
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
                .finish.subscribe((found: number) => {
                    this.progress.setFound(found);
                    this.progress.stop();
                }),
        );
        this.env().subscriber.register(
            this.ilc().services.system.hotkeys.listen('Ctrl + F', () => {
                this.input.focus();
            }),
        );
        this.env().subscriber.register(
            this.session.search
                .state()
                .subjects.get()
                .showMatches.subscribe((filter: IFilter) => {
                    this._updateSearch(filter);
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
                .catch((err: Error) => {
                    this.log().error(`Fail to accept search: ${err.message}`);
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
        this.input.actions.reaccept.subscribe(() => {
            this._updateSearch(undefined);
        });

        const active = this.session.search.state().getActive();
        if (active !== undefined) {
            this.active = new ActiveSearch(active);
            this.input.drop();
        }
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

    private _updateSearch(filter: IFilter | undefined) {
        if (filter === undefined) {
            filter = this.active?.filter;
            if (filter === undefined) {
                return;
            }
            filter.flags = this.input.flags;
        }
        this.session.search
            .state()
            .setActive(filter)
            .then(() => {
                if (filter === undefined) {
                    return;
                }
                this.active = new ActiveSearch(filter);
                this.input.drop();
            })
            .catch((err: Error) => {
                this.log().error(`Fail to update search: ${err.message}`);
            })
            .finally(() => {
                this.markChangesForCheck();
            });
    }
}
export interface ViewSearchInput extends IlcInterface {}
