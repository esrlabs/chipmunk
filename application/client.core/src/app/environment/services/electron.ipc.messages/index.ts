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

import { ISearchStreamUpdated, SearchStreamUpdated } from './search.stream.updated';
export { ISearchStreamUpdated, SearchStreamUpdated };

import { ISearchRequest, SearchRequest, IRegExpStr } from './search.request';
export { ISearchRequest, SearchRequest, IRegExpStr };

import { ISearchRequestStarted, SearchRequestStarted } from './search.request.started';
export { ISearchRequestStarted, SearchRequestStarted };

import { ISearchRequestFinished, SearchRequestFinished } from './search.request.finished';
export { ISearchRequestFinished, SearchRequestFinished };

import { ISearchRequestResults, SearchRequestResults } from './search.request.results';
export { ISearchRequestResults, SearchRequestResults };

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
                        SearchRequestStarted |
                        SearchRequestFinished |
                        SearchRequestResults |
                        SearchChunk |
                        SearchStreamUpdated;

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
* Mapping of host/render events
* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *  */
export const Map = {

    [HostState.signature                ]: HostState,
    [HostStateHistory.signature         ]: HostStateHistory,
    [HostTask.signature                 ]: HostTask,
    [HostTaskHistory.signature          ]: HostTaskHistory,

    [RenderMountPlugin.signature        ]: RenderMountPlugin,
    [RenderState.signature              ]: RenderState,

    [PluginInternalMessage.signature    ]: PluginInternalMessage,

    [StreamSetActive.signature          ]: StreamSetActive,
    [StreamAdd.signature                ]: StreamAdd,
    [StreamRemove.signature             ]: StreamRemove,
    [StreamData.signature               ]: StreamData,
    [StreamUpdated.signature            ]: StreamUpdated,
    [StreamPipeState.signature          ]: StreamPipeState,
    [StreamChunk.signature              ]: StreamChunk,
    [StreamSourceNew.signature          ]: StreamSourceNew,

    [SearchRequest.signature            ]: SearchRequest,
    [SearchRequestStarted.signature     ]: SearchRequestStarted,
    [SearchRequestFinished.signature    ]: SearchRequestFinished,
    [SearchRequestResults.signature     ]: SearchRequestResults,
    [SearchChunk.signature              ]: SearchChunk,
    [SearchStreamUpdated.signature      ]: SearchStreamUpdated,

};
