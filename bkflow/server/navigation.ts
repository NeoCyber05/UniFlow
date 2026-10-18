// Server actions call redirect() after mutating; over HTTP the client navigates itself, so this is a no-op
// and the action resolves with undefined. shortcut: delete-board returns undefined, client must treat that as success (Phase 4).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const redirect = (_url: string): void => {};
