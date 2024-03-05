import { Component, OnDestroy, Input, AfterContentInit, ChangeDetectorRef } from '@angular/core';
import { Session } from '@service/session';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { GitHubRepo } from '@platform/types/github';
import { MatSelectChange } from '@angular/material/select';

@Component({
    selector: 'app-views-filters-teamwork',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class Teamwork extends ChangesDetector implements OnDestroy, AfterContentInit {
    @Input() session!: Session;

    protected reload() {
        this.repos = this.session.teamwork.repo().list();
        this.active = this.session.teamwork.repo().getActive();
        this.selected = this.active === undefined ? 0 : this.active;
    }
    public repos: GitHubRepo[] = [];
    public active: GitHubRepo | undefined = undefined;
    public selected: GitHubRepo | number = 0;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngOnDestroy() {}

    public ngAfterContentInit(): void {
        this.reload();
        this.env().subscriber.register(
            this.session.teamwork.subjects.get().active.subscribe(() => {
                this.reload();
                this.detectChanges();
            }),
        );
        this.env().subscriber.register(
            this.session.teamwork.subjects.get().loaded.subscribe(() => {
                this.reload();
                this.detectChanges();
            }),
        );
    }

    public onSelectionChange(event: MatSelectChange) {
        if (event.value === 0) {
            this.selected = 0;
            this.session.teamwork.repo().setActive(undefined);
        } else {
            this.selected = event.value;
            this.session.teamwork.repo().setActive(event.value);
        }
        this.detectChanges();
    }

    public openManager() {
        this.session.switch().sidebar.teamwork();
    }
}
export interface Teamwork extends IlcInterface {}
