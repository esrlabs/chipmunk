import { Frame, ChangesInitiator } from './frame';
export class Keyboard {
    static START_REPEAT_DURATION_MS = 400;
    static MIN_REPEAT_DURATION_MS = 200;
    static STEP_REPEAT_DURATION = 0.05;

    protected focused: boolean = false;
    protected frame!: Frame;

    private _repeating: number | undefined;
    private _duration: number = 0;

    public bind(frame: Frame) {
        this.frame = frame;
    }

    public process(event: KeyboardEvent) {
        this._duration = Keyboard.START_REPEAT_DURATION_MS;
        this._process(event.code);
    }

    public stop() {
        clearTimeout(this._repeating);
    }

    public focus() {
        this.focused = true;
    }

    public blur() {
        this.focused = false;
    }

    private _process(code: string) {
        if (!this.focused) {
            return;
        }
        switch (code) {
            case 'ArrowUp':
                this.frame.move(ChangesInitiator.Keyboard).up();
                break;
            case 'ArrowDown':
                this.frame.move(ChangesInitiator.Keyboard).down();
                break;
            case 'PageDown':
                this.frame.move(ChangesInitiator.Keyboard).pgdown();
                break;
            case 'PageUp':
                this.frame.move(ChangesInitiator.Keyboard).pgup();
                break;
        }
        if (this._duration > Keyboard.MIN_REPEAT_DURATION_MS) {
            this._duration = this._duration - this._duration * Keyboard.STEP_REPEAT_DURATION;
        }
        if (this._duration <= Keyboard.MIN_REPEAT_DURATION_MS) {
            this._duration = Keyboard.MIN_REPEAT_DURATION_MS;
        }
        clearTimeout(this._repeating);
        this._repeating = setTimeout(
            this._process.bind(this, code),
            this._duration,
        ) as unknown as number;
    }
}
