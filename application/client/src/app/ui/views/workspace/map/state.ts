import { ISearchMap } from '@platform/interfaces/interface.rust.api.general';
import { Session } from '@service/session';

export class State {
    static COLUMN_WIDTH = 4;

    public width: number = 12;
    public height: number = 100;

    protected session!: Session;
    protected holderElementRef!: HTMLElement;
    protected canvasElementRef!: HTMLCanvasElement;
    protected context!: CanvasRenderingContext2D;
    protected map: ISearchMap = [];
    protected detectChanges!: () => void;

    public init(
        session: Session,
        holderElementRef: HTMLElement,
        canvasElementRef: HTMLCanvasElement,
        detectChanges: () => void,
    ) {
        this.session = session;
        this.holderElementRef = holderElementRef;
        this.canvasElementRef = canvasElementRef;
        const context: CanvasRenderingContext2D | null = this.canvasElementRef.getContext('2d');
        if (context === null) {
            throw new Error(`Fail to get access to canvas context`);
        }
        this.context = context;
        this.detectChanges = detectChanges;
        this.resize().update();
    }

    public update(): State {
        if (this.height === 0) {
            return this;
        }
        this.session.search
            .getScaledMap(this.height)
            .then((map) => {
                this.map = map;
                this.draw();
            })
            .catch((err: Error) => {
                console.log(err);
            });
        return this;
    }

    public resize(): State {
        this.detectChanges();
        const size = this.holderElementRef.getBoundingClientRect();
        this.height = size.height;
        return this;
    }

    public draw(): State {
        const filters = this.session.search
            .store()
            .filters()
            .get()
            .filter((f) => f.definition.active);
        const isActive = this.session.search.state().getActive() !== undefined;
        const count = isActive ? 1 : filters.length;
        this.context.fillStyle = 'rgb(0,0,0)';
        this.context.fillRect(0, 0, this.width, this.height);
        this.width = count * State.COLUMN_WIDTH;
        this.detectChanges();
        const scale = (() => {
            if (this.map.length === 0 || this.height === 0) {
                return 1;
            } else if (this.map.length < this.height) {
                return this.height / this.map.length;
            } else {
                return 1;
            }
        })();
        this.map.forEach((value: number[][], top: number) => {
            value.forEach((matches) => {
                if (isActive) {
                    this.context.fillStyle = 'rgb(255,0,0)';
                } else {
                    const filter = filters[matches[0]];
                    this.context.fillStyle =
                        filter === undefined ? 'rgb(255,0,0)' : filter.definition.colors.background;
                }
                this.context.fillRect(
                    matches[0] * State.COLUMN_WIDTH,
                    top * scale,
                    State.COLUMN_WIDTH,
                    scale,
                );
            });
        });
        return this;
    }
}
