export function getFileReadingJobUuid(session: string): string {
    return `reading_file:${session}`;
}
