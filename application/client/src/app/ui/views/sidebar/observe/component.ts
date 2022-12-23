import { Component, Input, AfterContentInit, ChangeDetectorRef, ElementRef } from '@angular/core';
import { Session } from '@service/session';
import { ObserveOperation } from '@service/session/dependencies/observe/operation';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { DataSource } from '@platform/types/observe';
import { Alias, getRenderAlias } from '@schema/render/tools';
import { SourceHolder } from './holder';

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
        running: SourceHolder[];
        done: SourceHolder[];
    } = {
        running: [],
        done: [],
    };
    public selected: SourceHolder | undefined;

    constructor(cdRef: ChangeDetectorRef, private _self: ElementRef) {
        super(cdRef);
    }

    protected update() {
        this.observed.running = [];
        this.observed.done = [];
        Array.from(this.session.stream.observed.running.values()).forEach(
            (observed: ObserveOperation) => {
                const source = observed.asSource();
                if (source.childs.length !== 0) {
                    this.observed.running.push(
                        ...source.childs.map((s) => new SourceHolder(s, observed)),
                    );
                } else {
                    this.observed.running.push(new SourceHolder(source, observed));
                }
            },
        );
        Array.from(this.session.stream.observed.done.values()).forEach((source: DataSource) => {
            if (source.childs.length !== 0) {
                this.observed.done.push(...source.childs.map((s) => new SourceHolder(s)));
            } else {
                this.observed.done.push(new SourceHolder(source));
            }
        });
        if (this.selected !== undefined) {
            const selected = this.selected;
            this.observed.done.concat(this.observed.running).forEach((holder) => {
                if (holder.isSame(selected)) {
                    this.selected = holder;
                }
            });
        }
        this.detectChanges();
    }

    public ngAfterContentInit(): void {
        this.env().subscriber.register(
            this.session.stream.subjects.get().observe.subscribe(() => {
                this.update();
            }),
        );
        this.update();
    }

    public ngSelect(holder: SourceHolder): void {
        if (this.selected !== undefined && this.selected.source.uuid === holder.uuid()) {
            this.selected = undefined;
        } else {
            this.selected = holder;
        }
        this.detectChanges();
    }

    public ngGetCssClass(holder: SourceHolder): string {
        if (this.selected !== undefined && this.selected.source.uuid === holder.uuid()) {
            return 'selected';
        } else {
            return '';
        }
    }

    protected last(): {
        any(): SourceHolder | undefined;
        running(): SourceHolder | undefined;
    } {
        return {
            any: (): SourceHolder | undefined => {
                if (this.observed.running.length > 0) {
                    return this.observed.running[this.observed.running.length - 1];
                } else if (this.observed.done.length > 0) {
                    return this.observed.done[this.observed.done.length - 1];
                }
                return undefined;
            },
            running: (): SourceHolder | undefined => {
                if (this.observed.running.length > 0) {
                    return this.observed.running[this.observed.running.length - 1];
                }
                return undefined;
            },
        };
    }

    public attachableAs(): {
        stream(): boolean;
        file(): boolean;
    } {
        return {
            stream: (): boolean => {
                const source = this.last().any();
                return source === undefined
                    ? false
                    : !(source.source.asSourceDefinition() instanceof Error);
            },
            file: (): boolean => {
                if (this.attachableAs().stream()) {
                    return false;
                }
                const running = this.last().running();
                if (running !== undefined && running.source.parser.Text !== undefined) {
                    return false;
                }
                return true;
            },
        };
    }

    public attach(): {
        stream(): void;
        file(): void;
    } {
        return {
            stream: (): void => {
                const render = getRenderAlias(this.session);
                if (render instanceof Error) {
                    this.log().error(render.message);
                    return;
                }
                const assigned = this.ilc()
                    .services.system.opener.stream(undefined, undefined, undefined)
                    .assign(this.session);
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
            },
            file: (): void => {
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
                    const assigned = this.ilc()
                        .services.system.opener.file(files[0])
                        .assign(this.session);
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
            },
        };
    }

    public isAttachingDisabled(): boolean {
        if (this.observed.running.length !== 1) {
            return false;
        }
        const source = this.observed.running[0].source;
        return source.asSourceDefinition() instanceof Error;
    }
}
export interface ObserveList extends IlcInterface {}
