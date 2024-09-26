export interface TransitionOneof {
    Started?: Started;
    Ticks?: TicksWithUuid;
    Stopped?: Stopped;
}
export interface Stopped {
    uuid: string;
}
export interface Started {
    uuid: string;
    alias: string;
}
export interface Ticks {
    count: number;
    state: string;
    total: number;
}
export interface TicksWithUuid {
    uuid: string;
    ticks: Ticks | null;
}
export interface LifecycleTransition {
    transition_oneof: TransitionOneof | null;
}
