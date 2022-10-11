import { IPosition } from '../../service';
import { stop } from '@ui/env/dom';
import { BasicState } from '../../abstract/basic';

enum EChangeKind {
    move = 'move',
    left = 'left',
    right = 'right',
    none = 'none',
}

const MIN_SIZE_WIDTH = 20;

export class State extends BasicState {
    public _ng_width: number = -1;
    public _ng_left: number = 0;
    public stop: (event: KeyboardEvent | MouseEvent) => boolean = stop;

    private _leftOffset = () => 0;
    private _width: number = -1;
    private _mouse: {
        x: number;
        kind: EChangeKind;
    } = {
        x: -1,
        kind: EChangeKind.none,
    };

    constructor() {
        super();
        this._onWindowMousemove = this._onWindowMousemove.bind(this);
        this._onWindowMouseup = this._onWindowMouseup.bind(this);
    }

    public init() {
        this._parent
            .env()
            .subscriber.register(
                this._parent.ilc().channel.ui.sidebar.resize(this._resize.bind(this)),
            );
        window.addEventListener('mousemove', this._onWindowMousemove);
        window.addEventListener('mouseup', this._onWindowMouseup);
        this._restore();
        this._resize();
    }

    public destroy() {
        window.removeEventListener('mousemove', this._onWindowMousemove);
        window.removeEventListener('mouseup', this._onWindowMouseup);
    }

    public onWheel(event: WheelEvent) {
        if (this._ng_width === -1 || this._width === -1) {
            return;
        }
        let width: number = this._ng_width;
        let left: number = 0;
        // Detect direction
        if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
            // Vertical scroll: zooming
            if (event.deltaY < 0) {
                // Zoom in
                if (width + event.deltaY < MIN_SIZE_WIDTH) {
                    width = MIN_SIZE_WIDTH;
                } else {
                    width += event.deltaY;
                }
            } else if (event.deltaY > 0) {
                // Zoom out
                if (width + event.deltaY > this._width) {
                    width = this._width;
                } else {
                    width += event.deltaY;
                }
            }
            left = this._ng_left - Math.round(event.deltaY / 2);
            if (left < 0) {
                left = 0;
            }
            if (left + width > this._width) {
                left = this._width - width;
            }
        } else {
            left = this._ng_left + event.deltaX;
            if (left < 0) {
                left = 0;
            }
            if (left + this._ng_width > this._width) {
                left = this._width - this._ng_width;
            }
        }
        this._ng_width = width;
        this._ng_left = left;
        this._emitChanges();
        this._parent.detectChanges();
        stop(event);
    }

    public onClick(event: MouseEvent) {
        if (this._ng_width === -1 || this._width === -1) {
            return;
        }
        let x: number = event.offsetX;
        if ((event.target as HTMLElement).className === 'cursor') {
            x += this._ng_left;
        }
        let left: number = x - Math.round(this._ng_width / 2);
        if (left < 0) {
            left = 0;
        }
        if (left + this._ng_width > this._width) {
            left = this._width - this._ng_width;
        }
        this._ng_left = left;
        this._emitChanges();
        this._parent.detectChanges();
    }

    public onMove(event: MouseEvent) {
        if (this._ng_width >= this._width) {
            return;
        }
        this._mouse.x = event.x;
        this._mouse.kind = EChangeKind.move;
    }

    public onLeft(event: MouseEvent) {
        this._mouse.x = event.x;
        this._mouse.kind = EChangeKind.left;
        stop(event);
    }

    public onRight(event: MouseEvent) {
        this._mouse.x = event.x;
        this._mouse.kind = EChangeKind.right;
        stop(event);
    }

    private _onWindowMousemove(event: MouseEvent) {
        if (this._mouse.x === -1) {
            return;
        }
        const offset: number = event.x - this._mouse.x;
        const left: number = this._ng_left - this._leftOffset();
        this._mouse.x = event.x;
        switch (this._mouse.kind) {
            case EChangeKind.move:
                if (left + offset < 0) {
                    this._ng_left = this._leftOffset();
                } else if (this._ng_width + left + offset > this._width) {
                    this._ng_left = this._width - this._ng_width + this._leftOffset();
                } else {
                    this._ng_left += offset;
                }
                break;
            case EChangeKind.left:
                if (left + offset < 0) {
                    this._ng_left = this._leftOffset();
                } else if (this._ng_width - offset < MIN_SIZE_WIDTH) {
                    //
                } else {
                    this._ng_left += offset;
                    this._ng_width -= offset;
                }
                break;
            case EChangeKind.right:
                if (this._ng_width + offset < MIN_SIZE_WIDTH) {
                    this._ng_width = MIN_SIZE_WIDTH;
                } else if (left + this._ng_width + offset > this._width) {
                    this._ng_width = this._width - left;
                } else {
                    this._ng_width += offset;
                }
                break;
        }
        this._emitChanges();
        this._parent.detectChanges();
    }

    private _onWindowMouseup(event: MouseEvent) {
        if (this._mouse.x === -1) {
            return;
        }
        this._mouse.x = -1;
        this._mouse.kind = EChangeKind.none;
        stop(event);
    }

    private _resize() {
        const scrollWidth: number = this._element.getBoundingClientRect().width;
        const width: number = scrollWidth - this._leftOffset();
        if (width <= 0 || isNaN(width) || !isFinite(width)) {
            return;
        }
        if (this._ng_width === -1) {
            this._ng_width = width;
            this._ng_left = 0;
        }
        if (this._width === width) {
            this._emitChanges();
            return;
        }
        if (this._width === -1) {
            this._width = Math.round(width);
        }
        if (this._ng_left < this._leftOffset()) {
            this._ng_left = this._leftOffset();
        }
        const change: number = this._width / width;
        // Get rate for current values
        const rate: number = this._ng_width / this._width;
        // Update width
        this._width = Math.round(width);
        // Calculate updated width of cursor
        if (rate <= 1) {
            this._ng_width = width * rate;
        } else {
            this._ng_width = width;
        }
        this._ng_left = (this._ng_left - this._leftOffset()) / change + this._leftOffset();
        this._emitChanges();
        this._parent.detectChanges();
    }

    private _emitChanges() {
        // Always round values, because it will go to service.data. Based on pixels will be calculated range of rows
        // only 1 px offset can make more than 100 rows offset in range. It will change scale.
        this._ng_width = Math.round(this._ng_width);
        this._ng_left = Math.round(this._ng_left);
        this._service.setPosition({
            session: this._session.uuid(),
            position: {
                left: this._ng_left,
                width: this._ng_width,
                full: this._width,
            },
        });
    }

    private _restore() {
        const position: IPosition | undefined = this._service.correction(
            this._session.uuid(),
            this._element.getBoundingClientRect().width,
        );
        if (position === undefined) {
            return;
        }
        this._ng_left = position.left;
        this._ng_width = position.width;
        this._parent.detectChanges();
    }
}
