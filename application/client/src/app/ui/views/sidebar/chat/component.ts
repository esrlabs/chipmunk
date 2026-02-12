import { Component, Input, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Session } from '@service/session';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';

interface ChatMessage {
    id: number;
    text: string;
    time: string;
}

@Component({
    selector: 'app-views-chat',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false,
})
@Initial()
@Ilc()
export class Chat extends ChangesDetector {
    @Input() session: Session | undefined;

    public draft = '';
    public messages: ChatMessage[] = [];

    private _nextId = 1;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngOnSend(): void {
        const text = this.draft.trim();
        if (text.length === 0) {
            return;
        }
        if (this.session !== undefined) {
            this.session.sendMcpPrompt(text).catch((err: Error) => {
                console.error(`Failed to send MCP prompt: ${err.message}`);
            });
        }
        this.messages = this.messages.concat({
            id: this._nextId++,
            text,
            time: new Date().toLocaleTimeString(),
        });
        this.draft = '';
        this.detectChanges();
    }

    public ngOnClear(): void {
        this.messages = [];
        this.detectChanges();
    }

    public ngOnKeydown(event: KeyboardEvent): void {
        if (event.key !== 'Enter' || event.shiftKey) {
            return;
        }
        event.preventDefault();
        this.ngOnSend();
    }
}
export interface Chat extends IlcInterface {}
