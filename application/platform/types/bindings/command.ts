// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.

/**
 * Represents the result of a command execution.
 * At the core level, this type is used for all commands invoked within an `UnboundSession`.
 * It is only used to indicate the successful completion or interruption of a command.
 */
export type CommandOutcomeBool = { Finished: boolean } | 'Cancelled';

/**
 * Represents the result of a command execution.
 * At the core level, this type is used for all commands invoked within an `UnboundSession`.
 * It is only used to indicate the successful completion or interruption of a command.
 */
export type CommandOutcomeFoldersScanningResult = { Finished: FoldersScanningResult } | 'Cancelled';

/**
 * Represents the result of a command execution.
 * At the core level, this type is used for all commands invoked within an `UnboundSession`.
 * It is only used to indicate the successful completion or interruption of a command.
 */
export type CommandOutcomeOptionalString = { Finished: string | null } | 'Cancelled';

/**
 * Represents the result of a command execution.
 * At the core level, this type is used for all commands invoked within an `UnboundSession`.
 * It is only used to indicate the successful completion or interruption of a command.
 */
export type CommandOutcomeSerialPortsList = { Finished: SerialPortsList } | 'Cancelled';

/**
 * Represents the result of a command execution.
 * At the core level, this type is used for all commands invoked within an `UnboundSession`.
 * It is only used to indicate the successful completion or interruption of a command.
 */
export type CommandOutcomeString = { Finished: string } | 'Cancelled';

/**
 * Represents the result of a command execution.
 * At the core level, this type is used for all commands invoked within an `UnboundSession`.
 * It is only used to indicate the successful completion or interruption of a command.
 */
export type CommandOutcomeVoid = 'Finished' | 'Cancelled';

/**
 * Represents the result of a command execution.
 * At the core level, this type is used for all commands invoked within an `UnboundSession`.
 * It is only used to indicate the successful completion or interruption of a command.
 */
export type CommandOutcomei64 = { Finished: number } | 'Cancelled';

/**
 * Represents a folder entity in the file system.
 */
export type FolderEntity = {
    /**
     * The name of the entity (file or folder).
     */
    name: string;
    /**
     * The full path of the entity.
     */
    fullname: string;
    /**
     * The type of the entity (e.g., file, directory, symbolic link).
     */
    kind: FolderEntityType;
    /**
     * Optional detailed information about the entity.
     */
    details: FolderEntityDetails | null;
};

/**
 * Contains detailed information about a folder entity.
 */
export type FolderEntityDetails = {
    /**
     * The name of the file or folder.
     */
    filename: string;
    /**
     * The full path to the file or folder.
     */
    full: string;
    /**
     * The directory path containing the file or folder.
     */
    path: string;
    /**
     * The base name of the file or folder.
     */
    basename: string;
    /**
     * The file extension, if applicable.
     */
    ext: string;
};

/**
 * Represents the type of a folder entity in the file system.
 */
export enum FolderEntityType {
    BlockDevice = 'BlockDevice',
    CharacterDevice = 'CharacterDevice',
    Directory = 'Directory',
    FIFO = 'FIFO',
    File = 'File',
    Socket = 'Socket',
    SymbolicLink = 'SymbolicLink',
}

/**
 * Represents the result of scanning a folder.
 */
export type FoldersScanningResult = {
    /**
     * A list of folder entities found during the scan.
     */
    list: Array<FolderEntity>;
    /**
     * Indicates whether the maximum length of results was reached.
     */
    max_len_reached: boolean;
};

/**
 * Represents a list of serial ports.
 *
 * This structure contains a vector of strings, where each string represents the name
 * or identifier of a serial port available on the system.
 */
export type SerialPortsList = Array<string>;