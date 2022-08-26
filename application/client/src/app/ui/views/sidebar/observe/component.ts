import { Component, Input, AfterContentInit, ChangeDetectorRef, ElementRef } from '@angular/core';
import { Session } from '@service/session';
import { ObserveOperation } from '@service/session/dependencies/observe/operation';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { DataSource } from '@platform/types/observe';
import { Alias, getRenderAlias } from '@schema/render/tools';

@Component({
    selector: 'app-views-observe-list',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class ObserveList extends ChangesDetector implements AfterContentInit {
    @Input() session!: Session;

    public observed: {
        running: Map<string, ObserveOperation>;
        done: Map<string, DataSource>;
    } = {
        running: new Map(),
        done: new Map(),
    };
    public selected: { uuid: string; source: DataSource | ObserveOperation } | undefined;

    constructor(cdRef: ChangeDetectorRef, private _self: ElementRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.env().subscriber.register(
            this.session.stream.subjects.get().observe.subscribe(() => {
                this.observed = this.session.stream.observed;
                if (this.selected !== undefined && this.observed.done.has(this.selected.uuid)) {
                    this.selected.source = this.observed.done.get(this.selected.uuid) as DataSource;
                }
                this.detectChanges();
            }),
        );
        this.observed = this.session.stream.observed;
    }

    public ngSelect(uuid: string, source: DataSource | ObserveOperation): void {
        if (this.selected !== undefined && this.selected.uuid === uuid) {
            this.selected = undefined;
        } else {
            this.selected = { uuid, source };
        }
        this.detectChanges();
    }

    public ngGetCssClass(uuid: string): string {
        if (this.selected !== undefined && this.selected.uuid === uuid) {
            return 'selected';
        } else {
            return '';
        }
    }

    public ngAttachStream() {
        const render = getRenderAlias(this.session);
        if (render instanceof Error) {
            this.log().error(render.message);
            return;
        }
        const assigned = this.ilc().services.system.opener.stream().assign(this.session);
        switch (render) {
            case Alias.dlt:
                assigned.dlt().catch((err: Error) => {
                    this.log().error(`Fail to open DLT stream; error: ${err.message}`);
                });
                break;
            case Alias.text:
                assigned.text().catch((err: Error) => {
                    this.log().error(`Fail to open DLT stream; error: ${err.message}`);
                });
                break;
        }
    }

    public ngAddFile() {
        const render = getRenderAlias(this.session);
        if (render instanceof Error) {
            this.log().error(render.message);
            return;
        }
        (() => {
            const select = this.ilc().services.system.bridge.files().select;
            switch (render) {
                case Alias.dlt:
                    return select.dlt();
                case Alias.text:
                    return select.text();
            }
        })().then((files) => {
            if (files.length !== 1) {
                this.log().error(`Fail to open file: invalid count of files`);
                return;
            }
            const assigned = this.ilc().services.system.opener.file(files[0]).assign(this.session);
            switch (render) {
                case Alias.dlt:
                    assigned.dlt().catch((err: Error) => {
                        this.log().error(`Fail to open DLT file; error: ${err.message}`);
                    });
                    break;
                case Alias.text:
                    assigned.text().catch((err: Error) => {
                        this.log().error(`Fail to open DLT file; error: ${err.message}`);
                    });
                    break;
            }
        });
    }

    public isTextFile(): boolean {
        const running = Array.from(this.observed.running.values());
        if (running.length !== 1) {
            return false;
        }
        const source = running[0].asSource();
        return source.File !== undefined && source.File[1].Text !== undefined ? true : false;
    }
}
export interface ObserveList extends IlcInterface {}
