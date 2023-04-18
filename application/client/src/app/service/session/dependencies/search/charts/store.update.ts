import { EntityUpdateEvent } from '../store.update';
import { ChartRequest } from './request';

export interface UpdateEventInner {
    filter: boolean;
    state: boolean;
    color: boolean;
    stat: boolean;
    stepped: boolean;
    tension: boolean;
    borderWidth: boolean;
    pointRadius: boolean;
}

export class UpdateEvent extends EntityUpdateEvent<UpdateEventInner, ChartRequest> {
    protected request: ChartRequest;
    protected event: UpdateEventInner = {
        filter: false,
        state: false,
        color: false,
        stat: false,
        stepped: false,
        tension: false,
        borderWidth: false,
        pointRadius: false,
    };

    constructor(request: ChartRequest) {
        super();
        this.request = request;
    }

    public on(): {
        filter(): UpdateEvent;
        state(): UpdateEvent;
        color(): UpdateEvent;
        stat(): UpdateEvent;
        stepped(): UpdateEvent;
        tension(): UpdateEvent;
        borderWidth(): UpdateEvent;
        pointRadius(): UpdateEvent;
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
            stat: (): UpdateEvent => {
                this.event.stat = true;
                return this;
            },
            stepped: (): UpdateEvent => {
                this.event.stepped = true;
                return this;
            },
            tension: (): UpdateEvent => {
                this.event.tension = true;
                return this;
            },
            borderWidth: (): UpdateEvent => {
                this.event.borderWidth = true;
                return this;
            },
            pointRadius: (): UpdateEvent => {
                this.event.pointRadius = true;
                return this;
            },
        };
    }

    public changed(): boolean {
        return (
            this.event.color ||
            this.event.filter ||
            this.event.stat ||
            this.event.state ||
            this.event.stepped ||
            this.event.tension ||
            this.event.borderWidth ||
            this.event.pointRadius
        );
    }

    public consequence(): {
        highlights: boolean;
        value: boolean;
        inner: boolean;
    } {
        return {
            highlights: this.event.color,
            value:
                this.event.state ||
                this.event.filter ||
                this.event.stepped ||
                this.event.tension ||
                this.event.borderWidth ||
                this.event.pointRadius,
            inner: this.event.color || this.event.filter || this.event.stat || this.event.state,
        };
    }
    public inner(): UpdateEventInner {
        return this.event;
    }
    public entity(): ChartRequest {
        return this.request;
    }
}
