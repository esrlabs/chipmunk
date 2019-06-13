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

import { IStreamAdd, StreamAdd } from './stream.add';
export { IStreamAdd, StreamAdd };

import { IStreamSetActive, StreamSetActive } from './stream.setactive';
export { IStreamSetActive, StreamSetActive };

import { IStreamRemove, StreamRemove } from './stream.remove';
export { IStreamRemove, StreamRemove };

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

// Common type for expected message implementation
export type TMessage =  HostState |
                        HostStateHistory |
                        HostTask |
                        HostTaskHistory |
                        RenderMountPlugin |
                        RenderState |
                        PluginInternalMessage |
                        StreamSetActive |
                        StreamAdd |
                        StreamRemove |
                        StreamData |
                        StreamUpdated |
                        StreamPipeState |
                        StreamChunk |
                        StreamSourceNew |
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
                        FiltersLoadRequest |
                        FiltersLoadResponse |
                        FiltersSaveRequest |
                        FiltersSaveResponse;

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

    [StreamSetActive.signature              ]: StreamSetActive,
    [StreamAdd.signature                    ]: StreamAdd,
    [StreamRemove.signature                 ]: StreamRemove,
    [StreamData.signature                   ]: StreamData,
    [StreamUpdated.signature                ]: StreamUpdated,
    [StreamPipeState.signature              ]: StreamPipeState,
    [StreamChunk.signature                  ]: StreamChunk,
    [StreamSourceNew.signature              ]: StreamSourceNew,

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

    [FiltersLoadRequest.signature           ]: FiltersLoadRequest,
    [FiltersLoadResponse.signature          ]: FiltersLoadResponse,
    [FiltersSaveRequest.signature           ]: FiltersSaveRequest,
    [FiltersSaveResponse.signature          ]: FiltersSaveResponse,

};
