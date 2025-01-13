import { Component, Input, AfterContentInit, ChangeDetectorRef } from '@angular/core';
import { Session } from '@service/session';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { GitHubRepo } from '@platform/types/github';
import { FileMetaData } from '@platform/types/github/filemetadata';
import { MatSelectChange } from '@angular/material/select';

@Component({
    selector: 'app-views-teamwork-applet',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Initial()
@Ilc()
export class Teamwork extends ChangesDetector implements AfterContentInit {
    @Input() session!: Session;

    protected reload() {
        this.repos = this.session.teamwork.repo().list();
        this.active = this.session.teamwork.repo().getActive();
        this.selected = this.active === undefined ? 0 : this.active;
        this.remote = this.session.teamwork.md().getIfDifferentToLocal();
        this.detectChanges();
    }
    public repos: GitHubRepo[] = [];
    public active: GitHubRepo | undefined = undefined;
    public selected: GitHubRepo | number = 0;
    public remote: FileMetaData | undefined;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

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
        this.env().subscriber.register(
            this.session.teamwork.subjects.get().metadata.subscribe(() => {
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

    public reloadRemote() {
        this.session.teamwork.update();
    }
    public importRemote() {
        this.session.teamwork
            .md()
            .importFromRemote()
            .then(() => {
                this.reload();
            })
            .catch((err: Error) => {
                this.log().error(`Fail to import from remote: ${err.message}`);
            });
    }
}
export interface Teamwork extends IlcInterface {}
