import { Component, ChangeDetectorRef, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Element } from '../../element/element';
import { File } from '@platform/types/files';
import { State } from '../../states/files';
import { IButton } from '../../common/title/component';
import { ListBase } from '../component';
import { Provider } from '@service/session/dependencies/observing/implementations/files';
import { ObserveSource } from '@service/session/dependencies/observing/source';

import * as $ from '@platform/types/observe';
import * as Factory from '@platform/types/observe/factory';

@Component({
    selector: 'app-views-observed-list-file',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class List extends ListBase<State, Provider> implements AfterContentInit {
    public tailing: Element[] = [];
    public offline: Element[] = [];
    public buttons: IButton[] = [
        {
            icon: 'codicon-tasklist',
            handler: () => {
                this.provider.recent();
            },
        },
    ];
    public warning: string | undefined = undefined;

    protected inited: boolean = false;

    constructor(cdRef: ChangeDetectorRef) {
        super(new State(), cdRef);
    }

    public override ngAfterContentInit(): void {
        super.ngAfterContentInit();
        this.update();
        this.env().subscriber.register(
            this.provider.subjects.get().updated.subscribe(() => {
                this.update().detectChanges();
            }),
        );
    }

    protected update(): List {
        const filterFileNature = (s: ObserveSource): boolean => {
            return s.observe.origin.nature().alias() === $.Origin.Context.File;
        };
        const filterAsFile = (s: ObserveSource): $.Origin.File.Configuration => {
            return s.observe.origin.as<$.Origin.File.Configuration>(
                $.Origin.File.Configuration,
            ) as $.Origin.File.Configuration;
        };
        const asFileInstance = (s: ObserveSource): $.Origin.File.Configuration => {
            return s.observe.origin.as<$.Origin.File.Configuration>(
                $.Origin.File.Configuration,
            ) as $.Origin.File.Configuration;
        };
        const tailing = this.provider
            .sources()
            .filter((s) => s.observer !== undefined)
            .filter(filterFileNature);
        const offline = this.provider
            .sources()
            .filter((s) => s.observer === undefined)
            .filter(filterFileNature);
        const attachNewSourceErr = this.provider.getNewSourceError();
        this.warning = attachNewSourceErr instanceof Error ? attachNewSourceErr.message : undefined;
        this.ilc()
            .services.system.bridge.files()
            .getByPathWithCache([
                ...tailing.map(filterAsFile).map((i) => i.filename()),
                ...offline.map(filterAsFile).map((i) => i.filename()),
            ])
            .then((files: File[]) => {
                this.tailing = [];
                this.offline = [];
                files.forEach((file) => {
                    const tailingSource = tailing.find(
                        (s) => asFileInstance(s).filename() === file.filename,
                    );
                    const offlineSource = offline.find(
                        (s) => asFileInstance(s).filename() === file.filename,
                    );
                    if (tailingSource !== undefined) {
                        this.tailing.push(
                            new Element(tailingSource, this.provider).set().file(file),
                        );
                    }
                    if (offlineSource !== undefined) {
                        this.offline.push(
                            new Element(offlineSource, this.provider).set().file(file),
                        );
                    }
                });
            })
            .catch((err: Error) => {
                this.log().error(`Fail load stat of files: ${err.message}`);
            })
            .finally(() => {
                this.detectChanges();
            });
        return this;
    }

    public toggled(opened: boolean) {
        this.state.toggleQuickSetup(opened);
    }

    public attach() {
        const last = this.provider.last();
        if (last === undefined) {
            return;
        }
        this.ilc()
            .services.system.bridge.files()
            .select.any()
            .then((files: File[]) => {
                if (files.length === 0) {
                    return;
                }
                this.provider.session.stream
                    .observe()
                    .start(
                        files.length === 1
                            ? new Factory.File()
                                  .file(files[0].filename)
                                  .protocol(last.parser.instance.alias()).observe
                            : new Factory.Concat()
                                  .files(files.map((f) => f.filename))
                                  .protocol(last.parser.instance.alias()).observe,
                    )
                    .catch((err: Error) => {
                        this.log().error(`Fail to observe: ${err.message}`);
                    });
            })
            .catch((err: Error) => {
                this.log().error(`Fail to select file(s): ${err.message}`);
            });
    }
}
export interface List extends IlcInterface {}
