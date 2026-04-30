import * as vscode from 'vscode';
import { EntryType, RecentEntry, RemoteKind } from './types';

function labelFromHostPath(hostPath: string): string | undefined {
    const wsl = hostPath.match(/^\\\\wsl\.localhost\\([^\\]+)\\/i)
        ?? hostPath.match(/^\\\\wsl\$\\([^\\]+)\\/i);
    if (wsl) {
        return `via wsl:${wsl[1].toLowerCase()}`;
    }
    if (/^[a-zA-Z]:[\\/]/.test(hostPath)) {
        return 'via windows';
    }
    if (hostPath.startsWith('/')) {
        return 'via local-linux';
    }
    return undefined;
}

interface DevContainerInfo {
    hostLabel?: string;
    hostPath?: string;
}

function decodeDevContainerInfo(authority: string): DevContainerInfo {
    const prefixMatch = authority.match(/^(?:dev-container|attached-container)\+([0-9a-fA-F]+)/);
    if (!prefixMatch) { return {}; }
    const hex = prefixMatch[1];
    let decoded: string;
    try {
        decoded = Buffer.from(hex, 'hex').toString('utf8');
    } catch {
        return {};
    }

    if (decoded.startsWith('{')) {
        try {
            const obj = JSON.parse(decoded) as Record<string, unknown>;
            const hostPath = typeof obj['hostPath'] === 'string' ? obj['hostPath'] as string : undefined;
            return {
                hostLabel: hostPath ? labelFromHostPath(hostPath) : undefined,
                hostPath,
            };
        } catch {
            // 旧形式にフォールスルー
        }
    }

    return {
        hostLabel: labelFromHostPath(decoded),
        hostPath: decoded,
    };
}

interface AuthorityInfo {
    kind: RemoteKind;
    hostLabel?: string;
    hostPath?: string;
    parentKind?: RemoteKind;
    parentHostLabel?: string;
}

export function classifyAuthority(authority: string | undefined): AuthorityInfo {
    if (!authority) {
        return { kind: 'local' };
    }
    if (authority.startsWith('wsl+')) {
        return { kind: 'wsl', hostLabel: authority.substring(4) };
    }
    if (authority.startsWith('tunnel+')) {
        return { kind: 'tunnel', hostLabel: authority.substring(7) };
    }
    if (authority.startsWith('ssh-remote+')) {
        return { kind: 'ssh', hostLabel: authority.substring(11) };
    }
    if (authority.startsWith('dev-container+') || authority.startsWith('attached-container+')) {
        const dcInfo = decodeDevContainerInfo(authority);
        const atIdx = authority.indexOf('@');
        let hostLabel = dcInfo.hostLabel;
        let parentKind: RemoteKind = 'local';
        let parentHostLabel: string | undefined;
        if (atIdx >= 0) {
            const nested = classifyAuthority(authority.substring(atIdx + 1));
            const nestedLabel = nested.hostLabel
                ? `via ${nested.kind}:${nested.hostLabel}`
                : `via ${nested.kind}`;
            hostLabel = hostLabel ? `${hostLabel} (${nestedLabel})` : nestedLabel;
            parentKind = nested.kind;
            parentHostLabel = nested.hostLabel;
        } else if (dcInfo.hostPath) {
            const wsl = dcInfo.hostPath.match(/^\\\\wsl\.localhost\\([^\\]+)\\/i)
                ?? dcInfo.hostPath.match(/^\\\\wsl\$\\([^\\]+)\\/i);
            if (wsl) {
                parentKind = 'wsl';
                parentHostLabel = wsl[1].toLowerCase();
            }
        }
        return {
            kind: 'devcontainer',
            hostLabel,
            hostPath: dcInfo.hostPath,
            parentKind,
            parentHostLabel,
        };
    }
    return { kind: 'other', hostLabel: authority };
}

function toUri(raw: unknown): vscode.Uri | undefined {
    if (!raw) { return undefined; }
    if (raw instanceof vscode.Uri) { return raw; }
    if (typeof raw === 'object') {
        const obj = raw as Record<string, unknown>;
        try {
            return vscode.Uri.from({
                scheme: (obj['scheme'] as string) ?? 'file',
                authority: (obj['authority'] as string) ?? '',
                path: (obj['path'] as string) ?? '',
                query: (obj['query'] as string) ?? '',
                fragment: (obj['fragment'] as string) ?? '',
            });
        } catch {
            return undefined;
        }
    }
    if (typeof raw === 'string') {
        try { return vscode.Uri.parse(raw); } catch { return undefined; }
    }
    return undefined;
}

function isWindowsStylePath(p: string): boolean {
    return p.startsWith('\\\\') || /^[A-Za-z]:[\\/]/.test(p);
}

function basename(p: string): string {
    const sep = isWindowsStylePath(p) ? /[\\/]/ : /\//;
    const parts = p.split(sep).filter(Boolean);
    if (parts.length === 0) { return p; }
    return parts[parts.length - 1];
}

function displayNameFor(p: string, entryType: EntryType): string {
    const last = basename(p);
    if (entryType === 'workspace') {
        return last.replace(/\.code-workspace$/, '');
    }
    return last;
}

function buildEntryUri(localUri: vscode.Uri, remoteAuthority: string | undefined): vscode.Uri {
    if (!remoteAuthority) {
        return localUri;
    }
    return vscode.Uri.from({
        scheme: 'vscode-remote',
        authority: remoteAuthority,
        path: localUri.path,
    });
}

function parentAuthorityFor(kind: RemoteKind, hostLabel: string): string | undefined {
    switch (kind) {
        case 'wsl': return `wsl+${hostLabel}`;
        case 'tunnel': return `tunnel+${hostLabel}`;
        case 'ssh': return `ssh-remote+${hostLabel}`;
        default: return undefined;
    }
}

interface ConnectSeed {
    kind: RemoteKind;
    hostLabel?: string;
    rawAuthority: string;
}

function buildConnectionEntries(entries: RecentEntry[]): RecentEntry[] {
    const seeds = new Map<string, ConnectSeed>();

    // Pass 1: seed from direct (non-devcontainer) remote entries — preserves the original authority casing.
    for (const e of entries) {
        if (e.kind === 'local' || e.kind === 'other') { continue; }
        if (e.kind === 'devcontainer') { continue; }
        if (!e.rawAuthority) { continue; }
        const key = `${e.kind}::${(e.hostLabel ?? '').toLowerCase()}`;
        if (seeds.has(key)) { continue; }
        seeds.set(key, { kind: e.kind, hostLabel: e.hostLabel, rawAuthority: e.rawAuthority });
    }

    // Pass 2: also seed from devcontainer entries' parent route, so a route that only hosts
    // dev containers still gets a (connect, no folder) entry. Direct seeds win on key collision.
    for (const e of entries) {
        if (e.kind !== 'devcontainer') { continue; }
        const pk = e.parentKind;
        const ph = e.parentHostLabel;
        if (!pk || !ph) { continue; }
        const synthAuth = parentAuthorityFor(pk, ph);
        if (!synthAuth) { continue; }
        const key = `${pk}::${ph.toLowerCase()}`;
        if (seeds.has(key)) { continue; }
        seeds.set(key, { kind: pk, hostLabel: ph, rawAuthority: synthAuth });
    }

    const result: RecentEntry[] = [];
    for (const [, seed] of seeds) {
        const uri = vscode.Uri.from({
            scheme: 'vscode-remote',
            authority: seed.rawAuthority,
            path: '/',
        });
        result.push({
            kind: seed.kind,
            hostLabel: seed.hostLabel,
            uri,
            entryType: 'connection',
            displayName: '(connect, no folder)',
            fullPath: '',
            rawAuthority: seed.rawAuthority,
        });
    }
    return result;
}

function dedupeEntries(entries: RecentEntry[]): RecentEntry[] {
    const seen = new Set<string>();
    const result: RecentEntry[] = [];
    for (const e of entries) {
        const key = `${e.entryType}::${(e.rawAuthority ?? '').toLowerCase()}::${e.fullPath}`;
        if (seen.has(key)) { continue; }
        seen.add(key);
        result.push(e);
    }
    return result;
}

function authorityFromMetaOrUri(obj: Record<string, unknown>, baseUri: vscode.Uri): string | undefined {
    const meta = typeof obj['remoteAuthority'] === 'string'
        ? (obj['remoteAuthority'] as string)
        : undefined;
    if (meta) { return meta; }
    // Fallback: VS Code recent sometimes stores the authority on the URI itself
    // (vscode-remote://wsl+distro/...) without populating the metadata field.
    if (baseUri.scheme === 'vscode-remote' && baseUri.authority) {
        return baseUri.authority;
    }
    return undefined;
}

export async function loadAndClassify(): Promise<RecentEntry[]> {
    const result = await vscode.commands.executeCommand('_workbench.getRecentlyOpened');

    const raw = result as Record<string, unknown> | undefined;
    if (!raw) { return []; }

    const entries: RecentEntry[] = [];

    const workspaces = (raw['workspaces'] as unknown[]) ?? [];
    for (const item of workspaces) {
        if (!item || typeof item !== 'object') { continue; }
        const obj = item as Record<string, unknown>;

        let baseUri: vscode.Uri | undefined;
        let entryType: EntryType = 'folder';

        if (obj['folderUri'] !== undefined) {
            baseUri = toUri(obj['folderUri']);
            entryType = 'folder';
        } else if (obj['workspace'] !== undefined) {
            const ws = obj['workspace'] as Record<string, unknown>;
            baseUri = toUri(ws['configPath']);
            entryType = 'workspace';
        }

        if (!baseUri) { continue; }

        const remoteAuthority = authorityFromMetaOrUri(obj, baseUri);

        const { kind, hostLabel, hostPath, parentKind, parentHostLabel } = classifyAuthority(remoteAuthority);
        const entryUri = buildEntryUri(baseUri, remoteAuthority);
        const displayName = displayNameFor(baseUri.path, entryType);

        entries.push({
            kind,
            hostLabel,
            parentKind,
            parentHostLabel,
            uri: entryUri,
            entryType,
            displayName,
            fullPath: baseUri.path,
            hostPath,
            rawAuthority: remoteAuthority,
        });
    }

    const files = (raw['files'] as unknown[]) ?? [];
    for (const item of files) {
        if (!item || typeof item !== 'object') { continue; }
        const obj = item as Record<string, unknown>;

        const baseUri = toUri(obj['fileUri']);
        if (!baseUri) { continue; }

        const remoteAuthority = authorityFromMetaOrUri(obj, baseUri);

        const { kind, hostLabel, hostPath, parentKind, parentHostLabel } = classifyAuthority(remoteAuthority);
        const entryUri = buildEntryUri(baseUri, remoteAuthority);
        const displayName = basename(baseUri.path) || baseUri.path;

        entries.push({
            kind,
            hostLabel,
            parentKind,
            parentHostLabel,
            uri: entryUri,
            entryType: 'file',
            displayName,
            fullPath: baseUri.path,
            hostPath,
            rawAuthority: remoteAuthority,
        });
    }

    const deduped = dedupeEntries(entries);
    deduped.push(...buildConnectionEntries(deduped));

    return deduped;
}
