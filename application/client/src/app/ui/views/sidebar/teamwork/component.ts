import {
    Component,
    Input,
    ChangeDetectorRef,
    AfterContentInit,
    ViewChild,
    ChangeDetectionStrategy,
    HostListener,
} from '@angular/core';
import { Session } from '@service/session';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Attachment } from '@platform/types/content';
import { Locker } from '@ui/service/lockers';
import { Notification } from '@ui/service/notifications';
import { Owner } from '@schema/content/row';
import { NormalizedBackgroundTask } from '@platform/env/normalized';
import { IMenuItem } from '@ui/service/contextmenu';
import { GitHubRepo } from '@platform/types/github';

import * as dom from '@ui/env/dom';

@Component({
    selector: 'app-views-teamwork',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class TeamWork extends ChangesDetector implements AfterContentInit {
    @Input() session!: Session;

    public repos: GitHubRepo[] = [];
    public active: GitHubRepo | undefined;
    public editable: GitHubRepo | undefined;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.repos = this.session.teamwork.repo().list();
        this.active = this.session.teamwork.repo().getActive();
        this.env().subscriber.register(
            this.session.teamwork.subjects.get().active.subscribe(() => {
                this.active = this.session.teamwork.repo().getActive();
                this.detectChanges();
            }),
        );
    }

    public repo(): {
        create(): void;
        edit(): void;
        save(): void;
        cancel(): void;
        isPossibleToSave(): boolean;
        setActive(repo: GitHubRepo): void;
        isActive(repo: GitHubRepo): boolean;
    } {
        return {
            create: (): void => {
                this.editable = { uuid: '', repo: '', branch: 'master', owner: '', token: '' };
                this.detectChanges();
            },
            edit: (): void => {
                if (this.active === undefined) {
                    return;
                }
                this.editable = Object.assign({}, this.active);
                this.detectChanges();
            },
            save: (): void => {
                if (this.editable === undefined || !this.repo().isPossibleToSave()) {
                    return;
                }
                (() => {
                    if (this.editable.uuid.trim() === '') {
                        return this.session.teamwork.repo().create(this.editable);
                    } else {
                        return this.session.teamwork.repo().update(this.editable);
                    }
                })()
                    .then(() => {
                        this.editable = undefined;
                        this.detectChanges();
                        this.session.teamwork
                            .repo()
                            .reload()
                            .then(() => {
                                this.repos = this.session.teamwork.repo().list();
                                this.active = this.session.teamwork.repo().getActive();
                            })
                            .catch((err: Error) => {
                                this.log().error(`Fail reload repos: ${err.message}`);
                            })
                            .finally(() => {
                                this.detectChanges();
                            });
                    })
                    .catch((err: Error) => {
                        this.ilc().services.ui.notifications.notify(
                            new Notification({
                                message: `Fail to save GitHub Reference: ${err.message}`,
                                actions: [],
                                session: this.session.uuid(),
                            }),
                        );
                    });
            },
            cancel: (): void => {
                this.editable = undefined;
                this.detectChanges();
            },
            isPossibleToSave: (): boolean => {
                if (this.editable === undefined) {
                    return false;
                }
                if (
                    this.editable.repo.trim() === '' ||
                    this.editable.branch.trim() === '' ||
                    this.editable.token.trim() === ''
                ) {
                    return false;
                }
                return true;
            },
            setActive: (repo: GitHubRepo | undefined): void => {
                this.session.teamwork.repo().setActive(repo);
            },
            isActive: (repo: GitHubRepo): boolean => {
                return this.active === undefined ? false : this.active.uuid === repo.uuid;
            },
        };
    }
}
export interface TeamWork extends IlcInterface {}
