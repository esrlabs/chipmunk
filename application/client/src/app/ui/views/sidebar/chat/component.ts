import { Component, Input, ChangeDetectorRef, AfterContentInit, HostListener } from '@angular/core';
import { Session } from '@service/session';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';

interface Message {
    //TODO: Is a message ID needed?
    // id: number;
    sender: string;
    text: string;
    timestamp: Date;
    type: 'prompt' | 'response' | 'system';
    pending: boolean; // Shows pending animation while waiting for response
}

// TODO: Chat config
interface ChatConfig {
    enabled: boolean;
    apiKey: string;
    model: string;
}

@Component({
    selector: 'app-views-chat',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Initial()
@Ilc()
export class Chat extends ChangesDetector implements AfterContentInit {
    // Session from parent component
    @Input() session!: Session;

    // Configuration storing chat related settings
    public config: ChatConfig = {
        enabled: false,
        apiKey: '',
        model: '',
    };

    // Messages being displayed.
    //TODO: Should this be stored in the backend?
    public messages: Message[] = [];

    // Content of the user's input box
    public userInput: string = '';

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        // TODO: persistance / storing state
        this.detectChanges();
    }

    // Toggle chat on/off from the actions menu
    public onToggleChat(): void {
        this.config.enabled = !this.config.enabled;

        // Show welcome message when chat is enabled for the first time
        if (this.config.enabled && this.messages.length === 0) {
            this.printMessage('AI Assistant', 'Hello! How can I help you today?', 'response');
        }
        this.detectChanges();
    }

    // Clear all chat history
    public onClearHistory(): void {
        this.messages = [];
        this.detectChanges();
    }

    // Open chat configuration dialog
    public onConfigureChat(): void {
        // TODO: Open configuration dialog
    }

    private printMessage(sender: string, text: string, type: Message['type'], pending: boolean = false): Message {
        const message: Message = {
            sender,
            text,
            timestamp: new Date(),
            type,
            pending,
        };
        this.messages.push(message);
        this.detectChanges();
        return message;
    }

    // Handles user input from the chat's user input box
    public onUserInput(): void {
        // Do nothing when chat feature is disabled
        if (!this.config.enabled) return;

        // TODO: Sanitation probably already happens in the backend?
        const input = this.userInput.trim();
        if (!input) return;

        // Instantly print user input without any checks.
        this.printMessage('You', input, 'prompt');

        // Clear input field
        this.userInput = '';

        // TODO: Send to MCPClient (via IPC?)

        // Show pending indicator while waiting for response
        this.printMessage('AI Assistant', '', 'response', true);

        //TODO: remove Simulated response with random delay (1-5 seconds)
        const delayMs = Math.random() * 8000;
        this.simulateResponse(delayMs);
    }

    // 
    public simulateResponse(delay_ms: number): void {
        setTimeout(() => {
            // Remove pending message and add actual response
            if (this.messages.length > 0 && this.messages[this.messages.length - 1].pending) {
                this.messages.pop();
            }
            this.onRemoteMessage('AI assistant', 'This is a simulated AI assistant response');
        }, delay_ms);
    }

    //TODO: Handle messages received from the MCPClient (via IPC?)
    public onRemoteMessage(sender: string, text: string): void {
        this.printMessage(sender, text, 'response');
    }

    public onKeyPress(event: KeyboardEvent): void {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.onUserInput();
        }
    }

    public autoResizeInputArea(textarea: HTMLTextAreaElement): void {
        const defaultHeight = 32; //TODO: match what we set in style

        // Temporarily reset to auto to measure actual content height
        textarea.style.height = 'auto';

        // Calculate content height
        const newHeight = Math.max(textarea.scrollHeight, defaultHeight);
        textarea.style.height = newHeight + 'px';
    }

    public focusInputArea(textarea: HTMLTextAreaElement): void {
    if (textarea) {
        textarea.focus();
    }
}
}

// Export the component class as implementing the IlcInterface so other
// parts of the application can access the decorated instance methods
export interface Chat extends IlcInterface {}
