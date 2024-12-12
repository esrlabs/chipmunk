import { SerialPortsList } from "./serial";
export type CommandOutcomeSerialPortsList =
    { Finished: SerialPortsList } |
    "Cancelled";
export enum CommandOutcomeVoid {
    Finished,
    Cancelled,
}
export type CommandOutcomei64 =
    { Finished: number } |
    "Cancelled";
import { FoldersScanningResult } from "./folders";
export type CommandOutcomeFoldersScanningResult =
    { Finished: FoldersScanningResult } |
    "Cancelled";
export type CommandOutcomeOptionalString =
    { Finished: string | null } |
    "Cancelled";
export type CommandOutcomeBool =
    { Finished: boolean } |
    "Cancelled";
export type CommandOutcomeString =
    { Finished: string } |
    "Cancelled";
