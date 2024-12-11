export enum CommandOutcomeVoid {
    Finished,
    Cancelled,
}
import { SerialPortsList } from "./serial";
export interface CommandOutcomeSerialPortsList {
    Finished?: SerialPortsList;
    Cancelled?: null;
}
export interface CommandOutcomeString {
    Finished?: string;
    Cancelled?: null;
}
import { FoldersScanningResult } from "./folders";
export interface CommandOutcomeFoldersScanningResult {
    Finished?: FoldersScanningResult;
    Cancelled?: null;
}
export interface CommandOutcomeOptionalString {
    Finished?: string | null;
    Cancelled?: null;
}
export interface CommandOutcomei64 {
    Finished?: number;
    Cancelled?: null;
}
export interface CommandOutcomeBool {
    Finished?: boolean;
    Cancelled?: null;
}
