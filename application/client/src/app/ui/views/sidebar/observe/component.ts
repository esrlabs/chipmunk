import { Component, Input, ChangeDetectorRef, ElementRef, ViewEncapsulation } from '@angular/core';
import { Session } from '@service/session';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { SourceRef } from '@service/opener';
import { File } from '@platform/types/files';

@Component({
    selector: 'app-views-observe-list',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
})
@Initial()
@Ilc()
export class Observed extends ChangesDetector {
    @Input() session!: Session;

    public actions: Array<{ icon: string; title: string; handler: () => void } | null> = [
        {
            icon: 'note_add',
            title: 'Attach Files',
            handler: () => {
                this.open().files();
            },
        },
        null,
        {
            icon: 'input',
            title: 'Connect TCP',
            handler: () => {
                this.open().stream(SourceRef.Tcp);
            },
        },
        {
            icon: 'input',
            title: 'Connect UDP',
            handler: () => {
                this.open().stream(SourceRef.Udp);
            },
        },
        {
            icon: 'settings_input_composite',
            title: 'Connect Serial',
            handler: () => {
                this.open().stream(SourceRef.Serial);
            },
        },
        null,
        {
            icon: 'minimize',
            title: 'Command',
            handler: () => {
                this.open().stream(SourceRef.Process);
            },
        },
    ];

    constructor(cdRef: ChangeDetectorRef, private _self: ElementRef) {
        super(cdRef);
    }

    public attach(): {
        disabled(): boolean;
        error(): string | undefined;
    } {
        return {
            disabled: (): boolean => {
                return this.session.observed.getNewSourceError() instanceof Error;
            },
            error: (): string | undefined => {
                const error = this.session.observed.getNewSourceError();
                return error instanceof Error ? error.message : undefined;
            },
        };
    }

    protected open(): {
        files(): void;
        stream(sourceRef: SourceRef): void;
    } {
        const parser = this.session.observed.get().parser();
        if (parser instanceof Error) {
            this.log().error(`Fail to attach new source: ${parser.message}`);
        }
        return {
            files: (): void => {
                if (parser instanceof Error) {
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
                                .assign(this.session)
                                .byParser(parser)
                                .catch((err: Error) => {
                                    this.log().error(`Fail to open new stream: ${err.message}`);
                                });
                        }
                    })
                    .catch((err: Error) => {
                        this.log().error(`Fail to select file(s): ${err.message}`);
                    });
            },
            stream: (sourceRef: SourceRef): void => {
                if (parser instanceof Error) {
                    return;
                }
                this.ilc()
                    .services.system.opener.stream(undefined, true, sourceRef)
                    .assign(this.session)
                    .byParser(parser)
                    .catch((err: Error) => {
                        this.log().error(`Fail to open new stream: ${err.message}`);
                    });
            },
        };
    }
}
export interface Observed extends IlcInterface {}
