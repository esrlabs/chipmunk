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
    HostListener,
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
    standalone: false,
})
@Ilc()
export class ViewSearchNested
    extends ChangesDetector
    implements AfterViewInit, AfterContentInit, OnDestroy
{
    @Input() public session!: Session;

    @ViewChild('searchinput') searchInputRef!: ElementRef<HTMLInputElement>;
    @ViewChild(MatAutocompleteTrigger) recentPanelRef!: MatAutocompleteTrigger;
    @HostListener('window:keydown', ['$event']) onKeyDown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            this.close();
        }
    }
    public readonly input = new SearchInput();
    public readonly recent: List;
    public pendding: boolean = false;
    public progress: boolean = false;

    protected action(action: Promise<number | undefined>) {
        this.pendding = true;
        action
            .catch((err: Error) => {
                this.log().error(`Fail go to next/prev nested match: ${err.message}`);
            })
            .finally(() => {
                clearTimeout(tm);
                this.progress = false;
                this.pendding = false;
                this.detectChanges();
            });
        // Show progress bar with delay to prevent showing it for quick done work
        const tm = setTimeout(() => {
            this.progress = true;
            this.detectChanges();
        }, 250) as unknown as number;
    }
    constructor(chRef: ChangeDetectorRef) {
        super(chRef);
        this.recent = new List(this.input.control, 'RecentNestedFilters', 'recent_nested_filters');
    }

    public ngOnDestroy(): void {
        this.session.search.state().nested().drop();
        this.input.destroy();
    }

    public ngAfterContentInit(): void {
        this.env().subscriber.register(
            this.ilc().services.system.hotkeys.listen(']', () => {
                if (this.session.search.state().nested().get() === undefined) {
                    return;
                }
                this.next();
            }),
            this.ilc().services.system.hotkeys.listen('[', () => {
                if (this.session.search.state().nested().get() === undefined) {
                    return;
                }
                this.prev();
            }),
        );
    }

    public ngAfterViewInit(): void {
        this.input.bind(this.searchInputRef.nativeElement, this.recentPanelRef);
        this.input.actions.accept.subscribe(() => {
            const value = this.input.value.trim();
            if (value === '') {
                this.drop();
                return;
            }
            const current = this.session.search.state().nested().get();
            if (current !== undefined && current.filter === value) {
                this.next();
                return;
            }
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
        if (this.pendding) {
            return;
        }
        this.action(this.session.search.state().nested().next());
    }

    public prev() {
        if (this.pendding) {
            return;
        }
        this.action(this.session.search.state().nested().prev());
    }

    public drop() {
        this.session.search.state().nested().drop();
    }

    public close() {
        this.session.search.state().nested().toggle();
    }
}
export interface ViewSearchNested extends IlcInterface {}
