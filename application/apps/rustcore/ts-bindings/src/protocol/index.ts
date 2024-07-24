/* eslint-disable @typescript-eslint/no-unused-vars */

import { IObserve, Observe } from 'platform/types/observe';
import { Attachment, IGrabbedElement } from 'platform/types/content';
import { getValidNum } from '../util/numbers';
import { IRange } from 'platform/types/range';

import { Aborted } from './Aborted';
import { DltFilterConfig } from './DltFilterConfig';
import { IndexedMapUpdated } from './IndexedMapUpdated';
import { Notification } from './Notification';
import { ProgressDetail } from './ProgressDetail';
import { SearchUpdated } from './SearchUpdated';
import { TicksWithUuid } from './TicksWithUuid';
import { AttachmentInfoList } from './AttachmentInfoList';
import { DltParserSettings } from './DltParserSettings';
import { NotInitialize } from './NotInitialize';
import { Progress } from './Progress';
import { SearchValuesUpdated } from './SearchValuesUpdated';
import { Transition } from './Transition';
import { AttachmentInfo } from './AttachmentInfo';
import { Empty } from './Empty';
import { Input } from './Input';
import { ObserveOptions } from './ObserveOptions';
import { Protocol } from './Protocol';
import { SerialTransportConfig } from './SerialTransportConfig';
import { Transport } from './Transport';
import { AttachmentsUpdated } from './AttachmentsUpdated';
import { Error } from './Error';
import { Interrupted } from './Interrupted';
import { ObserveOrigin } from './ObserveOrigin';
import { RangeInclusiveList } from './RangeInclusiveList';
import { SessionCreatingFail } from './SessionCreatingFail';
import { Type } from './Type';
import { CallbackEvent } from './CallbackEvent';
import { Event } from './Event';
import { InvalidArgs } from './InvalidArgs';
import { OperationDone } from './OperationDone';
import { RangeInclusive } from './RangeInclusive';
import { SessionUnavailable } from './SessionUnavailable';
import { UdpTransportConfig } from './UdpTransportConfig';
import { Cancelled } from './Cancelled';
import { FileFormat } from './FileFormat';
import { InvalidData } from './InvalidData';
import { OperationError } from './OperationError';
import { Range } from './Range';
import { Severity } from './Severity';
import { Unsupported } from './Unsupported';
import { CommandOutcome } from './CommandOutcome';
import { File } from './File';
import { InvalidRange } from './InvalidRange';
import { OperationNotSupported } from './OperationNotSupported';
import { Regex } from './Regex';
import { SomeIpParserSettings } from './SomeIpParserSettings';
import { ValueRange } from './ValueRange';
import { Communication } from './Communication';
import { Finished } from './Finished';
import { IoOperation } from './IoOperation';
import { Origin } from './Origin';
import { Request } from './Request';
import { Started } from './Started';
import { ComputationError } from './ComputationError';
import { GrabbedElementList } from './GrabbedElementList';
import { LifecycleTransition } from './LifecycleTransition';
import { Outcome } from './Outcome';
import { SdeRequest } from './SdeRequest';
import { Stopped } from './Stopped';
import { Concat } from './Concat';
import { GrabbedElement } from './GrabbedElement';
import { MulticastInfo } from './MulticastInfo';
import { Output } from './Output';
import { SdeResponse } from './SdeResponse';
import { Stream } from './Stream';
import { Config } from './Config';
import { Grabbing } from './Grabbing';
import { MultipleInitCall } from './MultipleInitCall';
import { ParserType } from './ParserType';
import { Sde } from './Sde';
import { StringVec } from './StringVec';
import { DestinationPath } from './DestinationPath';
import { GrabError } from './GrabError';
import { NativeErrorKind } from './NativeErrorKind';
import { ProcessTransportConfig } from './ProcessTransportConfig';
import { SearchError } from './SearchError';
import { TcpTransportConfig } from './TcpTransportConfig';
import { Detail } from './Detail';
import { Grab } from './Grab';
import { NativeError } from './NativeError';
import { Process } from './Process';
import { SearchMapUpdated } from './SearchMapUpdated';
import { Ticks } from './Ticks';

import * as proto from 'protocol';
import * as $ from 'platform/types/observe';
import * as sde from 'platform/types/sde';

export function decodeIRanges(buf: number[]): IRange[] {
    const list: RangeInclusiveList = proto.RangeInclusiveList.decode(Uint8Array.from(buf));
    return list.elements.map((el: RangeInclusive) => {
        return {
            from: Number(el.start),
            to: Number(el.end),
        };
    });
}
export function toObserveOptions(source: IObserve): ObserveOptions {
    const ob = new Observe(source);
    const file = ob.origin.as<$.Origin.File.Configuration>($.Origin.File.Configuration);
    const stream = ob.origin.as<$.Origin.Stream.Configuration>($.Origin.Stream.Configuration);
    const concat = ob.origin.as<$.Origin.Concat.Configuration>($.Origin.Concat.Configuration);
    const ft = (ft: $.Types.File.FileType) => {
        switch (ft) {
            case $.Types.File.FileType.Text:
                return 2;
            case $.Types.File.FileType.Binary:
                return 3;
            case $.Types.File.FileType.PcapNG:
                return 0;
            case $.Types.File.FileType.PcapLegacy:
                return 1;
        }
    };
    const origin: Origin = ((): Origin => {
        if (file !== undefined) {
            return {
                File: {
                    name: file.configuration[0],
                    format: ft(file.configuration[1]),
                    path: file.configuration[2],
                },
            };
        } else if (concat !== undefined) {
            return {
                Concat: {
                    files: concat.configuration.map((file) => {
                        return {
                            name: file[0],
                            format: ft(file[1]),
                            path: file[2],
                        };
                    }),
                },
            };
        } else if (stream !== undefined) {
            const processOrigin = stream.as<$.Origin.Stream.Stream.Process.Configuration>(
                $.Origin.Stream.Stream.Process.Configuration,
            );
            const serialOrigin = stream.as<$.Origin.Stream.Stream.Serial.Configuration>(
                $.Origin.Stream.Stream.Serial.Configuration,
            );
            const tcpOrigin = stream.as<$.Origin.Stream.Stream.TCP.Configuration>(
                $.Origin.Stream.Stream.TCP.Configuration,
            );
            const udpOrigin = stream.as<$.Origin.Stream.Stream.UDP.Configuration>(
                $.Origin.Stream.Stream.UDP.Configuration,
            );
            return {
                Stream: {
                    name: stream.configuration[0],
                    transport: {
                        transport: ((): Transport => {
                            if (processOrigin !== undefined) {
                                const envs: Map<string, string> = new Map();
                                Object.keys(processOrigin.configuration.envs).forEach(
                                    (key: string) => {
                                        if (
                                            ['string', 'number', 'boolean'].includes(
                                                typeof processOrigin.configuration.envs[key],
                                            )
                                        ) {
                                            envs.set(
                                                key,
                                                processOrigin.configuration.envs[key].toString(),
                                            );
                                        }
                                    },
                                );
                                return {
                                    Process: {
                                        cwd: processOrigin.configuration.cwd,
                                        command: processOrigin.configuration.command,
                                        envs,
                                    },
                                };
                            } else if (serialOrigin !== undefined) {
                                return {
                                    Serial: {
                                        send_data_delay: serialOrigin.configuration.send_data_delay,
                                        baud_rate: serialOrigin.configuration.baud_rate,
                                        data_bits: serialOrigin.configuration.data_bits,
                                        exclusive: serialOrigin.configuration.exclusive,
                                        flow_control: serialOrigin.configuration.flow_control,
                                        parity: serialOrigin.configuration.parity,
                                        path: serialOrigin.configuration.path,
                                        stop_bits: serialOrigin.configuration.stop_bits,
                                    },
                                };
                            } else if (tcpOrigin !== undefined) {
                                return {
                                    Tcp: {
                                        bind_addr: tcpOrigin.configuration.bind_addr,
                                    },
                                };
                            } else if (udpOrigin !== undefined) {
                                return {
                                    Udp: {
                                        bind_addr: udpOrigin.configuration.bind_addr,
                                        multicast: udpOrigin.configuration.multicast.map((ma) => {
                                            return {
                                                multiaddr: ma.multiaddr,
                                                interface:
                                                    ma.interface === undefined ? '' : ma.interface,
                                            };
                                        }),
                                    },
                                };
                            } else {
                                throw new Error(`Unknown transport`);
                            }
                        })(),
                    },
                },
            };
        } else {
            throw new Error(`Unknown origin`);
        }
    })();
    const text = ob.parser.as<$.Parser.Text.Configuration>($.Parser.Text.Configuration);
    const dlt = ob.parser.as<$.Parser.Dlt.Configuration>($.Parser.Dlt.Configuration);
    const someip = ob.parser.as<$.Parser.SomeIp.Configuration>($.Parser.SomeIp.Configuration);
    const parser: ParserType = ((): ParserType => {
        if (text !== undefined) {
            return {
                type: {
                    Text: true,
                },
            };
        } else if (dlt !== undefined) {
            const filter_config = dlt.configuration.filter_config;
            return {
                type: {
                    Dlt: {
                        fibex_file_paths:
                            dlt.configuration.fibex_file_paths === undefined
                                ? []
                                : dlt.configuration.fibex_file_paths,
                        tz: dlt.configuration.tz === undefined ? '' : dlt.configuration.tz,
                        with_storage_header: dlt.configuration.with_storage_header,
                        filter_config:
                            filter_config === undefined
                                ? null
                                : {
                                      min_log_level: filter_config.min_log_level as number,
                                      app_id_count: BigInt(filter_config.app_id_count),
                                      app_ids:
                                          filter_config.app_ids === undefined
                                              ? []
                                              : filter_config.app_ids,
                                      ecu_ids:
                                          filter_config.ecu_ids === undefined
                                              ? []
                                              : filter_config.ecu_ids,
                                      context_id_count: BigInt(filter_config.context_id_count),
                                      context_ids:
                                          filter_config.context_ids === undefined
                                              ? []
                                              : filter_config.context_ids,
                                  },
                    },
                },
            };
        } else if (someip !== undefined) {
            return {
                type: {
                    SomeIp: {
                        fibex_file_paths:
                            someip.configuration.fibex_file_paths === undefined
                                ? []
                                : someip.configuration.fibex_file_paths,
                    },
                },
            };
        } else {
            throw new Error(`Not supported parser`);
        }
    })();
    return { origin: { origin }, parser };
}

export function decodeCallbackEvent(buf: number[]): any {
    const event: CallbackEvent = proto.CallbackEvent.decode(Uint8Array.from(buf));
    if (!event.event) {
        return {};
    }
    const inner: Event = event.event;
    if ('SessionDestroyed' in inner) {
        return { SessionDestroyed: null };
    } else if ('FileRead' in inner) {
        return { FileRead: null };
    } else if ('AttachmentsUpdated' in inner) {
        const attachment = inner.AttachmentsUpdated.attachment;
        return {
            AttachmentsUpdated: {
                len: inner.AttachmentsUpdated.len,
                attachment:
                    attachment === null
                        ? null
                        : {
                              uuid: attachment.uuid,
                              filepath: attachment.filepath,
                              name: attachment.name,
                              ext: attachment.ext,
                              size: attachment.size,
                              mime: attachment.mime,
                              messages: attachment.messages,
                          },
            },
        };
    } else if ('OperationDone' in inner) {
        return {
            OperationDone: {
                uuid: inner.OperationDone.uuid,
                result: inner.OperationDone.result,
            },
        };
    } else if ('OperationStarted' in inner) {
        return {
            OperationStarted: inner.OperationStarted,
        };
    } else if ('OperationProcessing' in inner) {
        return { OperationProcessing: inner.OperationProcessing };
    } else if ('OperationError' in inner) {
        const err = inner.OperationError.error;
        return {
            OperationError: {
                uuid: inner.OperationError.uuid,
                error:
                    err === null
                        ? null
                        : {
                              severity: err.severity.toString(),
                              message: err.message,
                              kind: err.kind.toString(),
                          },
            },
        };
    } else if ('SessionError' in inner) {
        const err = inner.SessionError;
        return {
            SessionError: {
                severity: err.severity.toString(),
                message: err.message,
                kind: err.kind.toString(),
            },
        };
    } else if ('Progress' in inner) {
        const ticks =
            inner.Progress.detail === null
                ? null
                : inner.Progress.detail.detail === null
                ? null
                : inner.Progress.detail.detail;
        if (ticks !== null && 'Ticks' in ticks) {
            return {
                Progress: {
                    uuid: inner.Progress.uuid,
                    progress:
                        ticks === null
                            ? null
                            : {
                                  count: ticks.Ticks.count,
                                  total: ticks.Ticks.total,
                                  type: ticks.Ticks.state,
                              },
                },
            };
        } else {
            return {
                Progress: {
                    uuid: inner.Progress.uuid,
                    progress: null,
                },
            };
        }
    } else if ('StreamUpdated' in inner) {
        return {
            StreamUpdated: inner.StreamUpdated,
        };
    } else if ('SearchUpdated' in inner) {
        return {
            SearchUpdated: {
                found: inner.SearchUpdated.found,
                stat: inner.SearchUpdated.stat,
            },
        };
    } else if ('SearchValuesUpdated' in inner) {
        return {
            SearchValuesUpdated: inner.SearchValuesUpdated.values,
        };
    } else if ('SearchMapUpdated' in inner) {
        // TODO: Map represented as a JSON string and has to be parsed in addition
        return {
            SearchMapUpdated: inner.SearchMapUpdated.update,
        };
    } else if ('IndexedMapUpdated' in inner) {
        return {
            IndexedMapUpdated: {
                len: inner.IndexedMapUpdated.len,
            },
        };
    } else {
        throw new Error(`Fail to parse event: ${JSON.stringify(event)}`);
    }
}

export function decodeGrabbedElementList(buf: number[]): IGrabbedElement[] {
    const list: GrabbedElementList = proto.GrabbedElementList.decode(Uint8Array.from(buf));
    return list.elements.map((el: GrabbedElement) => {
        return {
            content: el.content,
            source_id: el.source_id,
            position: getValidNum(el.pos),
            nature: el.nature,
        };
    });
}

export function decodeAttachmentInfoList(buf: number[]): Attachment[] {
    const list: AttachmentInfoList = proto.AttachmentInfoList.decode(Uint8Array.from(buf));
    return list.elements
        .map((el: AttachmentInfo) => {
            return Attachment.from({
                uuid: el.uuid,
                filepath: el.filepath,
                name: el.name,
                ext: el.ext,
                size: Number(el.size),
                mime: el.mime,
                messages: el.messages.map((i) => Number(i)),
            });
        })
        .map((el) => {
            if (!(el instanceof Attachment)) {
                // TODO: move into logs
                console.error(`Fail parse attachment: ${JSON.stringify(el)}`);
            }
            return el;
        })
        .filter((el) => el instanceof Attachment) as Attachment[];
}

export function decodeSdeResponse(buf: number[]): sde.SdeResponse {
    const response: SdeResponse = proto.SdeResponse.decode(Uint8Array.from(buf));
    return { bytes: Number(response.bytes) };
}

export function encodeSdeRequest(request: sde.SdeRequest): number[] {
    const req: SdeRequest = {
        request: ((): Request => {
            if (request.WriteBytes) {
                return { WriteBytes: request.WriteBytes };
            } else if (request.WriteText) {
                return { WriteText: request.WriteText };
            } else {
                throw new Error('Unsupported SDE request type');
            }
        })(),
    };
    return Array.from(proto.SdeRequest.encode(req));
}

export { Aborted } from './Aborted';
export { DltFilterConfig } from './DltFilterConfig';
export { IndexedMapUpdated } from './IndexedMapUpdated';
export { Notification } from './Notification';
export { ProgressDetail } from './ProgressDetail';
export { SearchUpdated } from './SearchUpdated';
export { TicksWithUuid } from './TicksWithUuid';
export { AttachmentInfoList } from './AttachmentInfoList';
export { DltParserSettings } from './DltParserSettings';
export { NotInitialize } from './NotInitialize';
export { Progress } from './Progress';
export { SearchValuesUpdated } from './SearchValuesUpdated';
export { Transition } from './Transition';
export { AttachmentInfo } from './AttachmentInfo';
export { Empty } from './Empty';
export { Input } from './Input';
export { ObserveOptions } from './ObserveOptions';
export { Protocol } from './Protocol';
export { SerialTransportConfig } from './SerialTransportConfig';
export { Transport } from './Transport';
export { AttachmentsUpdated } from './AttachmentsUpdated';
export { Error } from './Error';
export { Interrupted } from './Interrupted';
export { ObserveOrigin } from './ObserveOrigin';
export { RangeInclusiveList } from './RangeInclusiveList';
export { SessionCreatingFail } from './SessionCreatingFail';
export { Type } from './Type';
export { CallbackEvent } from './CallbackEvent';
export { Event } from './Event';
export { InvalidArgs } from './InvalidArgs';
export { OperationDone } from './OperationDone';
export { RangeInclusive } from './RangeInclusive';
export { SessionUnavailable } from './SessionUnavailable';
export { UdpTransportConfig } from './UdpTransportConfig';
export { Cancelled } from './Cancelled';
export { FileFormat } from './FileFormat';
export { InvalidData } from './InvalidData';
export { OperationError } from './OperationError';
export { Range } from './Range';
export { Severity } from './Severity';
export { Unsupported } from './Unsupported';
export { CommandOutcome } from './CommandOutcome';
export { File } from './File';
export { InvalidRange } from './InvalidRange';
export { OperationNotSupported } from './OperationNotSupported';
export { Regex } from './Regex';
export { SomeIpParserSettings } from './SomeIpParserSettings';
export { ValueRange } from './ValueRange';
export { Communication } from './Communication';
export { Finished } from './Finished';
export { IoOperation } from './IoOperation';
export { Origin } from './Origin';
export { Request } from './Request';
export { Started } from './Started';
export { ComputationError } from './ComputationError';
export { GrabbedElementList } from './GrabbedElementList';
export { LifecycleTransition } from './LifecycleTransition';
export { Outcome } from './Outcome';
export { SdeRequest } from './SdeRequest';
export { Stopped } from './Stopped';
export { Concat } from './Concat';
export { GrabbedElement } from './GrabbedElement';
export { MulticastInfo } from './MulticastInfo';
export { Output } from './Output';
export { SdeResponse } from './SdeResponse';
export { Stream } from './Stream';
export { Config } from './Config';
export { Grabbing } from './Grabbing';
export { MultipleInitCall } from './MultipleInitCall';
export { ParserType } from './ParserType';
export { Sde } from './Sde';
export { StringVec } from './StringVec';
export { DestinationPath } from './DestinationPath';
export { GrabError } from './GrabError';
export { NativeErrorKind } from './NativeErrorKind';
export { ProcessTransportConfig } from './ProcessTransportConfig';
export { SearchError } from './SearchError';
export { TcpTransportConfig } from './TcpTransportConfig';
export { Detail } from './Detail';
export { Grab } from './Grab';
export { NativeError } from './NativeError';
export { Process } from './Process';
export { SearchMapUpdated } from './SearchMapUpdated';
export { Ticks } from './Ticks';
