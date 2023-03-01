import { Subject, Subjects } from '@platform/env/subscription';
import { File } from '@platform/types/files';
import { Attachment } from '@platform/types/parsers/dlt';
import { FtOptions } from '@platform/types/parsers/dlt';
import { InternalAPI } from '@service/ilc';
import { Instance as Logger } from '@platform/env/logger';

export class AttachmentAction {
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
    public index: [string, string, Attachment[]][] | undefined;

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
            const name: string = files[i].name;
            const path: string = files[i].filename;
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

    public doExtract(file: string, folder: string, attachment: Attachment) {
        let name = attachment.name.replaceAll(' ', "_");
        name = name.replaceAll('\\', "$");
        name = name.replaceAll('/', "$");
        this.ilc.services.system.bridge.dlt()
        .extract(file, folder, [[attachment, name]])
        .then((size) => {
            this.log.debug(`Extracted ${size} bytes from ${file}`);
        })
        .catch((err: Error) => {
            this.log.error(`Fail to extract attachments: ${err.message}`);
        });
    }

    public doExtractAll(files: File[], folder: string, options: FtOptions) {
        for (let i = 0; i < files.length; i++) {
            const path: string = files[i].filename;
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

    public doReset() {
        this.index = undefined;
    }

    public isScanned(): boolean {
        return this.index != undefined;
    }

    public getInfo(): string {
        if (this.index === undefined) {
            return "Run scan to select items or extract all";
        }
        let info: string = "";
        for (let i = 0; i < this.index.length; i++) {
            const entry = this.index[i];
            info += entry[0] + " : " + entry[2].length + " items\n";
        }
        return info;
    }

    public getList(): [string, Attachment][] {
        if (this.index === undefined) {
            return [];
        }
        const result: [string, Attachment][] = [];
        for (let i = 0; i < this.index.length; i++) {
            const entry = this.index[i];
            for (let j = 0; j < entry[2].length; j++) {
                result.push([entry[1], entry[2][j]]);
            }
        }
        return result;
    }
}
