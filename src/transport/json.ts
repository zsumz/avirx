export function isJsonContentType(contentType: string | null | undefined): boolean {
    if (!contentType) {
        return false;
    }

    const mediaType = contentType.split(';', 1)[0]?.trim().toLowerCase();
    return mediaType === 'application/json' || Boolean(mediaType?.endsWith('+json'));
}
