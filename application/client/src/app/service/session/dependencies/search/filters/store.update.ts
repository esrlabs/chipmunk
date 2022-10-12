import { EntityUpdateEvent } from '../store.update';
import { FilterRequest } from './request';

export interface UpdateEventInner {
    filter: boolean;
    state: boolean;
    colors: boolean;
    stat: boolean;
}

export class UpdateEvent extends EntityUpdateEvent<UpdateEventInner, FilterRequest> {
    protected filter: FilterRequest;
    protected event: UpdateEventInner = {
        filter: false,
        state: false,
        colors: false,
        stat: false,
    };

    constructor(filter: FilterRequest) {
        super();
        this.filter = filter;
    }

    public on(): {
        filter(): UpdateEvent;
        state(): UpdateEvent;
        colors(): UpdateEvent;
        stat(): UpdateEvent;
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
            colors: (): UpdateEvent => {
                this.event.colors = true;
                return this;
            },
            stat: (): UpdateEvent => {
                this.event.stat = true;
                return this;
            },
        };
    }

    public changed(): boolean {
        return this.event.colors || this.event.filter || this.event.stat || this.event.state;
    }

    public consequence(): {
        highlights: boolean;
        value: boolean;
        inner: boolean;
    } {
        return {
            highlights: this.event.colors,
            value: this.event.state || this.event.filter,
            inner: this.event.colors || this.event.filter || this.event.stat || this.event.state,
        };
    }
    public inner(): UpdateEventInner {
        return this.event;
    }
    public entity(): FilterRequest {
        return this.filter;
    }
}
