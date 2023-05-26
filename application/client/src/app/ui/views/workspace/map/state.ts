import { ISearchMap } from '@platform/interfaces/interface.rust.api.general';
import { Session } from '@service/session';
import { scheme_color_5, scheme_color_match, scheme_color_2 } from '@styles/colors';

export class State {
    static COLUMN_WIDTH = 4;

    public width: number = 0;
    public height: number = 0;

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
        this.context.fillStyle = scheme_color_5;
        this.context.fillRect(0, 0, this.width, this.height);
        const scale = (() => {
            if (this.map.length === 0 || this.height === 0) {
                return 1;
            } else if (this.map.length < this.height) {
                return this.height / this.map.length;
            } else {
                return 1;
            }
        })();
        const indexes: { [key: number]: number } = {};
        if (isActive) {
            this.width = State.COLUMN_WIDTH;
        } else {
            let index = 0;
            this.map.forEach((value: number[][]) => {
                value.forEach((matches) => {
                    if (indexes[matches[0]] === undefined) {
                        indexes[matches[0]] = index;
                        index += 1;
                    }
                });
            });
            this.width = Object.keys(indexes).length * State.COLUMN_WIDTH;
        }
        this.context.fillRect(0, 0, this.width, this.height);
        this.detectChanges();
        this.map.forEach((value: number[][], top: number) => {
            value.forEach((matches) => {
                if (isActive) {
                    this.context.fillStyle = scheme_color_2;
                } else {
                    const filter = filters[matches[0]];
                    this.context.fillStyle =
                        filter === undefined
                            ? scheme_color_match
                            : filter.definition.colors.background;
                }
                this.context.fillRect(
                    isActive ? 0 : indexes[matches[0]] * State.COLUMN_WIDTH,
                    top * scale,
                    State.COLUMN_WIDTH,
                    scale,
                );
            });
        });
        return this;
    }
}
