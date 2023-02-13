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
import { SearchInput } from './input';
import { List } from '@env/storages/recent/list';
import { Progress } from './progress';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { ActiveSearch } from './active';
import { Indexed } from '@service/session/dependencies/indexed';
import { ISearchFinishEvent } from '@service/session/dependencies/search/state';
import { Notification } from '@ui/service/notifications';

@Component({
    selector: 'app-views-search-input',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
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
    public occupied: boolean = false;
    public active: ActiveSearch | undefined;
    public progress!: Progress;
    public indexed!: Indexed;

    constructor(chRef: ChangeDetectorRef) {
        super(chRef);
        this.recent = new List(this.input.control, 'RecentFilters', 'recent_filters');
    }

    public ngOnDestroy(): void {
        this.input.destroy();
        this.progress.destroy();
    }

    public ngAfterContentInit(): void {
        this.progress = new Progress(this.session, this.session.search.state().progress().search());
        this.indexed = this.session.indexed;
        this.env().subscriber.register(
            this.progress.updated.subscribe(() => {
                this.detectChanges();
            }),
        );
        this.env().subscriber.register(
            this.ilc().channel.ui.toolbar.resize(() => {
                this.toolbar().resized();
            }),
        );
        this.env().subscriber.register(
            this.input.error.updated.subscribe(() => {
                this.detectChanges();
            }),
        );
        this.env().subscriber.register(
            this.session.search
                .state()
                .subjects.search.get()
                .start.subscribe(() => {
                    this.progress.start();
                }),
        );
        this.env().subscriber.register(
            this.session.search
                .state()
                .subjects.search.get()
                .finish.subscribe((result: ISearchFinishEvent) => {
                    this.progress.stop();
                    this.detectChanges();
                    if (result.error !== undefined) {
                        this.log().error(result.error);
                        this.ilc().services.ui.notifications.notify(
                            new Notification({ message: result.error, actions: [] }),
                        );
                    }
                }),
        );
        this.env().subscriber.register(
            this.ilc().services.system.hotkeys.listen('Ctrl + F', () => {
                this.input.focus();
            }),
        );
    }

    public ngAfterViewInit(): void {
        this.input.bind(this.searchInputRef.nativeElement, this.recentPanelRef);
        this.input.actions.flags.subscribe(() => {
            if (this.active === undefined) {
                return;
            }
            this.active
                .setFlags(this.input.flags)
                .apply()
                .catch((err: Error) => {
                    this.log().error(`Fail to set flags on search search: ${err.message}`);
                })
                .finally(() => {
                    this.markChangesForCheck();
                });
        });
        this.input.actions.accept.subscribe(() => {
            if (this.active === undefined) {
                const filter = this.input.asFilter();
                this.recent.update(filter.filter);
                this.session.search
                    .state()
                    .setActive(filter)
                    .then(() => {
                        this.active = new ActiveSearch(this.session.search, filter);
                        this.input.drop();
                    })
                    .catch((err: Error) => {
                        this.log().error(`Fail to accept search: ${err.message}`);
                    })
                    .finally(() => {
                        this.markChangesForCheck();
                    });
            } else if (this.active.isPossibleToSaveAsFilter()) {
                this.onSaveAsFilter();
            }
        });
        this.input.actions.drop.subscribe(() => {
            this.drop();
        });
        this.input.actions.edit.subscribe(() => {
            if (this.active === undefined) {
                return;
            }
            this.input.set().value(this.active.filter.filter);
            this.drop();
            this.markChangesForCheck();
        });
        this.input.actions.recent.subscribe(() => {
            this.markChangesForCheck();
        });

        const active = this.session.search.state().getActive();
        if (active !== undefined) {
            this.active = new ActiveSearch(this.session.search, active);
            this.input.drop();
        }
    }

    public drop() {
        this.active = undefined;
        this.session.search
            .state()
            .reset()
            .search()
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

    protected toolbar(): {
        resized(): void;
    } {
        return {
            resized: (): void => {
                this.ilc()
                    .services.ui.layout.toolbar()
                    .state(
                        (state: {
                            min: boolean;
                            max: boolean;
                            occupied: boolean;
                            size: number;
                        }) => {
                            this.occupied = state.occupied;
                            this.detectChanges();
                        },
                    );
            },
        };
    }
}
export interface ViewSearchInput extends IlcInterface {}
