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
}
