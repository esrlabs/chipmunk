import { IChunk, INeonNotification, ITicks } from "../util/progress";

export type ProgressEventHandler = (event: ITicks) => void;
export type ChunkHandler = (event: IChunk) => void;
export type NotificationHandler = (event: INeonNotification) => void;