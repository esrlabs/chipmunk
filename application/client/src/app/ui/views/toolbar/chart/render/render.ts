import { IRange } from '@platform/types/range';
import { scheme_color_5 } from '@styles/colors';

export abstract class Base {
    protected context: CanvasRenderingContext2D;
    protected frame: IRange | undefined;
    protected rendering: {
        processing: boolean;
        recalled: boolean;
    } = {
        processing: false,
        recalled: false,
    };

    constructor(protected readonly canvasElementRef: HTMLCanvasElement) {
        const context: CanvasRenderingContext2D | null = canvasElementRef.getContext('2d');
        if (context === null) {
            throw new Error(`Fail to get access to canvas context`);
        }
        this.context = context;
    }

    protected size(): { width: number; height: number } {
        return {
            width: this.canvasElementRef.width,
            height: this.canvasElementRef.height,
        };
    }

    public setFrame(frame: IRange): Base {
        this.frame = frame;
        return this;
    }

    public clear(): Base {
        this.context.fillStyle = scheme_color_5;
        this.context.fillRect(0, 0, this.canvasElementRef.width, this.canvasElementRef.height);
        return this;
    }

    public refresh(): Base {
        if (this.rendering.processing) {
            this.rendering.recalled = true;
            return this;
        }
        this.rendering.processing = true;
        this.render();
        const recalled = this.rendering.recalled;
        this.rendering.processing = false;
        this.rendering.recalled = false;
        if (recalled) {
            this.refresh();
        }
        return this;
    }

    protected abstract render(): void;
}
