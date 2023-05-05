import { Component, ChangeDetectorRef, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Element } from '../../element/element';
import { File } from '@platform/types/files';
import { State } from '../../states/files';
import { IButton } from '../../common/title/component';
import { components } from '@env/decorators/initial';
import { Vertical, Horizontal } from '@ui/service/popup';
import { ListBase } from '../component';
import { Provider } from '@service/session/dependencies/observing/implementations/files';

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
                const parser = this.provider.get().parser();
                const origin = this.provider.get().origin();
                if (parser instanceof Error || origin instanceof Error) {
                    return;
                }
                this.ilc().services.ui.popup.open({
                    component: {
                        factory: components.get('app-recent-actions-mini'),
                        inputs: {
                            parser,
                            origin,
                        },
                    },
                    position: {
                        vertical: Vertical.top,
                        horizontal: Horizontal.center,
                    },
                    closeOnKey: 'Escape',
                    width: 450,
                    uuid: 'app-recent-actions-popup-observed',
                });
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
        const tailing = this.provider.sources().filter((s) => s.observer !== undefined);
        const offline = this.provider.sources().filter((s) => s.observer === undefined);
        const attachNewSourceErr = this.provider.getNewSourceError();
        this.warning = attachNewSourceErr instanceof Error ? attachNewSourceErr.message : undefined;
        this.ilc()
            .services.system.bridge.files()
            .getByPathWithCache([
                ...tailing.map((s) => s.source.asFile() as string),
                ...offline.map((s) => s.source.asFile() as string),
            ])
            .then((files: File[]) => {
                this.tailing = [];
                this.offline = [];
                files.forEach((file) => {
                    const tailingSource = tailing.find((s) => s.source.asFile() === file.filename);
                    const offlineSource = offline.find((s) => s.source.asFile() === file.filename);
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
        const parser = this.provider.get().parser();
        if (parser instanceof Error) {
            this.log().error(`Fail to attach new source: ${parser.message}`);
            return;
        }
        this.ilc()
            .services.system.bridge.files()
            .select.any()
            .then((files: File[]) => {
                if (files.length < 1) {
                    return;
                } else {
                    this.ilc()
                        .services.system.opener.concat(files)
                        .assign(this.provider.session)
                        .byParser(parser)
                        .catch((err: Error) => {
                            this.log().error(`Fail to open new stream: ${err.message}`);
                        });
                }
            })
            .catch((err: Error) => {
                this.log().error(`Fail to select file(s): ${err.message}`);
            });
    }
}
export interface List extends IlcInterface {}
