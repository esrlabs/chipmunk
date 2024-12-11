import { Ticks } from "./progress";
export interface LifecycleTransition {
    Started?: [string, string];
    Ticks?: [string, Ticks];
    Stopped?: string;
}
