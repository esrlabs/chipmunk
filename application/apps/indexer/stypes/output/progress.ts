export type Progress =
    { Ticks: Ticks } |
    { Notification: Notification } |
    "Stopped";
import { Severity } from "./error";
export interface Notification {
    severity: Severity;
    content: string;
    line: number | null;
}
export interface Ticks {
    count: number;
    state: string | null;
    total: number | null;
}
