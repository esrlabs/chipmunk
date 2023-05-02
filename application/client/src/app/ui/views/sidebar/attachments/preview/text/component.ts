import {
    Component,
    Input,
    AfterContentInit,
    ChangeDetectorRef,
    ChangeDetectionStrategy,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Attachment } from '@platform/types/content';
import { URLFileReader } from '@env/urlfilereader';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { unique } from '@platform/env/sequence';
import { Subject } from '@platform/env/subscription';

const MAX_LINES_COUNT = 1000;

@Component({
    selector: 'app-views-attachments-item-text-preview',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Ilc()
export class Preview extends ChangesDetector implements AfterContentInit {
    @Input() attachment!: Attachment;
    @Input() embedded!: boolean;
    @Input() updated!: Subject<void>;

    public lines: string[] = [];
    public uuid: string = unique();
    public reading: boolean = true;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.update();
        this.env().subscriber.register(
            this.ilc().services.system.hotkeys.listen('Ctrl + C', () => {
                this.copy(false);
            }),
            this.updated.subscribe(() => {
                this.update();
            }),
        );
    }

    public contextmenu(event: MouseEvent) {
        this.ilc().emitter.ui.contextmenu.open({
            items: [
                {
                    caption: 'Copy Into Clipboard',
                    handler: () => {
                        this.copy();
                    },
                },
            ],
            x: event.x,
            y: event.y,
        });
    }

    public copy(all = true): void {
        if (all) {
            navigator.clipboard.writeText(this.lines.join('\n'));
        } else {
            const active = document.activeElement;
            if (active === null) {
                return;
            }
            if (active.getAttribute('uuid') !== this.uuid) {
                return;
            }
            const selection = document.getSelection();
            if (selection === null) {
                return;
            }
            navigator.clipboard.writeText(
                selection
                    .toString()
                    .replace(/[\n\r]/gi, '\n')
                    .replace(/\n{2,}/gi, '\n'),
            );
        }
    }

    protected update() {
        this.reading = true;
        this.detectChanges();
        new URLFileReader(`attachment://${this.attachment.filepath}`)
            .read()
            .then((response) => {
                if (typeof response !== 'string') {
                    this.log().error(`Expecting to get a text for ${this.attachment.name}.`);
                    return;
                }
                this.lines = response.split(/[\n\r]/gi);
                if (this.lines.length > MAX_LINES_COUNT) {
                    const cutted = this.lines.length - MAX_LINES_COUNT;
                    this.lines.splice(MAX_LINES_COUNT, cutted);
                    this.lines.push(`... (more ${cutted} lines) ...`);
                }
            })
            .catch((err: Error) => {
                this.log().error(`Fail to get a text for ${this.attachment.name}: ${err.message}.`);
            })
            .finally(() => {
                this.reading = false;
                this.detectChanges();
            });
    }
}
export interface Preview extends IlcInterface {}
