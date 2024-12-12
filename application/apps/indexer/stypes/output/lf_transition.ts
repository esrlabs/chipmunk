import { Ticks } from "./progress";
export type LifecycleTransition =
    {
        Started: {
            uuid: string;
            alias: string
        }
    } |
    {
        Ticks: {
            uuid: string;
            ticks: Ticks
        }
    } |
    { Stopped: string };
