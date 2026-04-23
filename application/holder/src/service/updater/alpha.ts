import { IReleaseData } from '@module/github';

// Alpha announcements are intentionally separate from the main updater flow.
// The current app never installs `4.0.0-alpha.x`; it only points users to GitHub.
const ALPHA_TAG_REGEXP = /^v?4\.0\.0-alpha\.(\d+)$/i;

export interface IAlphaRelease {
    release: IReleaseData;
    tag: string;
    number: number;
}

/**
 * Picks the newest GitHub prerelease matching `4.0.0-alpha.{n}`.
 *
 * The match is based on `tag_name`, not `name`, because release titles are editable.
 */
export function getLatestAlphaRelease(releases: IReleaseData[]): IAlphaRelease | undefined {
    return releases
        .map((release) => getAlphaRelease(release))
        .filter((release): release is IAlphaRelease => release !== undefined)
        .sort((a, b) => {
            if (a.number !== b.number) {
                return b.number - a.number;
            }
            const publishedDiff = getPublishedAtTime(b.release) - getPublishedAtTime(a.release);
            if (publishedDiff !== 0) {
                return publishedDiff;
            }
            return b.release.id - a.release.id;
        })[0];
}

export function getAlphaRelease(release: IReleaseData): IAlphaRelease | undefined {
    if (release.prerelease !== true || release.draft === true) {
        return undefined;
    }
    if (typeof release.html_url !== 'string' || release.html_url.trim() === '') {
        return undefined;
    }
    const parsed = parseAlphaTag(release.tag_name);
    if (parsed === undefined) {
        return undefined;
    }
    return {
        release,
        tag: parsed.tag,
        number: parsed.number,
    };
}

// Notifications prefer the release title when present, but parsing never depends on it.
export function getReleaseLabel(release: IReleaseData): string {
    return release.name.trim() !== '' ? release.name : release.tag_name;
}

function parseAlphaTag(tag: string): { tag: string; number: number } | undefined {
    // Normalize tags so `v4.0.0-alpha.7` and `4.0.0-alpha.7` dedupe to the same key.
    const match = tag.trim().toLowerCase().match(ALPHA_TAG_REGEXP);
    if (match === null) {
        return undefined;
    }
    const number = Number.parseInt(match[1], 10);
    if (!Number.isSafeInteger(number)) {
        return undefined;
    }
    return {
        tag: `4.0.0-alpha.${number}`,
        number,
    };
}

function getPublishedAtTime(release: IReleaseData): number {
    // GitHub ordering is not treated as authoritative for alpha announcements.
    if (typeof release.published_at !== 'string' || release.published_at.trim() === '') {
        return 0;
    }
    const publishedAt = Date.parse(release.published_at);
    return Number.isNaN(publishedAt) ? 0 : publishedAt;
}
