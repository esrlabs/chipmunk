import { Component, ChangeDetectorRef, Input, AfterViewInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Session } from '@service/session/session';
import { File } from '@platform/types/files';
import { bytesToStr, timestampToUTC } from '@env/str';
import { ObserveOperation } from '@service/session/dependencies/observe/operation';

@Component({
    selector: 'app-transport-file-details',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class TransportFile extends ChangesDetector implements AfterViewInit {
    @Input() public observe!: ObserveOperation | undefined;
    @Input() public source!: string;
    @Input() public session!: Session;

    public file: File | undefined;
    public datetime: (ts: number) => string = timestampToUTC;
    public bytesToStr: (size: number) => string = bytesToStr;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterViewInit(): void {
        this.ilc()
            .services.system.bridge.files()
            .getByPath([this.source])
            .then((result) => {
                if (result.length !== 1) {
                    this.log().error(`Invalid file stat info`);
                    return;
                }
                this.file = result[0];
                this.detectChanges();
            })
            .catch((err: Error) => {
                this.log().error(`Fail to get file info: ${err.message}`);
            });
    }

    public ngSize(size: number): string {
        return bytesToStr(size);
    }
}
export interface TransportFile extends IlcInterface {}
