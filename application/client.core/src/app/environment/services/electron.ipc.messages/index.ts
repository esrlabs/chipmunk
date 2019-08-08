import { HostState, EHostState, IHostState } from './host.state';
export { HostState, EHostState, IHostState };

import { HostStateHistory } from './host.state.history';
export { HostStateHistory };

import { HostTask, EHostTaskState, IHostTask } from './host.task';
export { HostTask, EHostTaskState, IHostTask };

import { HostTaskHistory, IHostTaskHistory, IHostTaskHistoryItem } from './host.task.history';
export { HostTaskHistory, IHostTaskHistory, IHostTaskHistoryItem };

import { IRenderMountPlugin, RenderMountPlugin, IRenderMountPluginInfo } from './render.plugin.mount';
export { IRenderMountPlugin, RenderMountPlugin, IRenderMountPluginInfo };

import { IRenderState, RenderState, ERenderState } from './render.state';
export { IRenderState, RenderState, ERenderState };

import { IPluginInternalMessage, PluginInternalMessage } from './plugin.internal.message';
export { IPluginInternalMessage, PluginInternalMessage };

import { IPluginError, PluginError } from './plugin.error';
export { IPluginError, PluginError };

import { IStreamAdd, StreamAdd } from './stream.add';
export { IStreamAdd, StreamAdd };

import { IStreamSetActive, StreamSetActive } from './stream.setactive';
export { IStreamSetActive, StreamSetActive };

import { IStreamRemoveRequest, StreamRemoveRequest } from './stream.remove.request';
export { IStreamRemoveRequest, StreamRemoveRequest };

import { IStreamRemoveResponse, StreamRemoveResponse } from './stream.remove.response';
export { IStreamRemoveResponse, StreamRemoveResponse };

import { IStreamData, StreamData } from './stream.data';
export { IStreamData, StreamData };

import { IStreamUpdated, StreamUpdated } from './stream.updated.';
export { IStreamUpdated, StreamUpdated };

import { IStreamPipeState, StreamPipeState } from './stream.pipe.state';
export { IStreamPipeState, StreamPipeState };

import { IStreamChunk, StreamChunk } from './stream.chunk';
export { IStreamChunk, StreamChunk };

import { IStreamSourceNew, StreamSourceNew } from './stream.source.new';
export { IStreamSourceNew, StreamSourceNew };

import { IStreamResetRequest, StreamResetRequest } from './stream.reset.request';
export { IStreamResetRequest, StreamResetRequest };

import { IStreamResetResponse, StreamResetResponse } from './stream.reset.response';
export { IStreamResetResponse, StreamResetResponse };

import { ISearchChunk, SearchChunk } from './search.chunk';
export { ISearchChunk, SearchChunk };

import { ISearchUpdated, SearchUpdated } from './search.updated';
export { ISearchUpdated, SearchUpdated };

import { ISearchRequest, SearchRequest, IRegExpStr } from './search.request';
export { ISearchRequest, SearchRequest, IRegExpStr };

import { ISearchRequestResults, SearchRequestResults } from './search.request.results';
export { ISearchRequestResults, SearchRequestResults };

import { IFileGetParserRequest, FileGetParserRequest } from './file.getparser.request';
export { IFileGetParserRequest, FileGetParserRequest };

import { IFileGetOptionsRequest, FileGetOptionsRequest } from './file.getoptions.request';
export { IFileGetOptionsRequest, FileGetOptionsRequest };

import { IFileGetOptionsResponse, FileGetOptionsResponse } from './file.getoptions.response';
export { IFileGetOptionsResponse, FileGetOptionsResponse };

import { IFileGetParserResponse, FileGetParserResponse } from './file.getparser.response';
export { IFileGetParserResponse, FileGetParserResponse };

import { IFileReadRequest, FileReadRequest } from './file.read.request';
export { IFileReadRequest, FileReadRequest };

import { IFileReadResponse, FileReadResponse } from './file.read.response';
export { IFileReadResponse, FileReadResponse };

import { IFileOpenRequest, FileOpenRequest } from './file.open.request';
export { IFileOpenRequest, FileOpenRequest };

import { IFileOpenResponse, FileOpenResponse } from './file.open.response';
export { IFileOpenResponse, FileOpenResponse };

import { IMergeFilesRequest, MergeFilesRequest } from './merge.files.request';
export { IMergeFilesRequest, MergeFilesRequest };

import { IMergeFilesResponse, MergeFilesResponse } from './merge.files.response';
export { IMergeFilesResponse, MergeFilesResponse };

import { IMergeFilesTestRequest, MergeFilesTestRequest } from './merge.files.test.request';
export { IMergeFilesTestRequest, MergeFilesTestRequest };

import { IMergeFilesTestResponse, MergeFilesTestResponse } from './merge.files.test.response';
export { IMergeFilesTestResponse, MergeFilesTestResponse };

import { IMergeFilesDiscoverRequest, MergeFilesDiscoverRequest } from './merge.files.discover.request';
export { IMergeFilesDiscoverRequest, MergeFilesDiscoverRequest };

import { IMergeFilesDiscoverResponse, MergeFilesDiscoverResponse, IMergeFilesDiscoverResult } from './merge.files.discover.response';
export { IMergeFilesDiscoverResponse, MergeFilesDiscoverResponse, IMergeFilesDiscoverResult };

import { MergeFilesTimezonesRequest } from './merge.files.timezone.request';
export { MergeFilesTimezonesRequest };

import { IMergeFilestimezoneResponse, MergeFilestimezoneResponse } from './merge.files.timezone.response';
export { IMergeFilestimezoneResponse, MergeFilestimezoneResponse };

import { FiltersLoadRequest } from './file.filters.load.request';
export { FiltersLoadRequest };

import { IFilter, IFiltersLoadResponse, FiltersLoadResponse } from './file.filters.load.response';
export { IFilter, IFiltersLoadResponse, FiltersLoadResponse };

import { IFiltersSaveRequest, FiltersSaveRequest } from './file.filters.save.request';
export { IFiltersSaveRequest, FiltersSaveRequest };

import { IFiltersSaveResponse, FiltersSaveResponse } from './file.filters.save.response';
export { IFiltersSaveResponse, FiltersSaveResponse };

import { INotification, Notification, ENotificationType } from './notification';
export { INotification, Notification, ENotificationType };

import { IHotkeyCall, HotkeyCall, EHotkeyActionRef } from './hotkey';
export { IHotkeyCall, HotkeyCall, EHotkeyActionRef };

import { HotkeyPause } from './hotkey.pause';
export { HotkeyPause };

import { HotkeyResume } from './hotkey.resume';
export { HotkeyResume };

import { HotkeyInputIn } from './hotkey.input.in';
export { HotkeyInputIn };

import { HotkeyInputOut } from './hotkey.input.out';
export { HotkeyInputOut };

import { IDLTStatsRequest, DLTStatsRequest } from './dlt.filestats.request';
export { IDLTStatsRequest, DLTStatsRequest };

import { IDLTStatsResponse, DLTStatsResponse, IDLTStats, IDLTStatsRecord } from './dlt.filestats.response';
export { IDLTStatsResponse, DLTStatsResponse, IDLTStats, IDLTStatsRecord };

// Common type for expected message implementation
export type TMessage =  HostState |
                        HostStateHistory |
                        HostTask |
                        HostTaskHistory |
                        RenderMountPlugin |
                        RenderState |
                        PluginInternalMessage |
                        PluginError |
                        StreamSetActive |
                        StreamAdd |
                        StreamRemoveRequest |
                        StreamRemoveResponse |
                        StreamData |
                        StreamUpdated |
                        StreamPipeState |
                        StreamChunk |
                        StreamSourceNew |
                        StreamResetRequest |
                        StreamResetResponse |
                        SearchRequest |
                        SearchRequestResults |
                        SearchUpdated |
                        SearchChunk |
                        FileGetParserRequest |
                        FileGetParserResponse |
                        FileReadRequest |
                        FileReadResponse |
                        FileOpenRequest |
                        FileOpenResponse |
                        MergeFilesRequest |
                        MergeFilesResponse |
                        MergeFilesTestRequest |
                        MergeFilesTestResponse |
                        MergeFilesTimezonesRequest |
                        MergeFilestimezoneResponse |
                        MergeFilesDiscoverRequest |
                        MergeFilesDiscoverResponse |
                        FiltersLoadRequest |
                        FiltersLoadResponse |
                        FiltersSaveRequest |
                        FiltersSaveResponse |
                        Notification |
                        HotkeyCall |
                        HotkeyPause |
                        HotkeyInputIn |
                        HotkeyInputOut |
                        HotkeyResume |
                        DLTStatsRequest |
                        DLTStatsResponse;

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
* Mapping of host/render events
* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *  */
export const Map = {

    [HostState.signature                    ]: HostState,
    [HostStateHistory.signature             ]: HostStateHistory,
    [HostTask.signature                     ]: HostTask,
    [HostTaskHistory.signature              ]: HostTaskHistory,

    [RenderMountPlugin.signature            ]: RenderMountPlugin,
    [RenderState.signature                  ]: RenderState,

    [PluginInternalMessage.signature        ]: PluginInternalMessage,
    [PluginError.signature                  ]: PluginError,

    [StreamSetActive.signature              ]: StreamSetActive,
    [StreamAdd.signature                    ]: StreamAdd,
    [StreamRemoveRequest.signature          ]: StreamRemoveRequest,
    [StreamRemoveResponse.signature         ]: StreamRemoveResponse,
    [StreamData.signature                   ]: StreamData,
    [StreamUpdated.signature                ]: StreamUpdated,
    [StreamPipeState.signature              ]: StreamPipeState,
    [StreamChunk.signature                  ]: StreamChunk,
    [StreamSourceNew.signature              ]: StreamSourceNew,
    [StreamResetRequest.signature           ]: StreamResetRequest,
    [StreamResetResponse.signature          ]: StreamResetResponse,

    [SearchRequest.signature                ]: SearchRequest,
    [SearchRequestResults.signature         ]: SearchRequestResults,
    [SearchChunk.signature                  ]: SearchChunk,
    [SearchUpdated.signature                ]: SearchUpdated,

    [FileGetParserRequest.signature         ]: FileGetParserRequest,
    [FileGetParserResponse.signature        ]: FileGetParserResponse,
    [FileGetOptionsRequest.signature        ]: FileGetOptionsRequest,
    [FileGetOptionsResponse.signature       ]: FileGetOptionsResponse,
    [FileReadRequest.signature              ]: FileReadRequest,
    [FileReadResponse.signature             ]: FileReadResponse,
    [FileOpenRequest.signature              ]: FileOpenRequest,
    [FileOpenResponse.signature             ]: FileOpenResponse,

    [MergeFilesRequest.signature            ]: MergeFilesRequest,
    [MergeFilesResponse.signature           ]: MergeFilesResponse,
    [MergeFilesTestRequest.signature        ]: MergeFilesTestRequest,
    [MergeFilesTestResponse.signature       ]: MergeFilesTestResponse,
    [MergeFilesTimezonesRequest.signature   ]: MergeFilesTimezonesRequest,
    [MergeFilestimezoneResponse.signature   ]: MergeFilestimezoneResponse,
    [MergeFilesDiscoverRequest.signature    ]: MergeFilesDiscoverRequest,
    [MergeFilesDiscoverResponse.signature   ]: MergeFilesDiscoverResponse,

    [FiltersLoadRequest.signature           ]: FiltersLoadRequest,
    [FiltersLoadResponse.signature          ]: FiltersLoadResponse,
    [FiltersSaveRequest.signature           ]: FiltersSaveRequest,
    [FiltersSaveResponse.signature          ]: FiltersSaveResponse,

    [Notification.signature                 ]: Notification,

    [HotkeyCall.signature                   ]: HotkeyCall,
    [HotkeyPause.signature                  ]: HotkeyPause,
    [HotkeyResume.signature                 ]: HotkeyResume,
    [HotkeyInputIn.signature                ]: HotkeyInputIn,
    [HotkeyInputOut.signature               ]: HotkeyInputOut,

    [DLTStatsRequest.signature              ]: DLTStatsRequest,
    [DLTStatsResponse.signature             ]: DLTStatsResponse,

};
