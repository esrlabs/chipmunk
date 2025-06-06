import * as Parser from './parser';
import * as Stream from './origin/stream/index';
import * as Origin from './origin/index';
import * as File from './types/file';

export const Streams: {
    [key: string]: Stream.Reference[];
} = {
    [Parser.Protocol.Dlt]: [
        // Supported streams
        Stream.TCP.Configuration,
        Stream.UDP.Configuration,
    ],
    [Parser.Protocol.SomeIp]: [
        // Supported streams
        Stream.UDP.Configuration,
    ],
    [Parser.Protocol.Text]: [
        // Supported streams
        Stream.Serial.Configuration,
        Stream.Process.Configuration,
    ],
    // Make sure we support all kinds of stream
    [Parser.Protocol.Plugin]: [
        Stream.TCP.Configuration,
        Stream.UDP.Configuration,
        Stream.Serial.Configuration,
        Stream.Process.Configuration,
    ],
};

export const Files: {
    [key: string]: File.FileType[];
} = {
    [Parser.Protocol.Dlt]: [
        // Supported file types
        File.FileType.Binary,
        File.FileType.PcapNG,
        File.FileType.PcapLegacy,
    ],
    [Parser.Protocol.SomeIp]: [
        // Supported file types
        File.FileType.PcapNG,
        File.FileType.PcapLegacy,
    ],
    [Parser.Protocol.Text]: [
        // Supported file types
        File.FileType.Text,
    ],
    // Plugins support all file types.
    [Parser.Protocol.Plugin]: [
        File.FileType.Text,
        File.FileType.Binary,
        File.FileType.PcapNG,
        File.FileType.PcapLegacy,
        File.FileType.ParserPlugin,
    ],
};

export const SDESupport: {
    [key: string]: boolean;
} = {
    [Origin.Context.File]: false,
    [Origin.Context.Concat]: false,
    [Origin.Context.Plugin]: false,
    [Stream.Source.Process]: true,
    [Stream.Source.Serial]: true,
    [Stream.Source.TCP]: false,
    [Stream.Source.UDP]: false,
};

export const Configurable: {
    [key: string]:
        | {
              [key: string]: boolean;
          }
        | boolean;
} = {
    [Origin.Context.File]: {
        [Parser.Protocol.Text]: false,
        [Parser.Protocol.Dlt]: true,
        [Parser.Protocol.SomeIp]: true,
        [Parser.Protocol.Plugin]: true,
    },
    [Origin.Context.Concat]: true,
    [Origin.Context.Plugin]: true,
    [Stream.Source.Process]: true,
    [Stream.Source.Serial]: true,
    [Stream.Source.TCP]: true,
    [Stream.Source.UDP]: true,
};
