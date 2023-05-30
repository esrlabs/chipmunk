import { EntityUpdateEvent } from '../store.update';
import { ChartRequest } from './request';

export interface UpdateEventInner {
    filter: boolean;
    state: boolean;
    color: boolean;
    line: boolean;
    point: boolean;
    stat: boolean;
    type: boolean;
}

export class UpdateEvent extends EntityUpdateEvent<UpdateEventInner, ChartRequest> {
    protected request: ChartRequest;
    protected event: UpdateEventInner = {
        filter: false,
        state: false,
        color: false,
        line: false,
        point: false,
        stat: false,
        type: false,
    };

    constructor(request: ChartRequest) {
        super();
        this.request = request;
    }

    public on(): {
        filter(): UpdateEvent;
        state(): UpdateEvent;
        color(): UpdateEvent;
        line(): UpdateEvent;
        point(): UpdateEvent;
        stat(): UpdateEvent;
        type(): UpdateEvent;
    } {
        return {
            filter: (): UpdateEvent => {
                this.event.filter = true;
                return this;
            },
            state: (): UpdateEvent => {
                this.event.state = true;
                return this;
            },
            color: (): UpdateEvent => {
                this.event.color = true;
                return this;
            },
            line: (): UpdateEvent => {
                this.event.line = true;
                return this;
            },
            point: (): UpdateEvent => {
                this.event.point = true;
                return this;
            },
            stat: (): UpdateEvent => {
                this.event.stat = true;
                return this;
            },
            type: (): UpdateEvent => {
                this.event.type = true;
                return this;
            },
        };
    }

    public changed(): boolean {
        return (
            this.event.line ||
            this.event.point ||
            this.event.color ||
            this.event.filter ||
            this.event.stat ||
            this.event.state
        );
    }

    public consequence(): {
        highlights: boolean;
        value: boolean;
        inner: boolean;
    } {
        return {
            highlights: this.event.line || this.event.point || this.event.color || this.event.type,
            value: this.event.state || this.event.filter,
            inner:
                this.event.line ||
                this.event.point ||
                this.event.color ||
                this.event.filter ||
                this.event.stat ||
                this.event.state ||
                this.event.type,
        };
    }
    public inner(): UpdateEventInner {
        return this.event;
    }
    public entity(): ChartRequest {
        return this.request;
    }
}
