import { Component } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { FileType, File } from '@platform/types/files';
import { components } from '@env/decorators/initial';
import { getRenderFor } from '@schema/render/tools';
import { SourceDefinition } from '@platform/types/transport';
import { IDLTOptions } from '@platform/types/parsers/dlt';

@Component({
    selector: 'app-layout-area-no-tabs-content',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class LayoutWorkspaceNoContent {
    public readonly FileType = FileType;

    public ngStream(target: FileType) {
        switch (target) {
            case FileType.Dlt:
                this.ilc()
                    .services.system.session.add()
                    .tab({
                        name: `Connecting to DLT Deamon`,
                        content: {
                            factory: components.get('app-tabs-source-dltnet'),
                            inputs: {
                                done: (options: {
                                    source: SourceDefinition;
                                    options: IDLTOptions;
                                }) => {
                                    this.ilc()
                                        .services.system.session.add()
                                        .empty(getRenderFor().dlt())
                                        .then((session) => {
                                            session
                                                .connect(options.source)
                                                .dlt(options.options)
                                                .then(() => {
                                                    // console.log(`Connected!`);
                                                })
                                                .catch((err: Error) => {
                                                    this.log().error(
                                                        `Fail to connect: ${err.message}`,
                                                    );
                                                });
                                        })
                                        .catch((err: Error) => {
                                            this.log().error(
                                                `Fail to create session: ${err.message}`,
                                            );
                                        });
                                },
                            },
                        },
                        active: true,
                    });
                break;
            default:
                break;
        }
    }

    public ngOpenFile(target: FileType) {
        const select = this.ilc().services.system.bridge.files().select;
        (() => {
            switch (target) {
                case FileType.Any:
                    return select.any();
                case FileType.Text:
                    return select.text();
                case FileType.Dlt:
                    return select.dlt();
                case FileType.Pcap:
                    return select.pcap();
                default:
                    return Promise.reject(new Error(`Unsupported file type`));
            }
        })()
            .then((files: File[]) => {
                if (files.length === 0) {
                    return;
                }
                files.forEach((file: File) => {
                    switch (file.type) {
                        case FileType.Any:
                        case FileType.Text:
                            this.ilc()
                                .services.system.session.add()
                                .file(
                                    {
                                        filename: file.filename,
                                        name: file.name,
                                        type: file.type,
                                        options: {},
                                    },
                                    getRenderFor().text(),
                                )
                                .then(() => {
                                    this.ilc()
                                        .services.system.recent.add()
                                        .file(file, {})
                                        .catch((err: Error) => {
                                            this.log().error(
                                                `Fail to add recent action; error: ${err.message}`,
                                            );
                                        });
                                })
                                .catch((err: Error) => {
                                    this.log().error(`Fail to create session: ${err.message}`);
                                });
                            break;
                        case FileType.Dlt:
                            this.ilc()
                                .services.system.session.add()
                                .tab({
                                    name: `Opening DLT file`,
                                    content: {
                                        factory: components.get('app-tabs-source-dltfile'),
                                        inputs: {
                                            file,
                                            done: (options: any) => {
                                                this.ilc()
                                                    .services.system.session.add()
                                                    .file(
                                                        {
                                                            filename: file.filename,
                                                            name: file.name,
                                                            type: file.type,
                                                            options: {
                                                                dlt: options,
                                                            },
                                                        },
                                                        getRenderFor().dlt(),
                                                    )
                                                    .then(() => {
                                                        this.ilc()
                                                            .services.system.recent.add()
                                                            .file(file, { dlt: options })
                                                            .catch((err: Error) => {
                                                                this.log().error(
                                                                    `Fail to add recent action; error: ${err.message}`,
                                                                );
                                                            });
                                                    })
                                                    .catch((err: Error) => {
                                                        this.log().error(
                                                            `Fail to create session: ${err.message}`,
                                                        );
                                                    });
                                            },
                                        },
                                    },
                                    active: true,
                                });
                            break;
                    }
                });
            })
            .catch((err: Error) => {
                this.log().error(`Fail to open file: ${err.message}`);
            });
    }
}
export interface LayoutWorkspaceNoContent extends IlcInterface {}
