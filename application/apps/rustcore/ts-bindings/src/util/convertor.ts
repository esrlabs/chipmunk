/* eslint-disable @typescript-eslint/no-unused-vars */

import { IObserve, Observe } from 'platform/types/observe';
import { Attachment, IGrabbedElement } from 'platform/types/content';
import { getValidNum } from './numbers';
import { IRange } from 'platform/types/range';
import { IValuesMinMaxMap } from 'platform/types/filter';

import * as proto from 'protocol';
import * as ty from '../protocol';
import * as $ from 'platform/types/observe';
import * as sde from 'platform/types/sde';

export type ProgressEventTy =
    | {
          progress: { total: number | undefined; count: number; state: string | undefined };
      }
    | { stopped: boolean }
    | {
          notification: {
              content: string;
              line: number;
              severity: number;
          };
      };

export function decodeIRanges(buf: number[]): IRange[] {
    const list: ty.RangeInclusiveList = proto.RangeInclusiveList.decode(Uint8Array.from(buf));
    return list.elements.map((el: ty.RangeInclusive) => {
        return {
            from: Number(el.start),
            to: Number(el.end),
        };
    });
}

export function toObserveOptions(source: IObserve): ty.ObserveOptions {
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
    const origin_oneof: ty.OriginOneof = ((): ty.OriginOneof => {
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
                        transport_oneof: ((): ty.TransportOneof => {
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
    const parser: ty.ParserType = ((): ty.ParserType => {
        if (text !== undefined) {
            return {
                type_oneof: {
                    Text: true,
                },
            };
        } else if (dlt !== undefined) {
            const filter_config = dlt.configuration.filter_config;
            return {
                type_oneof: {
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
                                      app_id_count: filter_config.app_id_count,
                                      app_ids:
                                          filter_config.app_ids === undefined
                                              ? []
                                              : filter_config.app_ids,
                                      ecu_ids:
                                          filter_config.ecu_ids === undefined
                                              ? []
                                              : filter_config.ecu_ids,
                                      context_id_count: filter_config.context_id_count,
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
                type_oneof: {
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
    return { origin: { origin_oneof }, parser };
}

export function decodeLifecycleTransition(buf: number[] | Buffer): any {
    const event: ty.LifecycleTransition = proto.LifecycleTransition.decode(Uint8Array.from(buf));
    if (!event.transition_oneof) {
        return {};
    }
    const inner: ty.TransitionOneof = event.transition_oneof;
    if ('Started' in inner) {
        return { Started: { uuid: inner.Started?.uuid, alias: inner.Started?.alias } };
    } else if ('Ticks' in inner) {
        const ticks = inner.Ticks?.ticks;
        return {
            Ticks: {
                uuid: inner.Ticks?.uuid,
                progress:
                    ticks === null || ticks === undefined
                        ? {}
                        : {
                              count: Number(ticks.count),
                              state: ticks.state,
                              total: Number(ticks.total),
                          },
            },
        };
    } else if ('Stopped' in inner) {
        return { Stopped: inner.Stopped?.uuid };
    } else {
        throw new Error(`Fail to parse event: ${JSON.stringify(event)}`);
    }
}

export type CallbackEventType =
    | { SessionDestroyed: null }
    | { FileRead: null }
    | {
          AttachmentsUpdated: {
              len: number;
              attachment:
                  | undefined
                  | {
                        uuid: string;
                        filepath: string;
                        name: string;
                        ext: string;
                        size: number;
                        mime: string;
                        messages: number[];
                    };
          };
      }
    | {
          OperationDone: {
              uuid: string;
              result: string | undefined;
          };
      }
    | {
          OperationStarted: string;
      }
    | { OperationProcessing: string }
    | {
          OperationError: {
              uuid: string;
              error:
                  | undefined
                  | {
                        severity: string;
                        message: string;
                        kind: string;
                    };
          };
      }
    | {
          SessionError: {
              severity: string;
              message: string;
              kind: string;
          };
      }
    | {
          Progress: {
              uuid: string;
              event: ProgressEventTy;
          };
      }
    | {
          StreamUpdated: number;
      }
    | {
          SearchUpdated: {
              found: number;
              stat: Map<string, number>;
          };
      }
    | {
          SearchMapUpdated: string;
      }
    | {
          IndexedMapUpdated: { len: number };
      }
    | { SearchValuesUpdated: IValuesMinMaxMap };

export function decodeCallbackEvent(buf: number[] | Buffer): CallbackEventType | Error {
    const event: ty.CallbackEvent = proto.CallbackEvent.decode(Uint8Array.from(buf));
    if (!event.event_oneof) {
        return new Error(`Field "event_oneof" isn't found in CallbackEvent`);
    }
    const inner: ty.EventOneof = event.event_oneof;
    if ('SessionDestroyed' in inner) {
        return { SessionDestroyed: null };
    } else if ('FileRead' in inner) {
        return { FileRead: null };
    } else if ('AttachmentsUpdated' in inner) {
        const attachment = inner.AttachmentsUpdated;
        if (!attachment) {
            return new Error(`Has been recieved AttachmentsUpdated without even definition`);
        }
        const body = attachment.attachment;
        return {
            AttachmentsUpdated: {
                len: attachment.len,
                attachment:
                    body === null || body === undefined
                        ? undefined
                        : {
                              uuid: body.uuid,
                              filepath: body.filepath,
                              name: body.name,
                              ext: body.ext,
                              size: body.size,
                              mime: body.mime,
                              messages: body.messages,
                          },
            },
        };
    } else if ('OperationDone' in inner) {
        const operation = inner.OperationDone;
        if (!operation) {
            return new Error(`Has been recieved OperationDone without even definition`);
        }
        return {
            OperationDone: {
                uuid: operation.uuid,
                result: operation.result,
            },
        };
    } else if ('OperationStarted' in inner) {
        const operation = inner.OperationStarted;
        if (!operation) {
            return new Error(`Has been recieved OperationStarted without even definition`);
        }
        return {
            OperationStarted: operation,
        };
    } else if ('OperationProcessing' in inner) {
        const operation = inner.OperationProcessing;
        if (!operation) {
            return new Error(`Has been recieved OperationProcessing without even definition`);
        }
        return { OperationProcessing: operation };
    } else if ('OperationError' in inner) {
        const error = inner.OperationError;
        if (!error) {
            return new Error(`Has been recieved OperationError without even definition`);
        }
        return {
            OperationError: {
                uuid: error.uuid,
                error:
                    error.error === null || error.error === undefined
                        ? undefined
                        : {
                              severity: error.error.severity.toString(),
                              message: error.error.message,
                              kind: error.error.kind.toString(),
                          },
            },
        };
    } else if ('SessionError' in inner) {
        const error = inner.SessionError;
        if (!error) {
            return new Error(`Has been recieved SessionError without even definition`);
        }
        return {
            SessionError: {
                severity: error.severity.toString(),
                message: error.message,
                kind: error.kind.toString(),
            },
        };
    } else if ('Progress' in inner) {
        const progress = inner.Progress;
        if (!progress) {
            return new Error(`Has been recieved Progress without even definition`);
        }
        const details =
            progress.detail === null || progress.detail === undefined
                ? null
                : progress.detail.detail_oneof === null
                ? null
                : progress.detail.detail_oneof;
        if (!details) {
            return new Error(
                `Has been recieved Progress without event definition (detail.detail_oneof)`,
            );
        }
        if (!details.Notification && !details.Stopped && !details.Ticks) {
            return new Error(
                `Has been recieved Progress without event type definition (Notification or Stopped or Ticks aren't found)`,
            );
        }
        const ticks = !details.Ticks ? null : details.Ticks;
        const stopped = !details.Stopped ? null : details.Stopped;
        const notification = !details.Notification ? null : details.Notification;
        return {
            Progress: {
                uuid: progress.uuid,
                event:
                    ticks !== null
                        ? {
                              progress: {
                                  count: ticks.count,
                                  total: ticks.total,
                                  state: ticks.state.trim() === '' ? undefined : ticks.state,
                              },
                          }
                        : stopped !== null
                        ? {
                              stopped: true,
                          }
                        : notification !== null
                        ? {
                              notification: {
                                  content: notification.content,
                                  line: notification.line,
                                  severity: notification.severity,
                              },
                          }
                        : // Set default value
                          {
                              progress: {
                                  count: 0,
                                  total: 0,
                                  state: undefined,
                              },
                          },
            },
        };
    } else if ('StreamUpdated' in inner) {
        const event = inner.StreamUpdated;
        if (!event) {
            return new Error(`Has been recieved StreamUpdated without even definition`);
        }
        return {
            StreamUpdated: event,
        };
    } else if ('SearchUpdated' in inner) {
        const event = inner.SearchUpdated;
        if (!event) {
            return new Error(`Has been recieved SearchUpdated without even definition`);
        }
        return {
            SearchUpdated: {
                found: !event.found ? 0 : event.found,
                stat: !event.stat ? new Map() : event.stat,
            },
        };
    } else if ('SearchValuesUpdated' in inner) {
        const event = inner.SearchValuesUpdated;
        if (!event) {
            return new Error(`Has been recieved SearchValuesUpdated without even definition`);
        }
        const values: IValuesMinMaxMap = {};
        event.values.forEach((range, key) => {
            values[key] = [range.min, range.max];
        });
        return {
            SearchValuesUpdated: values,
        };
    } else if ('SearchMapUpdated' in inner) {
        const event = inner.SearchMapUpdated;
        if (!event) {
            return new Error(`Has been recieved SearchMapUpdated without even definition`);
        }
        // TODO: Map represented as a JSON string and has to be parsed in addition
        return {
            SearchMapUpdated: event.update,
        };
    } else if ('IndexedMapUpdated' in inner) {
        const event = inner.IndexedMapUpdated;
        if (!event) {
            return new Error(`Has been recieved IndexedMapUpdated without even definition`);
        }
        return {
            IndexedMapUpdated: {
                len: event.len,
            },
        };
    } else {
        throw new Error(`Fail to parse event: ${JSON.stringify(event)}`);
    }
}

export function decodeGrabbedElementList(buf: number[]): IGrabbedElement[] {
    const list: ty.GrabbedElementList = proto.GrabbedElementList.decode(Uint8Array.from(buf));
    return list.elements.map((el: ty.GrabbedElement) => {
        return {
            content: el.content,
            source_id: el.source_id,
            position: getValidNum(el.pos),
            nature: el.nature,
        };
    });
}

export function decodeAttachmentInfoList(buf: number[]): Attachment[] {
    const list: ty.AttachmentInfoList = proto.AttachmentInfoList.decode(Uint8Array.from(buf));
    return list.elements
        .map((el: ty.AttachmentInfo) => {
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
    const response: ty.SdeResponse = proto.SdeResponse.decode(Uint8Array.from(buf));
    return { bytes: Number(response.bytes) };
}

export function encodeSdeRequest(request: sde.SdeRequest): Uint8Array {
    const req: ty.SdeRequest = {
        request_oneof: ((): ty.RequestOneof => {
            if (request.WriteBytes) {
                return { WriteBytes: request.WriteBytes };
            } else if (request.WriteText) {
                return { WriteText: request.WriteText };
            } else {
                throw new Error('Unsupported SDE request type');
            }
        })(),
    };
    return proto.SdeRequest.encode(req);
}
