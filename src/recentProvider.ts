import * as vscode from 'vscode';
import { EntryType, RecentEntry, RemoteKind } from './types';
import { loadAndClassify } from './recent';

const KIND_ORDER: RemoteKind[] = ['tunnel', 'wsl', 'devcontainer', 'ssh', 'local', 'other'];

const KIND_LABEL: Record<RemoteKind, string> = {
    tunnel: 'Tunnel',
    wsl: 'WSL',
    devcontainer: 'Dev Container',
    ssh: 'SSH',
    local: 'Local',
    other: 'Other',
};

export const KIND_ICON: Record<RemoteKind, string> = {
    tunnel: 'radio-tower',
    wsl: 'terminal-linux',
    devcontainer: 'package',
    ssh: 'key',
    local: 'device-desktop',
    other: 'question',
};

const ENTRY_ICON: Partial<Record<EntryType, string>> = {
    folder: 'folder-opened',
    workspace: 'files',
    connection: 'plug',
};

export type GroupMode = 'remote' | 'type';

export type Node = TypeGroupNode | RemoteGroupNode | HostPathGroupNode | EntryNode;

export class TypeGroupNode extends vscode.TreeItem {
    readonly children: RemoteGroupNode[];

    constructor(label: string, children: RemoteGroupNode[]) {
        super(label, vscode.TreeItemCollapsibleState.Expanded);
        this.children = children;
        this.contextValue = 'typeGroup';
    }
}

export class RemoteGroupNode extends vscode.TreeItem {
    readonly entries: RecentEntry[];
    readonly nestedGroups: RemoteGroupNode[];
    readonly isNested: boolean;

    constructor(
        kind: RemoteKind,
        hostLabel: string | undefined,
        entries: RecentEntry[],
        nestedGroups: RemoteGroupNode[] = [],
        opts: { isNested?: boolean; itemCount?: number } = {}
    ) {
        const baseLabel = hostLabel
            ? `${KIND_LABEL[kind]} (${hostLabel})`
            : KIND_LABEL[kind];
        super(baseLabel, vscode.TreeItemCollapsibleState.Expanded);
        this.entries = entries;
        this.nestedGroups = nestedGroups;
        this.isNested = opts.isNested ?? false;
        this.contextValue = this.isNested ? 'nestedGroup' : 'group';
        this.iconPath = new vscode.ThemeIcon(KIND_ICON[kind]);
        if (opts.itemCount !== undefined) {
            this.description = `${opts.itemCount} item${opts.itemCount === 1 ? '' : 's'}`;
        }
    }
}

export class HostPathGroupNode extends vscode.TreeItem {
    readonly entries: RecentEntry[];

    constructor(hostPath: string, entries: RecentEntry[], opts: { inDevContainer?: boolean } = {}) {
        const label = basename(hostPath) || hostPath;
        super(label, vscode.TreeItemCollapsibleState.Expanded);
        this.description = hostPath !== label ? hostPath : undefined;
        this.tooltip = hostPath;
        this.entries = entries;
        this.contextValue = 'hostPathGroup';
        this.iconPath = new vscode.ThemeIcon(opts.inDevContainer ? 'package' : 'repo');
    }
}

export class EntryNode extends vscode.TreeItem {
    readonly entry: RecentEntry;

    constructor(entry: RecentEntry) {
        super(entry.displayName, vscode.TreeItemCollapsibleState.None);
        this.entry = entry;
        this.description = describeEntry(entry);
        this.tooltip = buildTooltip(entry);
        this.contextValue = entry.entryType === 'connection' ? 'connectionEntry' : 'entry';
        this.iconPath = iconForEntry(entry);
        if (entry.entryType === 'file' || entry.entryType === 'folder') {
            this.resourceUri = entry.uri;
        }
        this.command = {
            command: 'recentByRemote.openEntry',
            title: 'Open',
            arguments: [this],
        };
    }
}

function iconForEntry(entry: RecentEntry): vscode.ThemeIcon {
    if (entry.entryType === 'file') { return vscode.ThemeIcon.File; }
    const id = ENTRY_ICON[entry.entryType];
    return id ? new vscode.ThemeIcon(id) : vscode.ThemeIcon.File;
}

function dirnameOf(p: string): string {
    const idx = p.lastIndexOf('/');
    return idx > 0 ? p.substring(0, idx) : '';
}

function isWindowsStylePath(p: string): boolean {
    return p.startsWith('\\\\') || /^[A-Za-z]:[\\/]/.test(p);
}

function basename(p: string): string {
    const sep = isWindowsStylePath(p) ? /[\\/]/ : /\//;
    const parts = p.split(sep).filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : p;
}

function relativeWithinHost(hostPath: string, fullPath: string, isFile: boolean): string | undefined {
    if (fullPath === hostPath) { return ''; }
    if (fullPath.startsWith(hostPath + '/')) {
        const rest = fullPath.substring(hostPath.length + 1);
        if (isFile) {
            const dir = dirnameOf(rest);
            return dir ? `${dir}/` : '';
        }
        return rest;
    }
    return undefined;
}

function describeEntry(entry: RecentEntry): string | undefined {
    if (entry.entryType === 'connection') {
        return undefined;
    }
    if (entry.hostPath) {
        const rel = relativeWithinHost(entry.hostPath, entry.fullPath, entry.entryType === 'file');
        if (rel !== undefined) { return rel || undefined; }
    }
    if (entry.entryType === 'file') {
        return dirnameOf(entry.fullPath) || entry.fullPath;
    }
    return entry.fullPath;
}

type BadgeColor = 'default' | 'route' | 'parent';

const BADGE_PALETTE: Record<BadgeColor, { bg: string; fg: string }> = {
    default: {
        bg: 'var(--vscode-badge-background)',
        fg: 'var(--vscode-badge-foreground)',
    },
    route: {
        bg: 'var(--vscode-charts-blue)',
        fg: 'var(--vscode-editor-background)',
    },
    parent: {
        bg: 'var(--vscode-charts-green)',
        fg: 'var(--vscode-editor-background)',
    },
};

function escapeHtml(s: string): string {
    return s.replace(/[<>&"']/g, c => ({
        '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;',
    }[c]!));
}

function htmlBadge(text: string, color: BadgeColor = 'default'): string {
    const c = BADGE_PALETTE[color];
    return `<span style="background-color:${c.bg};color:${c.fg};padding:1px 6px;border-radius:3px;">${escapeHtml(text)}</span>`;
}

function htmlMonoWrap(text: string): string {
    return `<span style="font-family: var(--vscode-editor-font-family, monospace); word-break: break-all;">${escapeHtml(text)}</span>`;
}

function routeText(kind: RemoteKind, hostLabel?: string): string {
    const label = KIND_LABEL[kind] ?? kind;
    return hostLabel ? `${label}: ${hostLabel}` : label;
}

function entryTypeText(entry: RecentEntry): string {
    switch (entry.entryType) {
        case 'workspace': return 'Workspace';
        case 'folder': return 'Folder';
        case 'file': return 'File';
        case 'connection': return 'Connection only';
    }
}

function buildTooltip(entry: RecentEntry): vscode.MarkdownString {
    const md = new vscode.MarkdownString(undefined, true);
    md.isTrusted = false;
    md.supportThemeIcons = true;
    md.supportHtml = true;

    const badges: string[] = [];
    badges.push(htmlBadge(entryTypeText(entry), 'default'));
    // For devcontainer kind, skip hostLabel (its `via X:Y` form duplicates the parent badge).
    // Route info comes from parentKind/parentHostLabel below.
    const routeBadgeText = entry.kind === 'devcontainer'
        ? (KIND_LABEL[entry.kind] ?? entry.kind)
        : routeText(entry.kind, entry.hostLabel);
    badges.push(htmlBadge(routeBadgeText, 'route'));
    if (entry.kind === 'devcontainer' && entry.parentKind && entry.parentKind !== 'local') {
        badges.push(htmlBadge('via ' + routeText(entry.parentKind, entry.parentHostLabel), 'parent'));
    }
    md.appendMarkdown(badges.join(' ') + '\n\n');

    md.appendMarkdown('**uri**\n\n');
    md.appendMarkdown(htmlMonoWrap(entry.uri.toString()) + '\n\n');
    if (entry.hostPath) {
        md.appendMarkdown('**host**\n\n');
        md.appendMarkdown(htmlMonoWrap(entry.hostPath) + '\n\n');
    }
    if (entry.fullPath) {
        md.appendMarkdown('**path**\n\n');
        md.appendMarkdown(htmlMonoWrap(entry.fullPath) + '\n\n');
    }
    return md;
}

const ENTRY_TYPE_RANK: Record<EntryType, number> = {
    workspace: 0,
    folder: 0,
    file: 1,
    connection: 2,
};

function sortEntriesWithinGroup(entries: RecentEntry[]): RecentEntry[] {
    return entries
        .map((entry, index) => ({ entry, index }))
        .sort((a, b) => {
            const rankDiff = ENTRY_TYPE_RANK[a.entry.entryType] - ENTRY_TYPE_RANK[b.entry.entryType];
            if (rankDiff !== 0) { return rankDiff; }
            return a.index - b.index;
        })
        .map(({ entry }) => entry);
}

function buildRemoteGroupChildren(entries: RecentEntry[], opts: { inDevContainer?: boolean } = {}): Node[] {
    const byHostPath = new Map<string, RecentEntry[]>();
    const order: string[] = [];
    const flat: RecentEntry[] = [];
    for (const e of entries) {
        if (e.hostPath) {
            if (!byHostPath.has(e.hostPath)) {
                byHostPath.set(e.hostPath, []);
                order.push(e.hostPath);
            }
            byHostPath.get(e.hostPath)!.push(e);
        } else {
            flat.push(e);
        }
    }
    const result: Node[] = [];
    for (const hostPath of order) {
        result.push(new HostPathGroupNode(
            hostPath,
            sortEntriesWithinGroup(byHostPath.get(hostPath)!),
            { inDevContainer: opts.inDevContainer }
        ));
    }
    for (const e of flat) {
        result.push(new EntryNode(e));
    }
    return result;
}

export class RecentWorkspacesProvider implements vscode.TreeDataProvider<Node> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<Node | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private mode: GroupMode = 'remote';

    getMode(): GroupMode {
        return this.mode;
    }

    setMode(mode: GroupMode): void {
        if (this.mode === mode) { return; }
        this.mode = mode;
        this._onDidChangeTreeData.fire(undefined);
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: Node): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: Node): Promise<Node[]> {
        if (!element) {
            const entries = await loadAndClassify();
            if (this.mode === 'type') {
                return this.buildTypeGroups(entries);
            }
            return this.buildRemoteGroups(entries);
        }
        if (element instanceof TypeGroupNode) {
            return element.children;
        }
        if (element instanceof RemoteGroupNode) {
            const directChildren = buildRemoteGroupChildren(element.entries, { inDevContainer: element.isNested });
            return [
                ...directChildren,
                ...element.nestedGroups,
            ];
        }
        if (element instanceof HostPathGroupNode) {
            return element.entries.map(e => new EntryNode(e));
        }
        return [];
    }

    private buildTypeGroups(entries: RecentEntry[]): TypeGroupNode[] {
        const wsEntries = entries.filter(e => e.entryType === 'folder' || e.entryType === 'workspace' || e.entryType === 'connection');
        const fileEntries = entries.filter(e => e.entryType === 'file');
        const groups: TypeGroupNode[] = [];
        if (wsEntries.length > 0) {
            groups.push(new TypeGroupNode('Workspaces & Folders', this.buildRemoteGroups(wsEntries)));
        }
        if (fileEntries.length > 0) {
            groups.push(new TypeGroupNode('Files', this.buildRemoteGroups(fileEntries)));
        }
        return groups;
    }

    private buildRemoteGroups(entries: RecentEntry[]): RemoteGroupNode[] {
        type Bucket = {
            kind: RemoteKind;
            hostLabel?: string;
            directEntries: RecentEntry[];
            devContainers: RecentEntry[];
        };
        const map = new Map<string, Bucket>();

        const getBucket = (kind: RemoteKind, hostLabel: string | undefined): Bucket => {
            const key = `${kind}::${(hostLabel ?? '').toLowerCase()}`;
            let bucket = map.get(key);
            if (!bucket) {
                bucket = { kind, hostLabel, directEntries: [], devContainers: [] };
                map.set(key, bucket);
            }
            return bucket;
        };

        for (const entry of entries) {
            if (entry.kind === 'devcontainer') {
                const parentKind = entry.parentKind ?? 'local';
                const bucket = getBucket(parentKind, entry.parentHostLabel);
                bucket.devContainers.push(entry);
            } else {
                const bucket = getBucket(entry.kind, entry.hostLabel);
                bucket.directEntries.push(entry);
            }
        }

        const groups: RemoteGroupNode[] = [];
        for (const kind of KIND_ORDER) {
            for (const [, bucket] of map) {
                if (bucket.kind !== kind) { continue; }
                const nestedGroups: RemoteGroupNode[] = [];
                if (bucket.devContainers.length > 0) {
                    nestedGroups.push(new RemoteGroupNode(
                        'devcontainer',
                        undefined,
                        sortEntriesWithinGroup(bucket.devContainers),
                        [],
                        { isNested: true, itemCount: bucket.devContainers.length }
                    ));
                }
                groups.push(new RemoteGroupNode(
                    bucket.kind,
                    bucket.hostLabel,
                    sortEntriesWithinGroup(bucket.directEntries),
                    nestedGroups
                ));
            }
        }

        return groups;
    }
}
