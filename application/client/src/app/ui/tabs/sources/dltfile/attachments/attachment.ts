import { Subject, Subjects } from '@platform/env/subscription';
import { File } from '@platform/types/files';
import { FtFile } from '@platform/types/parsers/dlt';
import { FtOptions } from '@platform/types/parsers/dlt';
import { InternalAPI } from '@service/ilc';
import { Instance as Logger } from '@platform/env/logger';

export class Attachment {
    public subjects: Subjects<{
        scan: Subject<void>;
        scanned: Subject<void>;
        extract: Subject<void>;
        extracted: Subject<void>;
    }> = new Subjects({
        scan: new Subject<void>(),
        scanned: new Subject<void>(),
        extract: new Subject<void>(),
        extracted: new Subject<void>(),
    });

    private ilc: InternalAPI;
    private log: Logger;

    // scanned attachments with: name, path and details
    public index: [string, string, FtFile[]][] | undefined;

    constructor(ilc: InternalAPI, log: Logger) {
        this.ilc = ilc;
        this.log = log;
        this.index = undefined;
    }

    public destroy(): void {
        this.subjects.destroy();
    }

    public scan(): void {
        this.subjects.get().scan.emit();
    }

    public extract(): void {
        this.subjects.get().extract.emit();
    }

    public doScan(files: File[], options: FtOptions) {
        this.index = [];
        for (let i = 0; i < files.length; i++) {
            let name: string = files[i].name;
            let path: string = files[i].filename;
            this.ilc.services.system.bridge.dlt()
            .scan(path, options)
            .then((attachments) => {
                this.index?.push([name, path, attachments]);
            })
            .catch((err: Error) => {
                this.log.error(`Fail to scan attachments: ${err.message}`);
            });
        }
    }

    public doExtract(folder: string) {
        if (this.index != undefined) {
            for (let i = 0; i < this.index.length; i++) {
                let entry = this.index[i];
                this.ilc.services.system.bridge.dlt()
                .extract(entry[1], folder, entry[2])
                .then((size) => {
                    this.log.debug(`Extracted ${size} bytes from ${entry[1]}`);
                })
                .catch((err: Error) => {
                    this.log.error(`Fail to extract attachments: ${err.message}`);
                });
            }
        }
    }

    public doExtractAll(files: File[], folder: string, options: FtOptions) {
        for (let i = 0; i < files.length; i++) {
            let path: string = files[i].filename;
            this.ilc.services.system.bridge.dlt()
            .extractAll(path, folder, options)
            .then((size) => {
                this.log.debug(`Extracted ${size} bytes from ${path}`);
            })
            .catch((err: Error) => {
                this.log.error(`Fail to extract attachments: ${err.message}`);
            });
        }
    }

    public isScanned(): boolean {
        return this.index != undefined;
    }

    public getInfo(): string {
        if (this.index === undefined) {
            return "";
        }
        let info: string = "";
        for (let i = 0; i < this.index.length; i++) {
            let entry = this.index[i];
            info += entry[0] + " : " + entry[2].length + " files\n";
        }
        return info;
    }
}
