type TResolver = () => void;

export class ControllerToolbarLifecircle {
    private readonly TIMEOUT: number = 250;

    private _guid: string;
    private _timeouts: {
        viewready: any;
    } = {
        viewready: -1,
    };
    private _pendings: {
        viewready: TResolver[];
    } = {
        viewready: [],
    };

    constructor(guid: string) {
        this._guid = guid;
    }

    public destroy() {
        Object.keys(this._timeouts).forEach((key: string) => {
            clearTimeout((this._timeouts as any)[key]);
        });
    }

    public callOn(): {
        viewready: (resolver: TResolver) => void;
    } {
        const self = this;
        return {
            viewready: (resolver: TResolver) => {
                self._pendings.viewready.push(resolver);
                self._timeouts.viewready = setTimeout(() => {
                    self.emit().viewready();
                }, self.TIMEOUT);
            },
        };
    }

    public emit(): {
        viewready: () => void;
    } {
        const self = this;
        return {
            viewready: () => {
                clearTimeout(self._timeouts.viewready);
                const pendings = self._pendings.viewready.slice();
                this._pendings.viewready = [];
                pendings.forEach((cb: TResolver) => cb());
            },
        };
    }
}
