import * as vscode from 'vscode';

export type RemoteKind = 'local' | 'wsl' | 'devcontainer' | 'ssh' | 'tunnel' | 'other';

export type EntryType = 'folder' | 'workspace' | 'file' | 'connection';

export interface RecentEntry {
    kind: RemoteKind;
    hostLabel?: string;
    parentKind?: RemoteKind;
    parentHostLabel?: string;
    uri: vscode.Uri;
    entryType: EntryType;
    displayName: string;
    fullPath: string;
    hostPath?: string;
    rawAuthority?: string;
    // Dev Container authority hex decodes to either JSON (configFile/localDocker/settings recorded)
    // or just the raw host path (no config payload). devContainerConfig is the JSON form when present.
    devContainerConfig?: DevContainerConfig;
}

export interface DevContainerConfig {
    /** Path to devcontainer.json on the host, if recorded in the authority. */
    configFile?: string;
    /** Whether the Dev Containers extension recorded localDocker=true. */
    localDocker?: boolean;
    /** True if the authority payload was the JSON form; false if it was just the raw host path. */
    hasPayload: boolean;
}
