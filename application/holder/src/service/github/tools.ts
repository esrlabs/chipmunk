import { SharingSettings } from 'platform/types/github';

import * as md from 'platform/types/github/filemetadata';

export function hasChanges(
    candidate: md.FileMetaData,
    remote: md.FileMetaData | undefined,
    settings: SharingSettings,
): boolean {
    if (remote !== undefined) {
        if (settings.filters && candidate.hash().filters() !== remote.hash().filters()) {
            return true;
        }
        if (settings.charts && candidate.hash().charts() !== remote.hash().charts()) {
            return true;
        }
        if (settings.bookmarks && candidate.hash().bookmarks() !== remote.hash().bookmarks()) {
            return true;
        }
        if (settings.comments && candidate.hash().comments() !== remote.hash().comments()) {
            return true;
        }
        return false;
    } else {
        return true;
    }
}
export function serialize(
    candidate: md.FileMetaData,
    recent: md.FileMetaData,
    settings: SharingSettings,
): md.FileMetaData {
    const serialized = recent.get();
    const updates = candidate.get();
    if (settings.filters && candidate.hash().filters() !== recent.hash().filters()) {
        serialized.filters = updates.filters;
    }
    if (settings.charts && candidate.hash().charts() !== recent.hash().charts()) {
        serialized.charts = updates.charts;
    }
    if (settings.bookmarks && candidate.hash().bookmarks() !== recent.hash().bookmarks()) {
        serialized.bookmarks = updates.bookmarks;
    }
    if (settings.comments && candidate.hash().comments() !== recent.hash().comments()) {
        serialized.comments = updates.comments;
    }
    return new md.FileMetaData(serialized);
}
