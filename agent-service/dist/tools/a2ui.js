export function a2ui(surfaceId, type, title, data) {
    return {
        version: '0.1',
        surfaceId,
        operation: 'replace',
        root: { type, title, data },
    };
}
//# sourceMappingURL=a2ui.js.map