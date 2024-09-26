export interface Started {
    uuid: string;
    alias: string;
}
export interface TransitionOneof {
    Started?: Started;
    Ticks?: TicksWithUuid;
    Stopped?: Stopped;
}
export interface Ticks {
    count: number;
    state: string;
    total: number;
}
export interface LifecycleTransition {
    transition_oneof: TransitionOneof | null;
}
export interface TicksWithUuid {
    uuid: string;
    ticks: Ticks | null;
}
export interface Stopped {
    uuid: string;
}
