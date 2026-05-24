import * as vscode from 'vscode';
import { RecentWorkspacesProvider, EntryNode, GroupMode, KIND_ICON } from './recentProvider';
import { loadAndClassify } from './recent';
import { RecentEntry } from './types';

const GROUP_MODE_KEY = 'recentByRemote.groupMode';
const GROUP_MODE_CONTEXT = 'recentByRemote.groupMode';

interface OpenOptions {
    newWindow?: boolean;
}

function getCurrentAuthority(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
        return folders[0].uri.authority || undefined;
    }
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        return editor.document.uri.authority || undefined;
    }
    return undefined;
}

function authoritiesMatch(a: string | undefined, b: string | undefined): boolean {
    return (a ?? '').toLowerCase() === (b ?? '').toLowerCase();
}

function dirnameOfPath(p: string): string {
    const idx = p.lastIndexOf('/');
    return idx > 0 ? p.substring(0, idx) : '/';
}

async function openEntry(entry: RecentEntry, opts: OpenOptions = {}): Promise<void> {
    const newWindow = opts.newWindow ?? false;

    if (entry.entryType === 'connection') {
        await vscode.commands.executeCommand('vscode.newWindow', {
            remoteAuthority: entry.rawAuthority,
            reuseWindow: !newWindow,
        });
        return;
    }

    const openable = entry.entryType === 'file'
        ? { fileUri: entry.uri }
        : entry.entryType === 'workspace'
            ? { workspaceUri: entry.uri }
            : { folderUri: entry.uri };

    try {
        await vscode.commands.executeCommand('_files.windowOpen', [openable], {
            forceNewWindow: newWindow,
        });
        return;
    } catch {
        // Internal command unavailable (web build, future API change). Fall through.
    }

    await openEntryViaPublicApi(entry, newWindow);
}

async function openEntryViaPublicApi(entry: RecentEntry, newWindow: boolean): Promise<void> {
    const sameAuth = authoritiesMatch(entry.rawAuthority, getCurrentAuthority());

    if (entry.entryType === 'file') {
        if (sameAuth && !newWindow) {
            await vscode.commands.executeCommand('vscode.open', entry.uri);
            return;
        }
        const parentUri = entry.uri.with({ path: dirnameOfPath(entry.uri.path) });
        await vscode.commands.executeCommand('vscode.openFolder', parentUri, {
            forceNewWindow: newWindow || !sameAuth,
            forceReuseWindow: !newWindow && sameAuth,
        });
        return;
    }

    await vscode.commands.executeCommand('vscode.openFolder', entry.uri, {
        forceNewWindow: newWindow || !sameAuth,
        forceReuseWindow: !newWindow && sameAuth,
    });
}

interface RecentQuickPickItem extends vscode.QuickPickItem {
    entry: RecentEntry;
}

async function showOpenQuickPick(): Promise<void> {
    const entries = await loadAndClassify();
    const newWindowButton: vscode.QuickInputButton = {
        iconPath: new vscode.ThemeIcon('empty-window'),
        tooltip: 'Open in New Window',
    };

    const items: RecentQuickPickItem[] = entries.map(e => ({
        label: `$(${KIND_ICON[e.kind]}) [${e.kind}${e.hostLabel ? ':' + e.hostLabel : ''}] ${e.displayName}`,
        description: e.entryType === 'connection' ? undefined : (e.hostPath ?? e.fullPath),
        entry: e,
        buttons: [newWindowButton],
    }));

    const qp = vscode.window.createQuickPick<RecentQuickPickItem>();
    qp.items = items;
    qp.matchOnDescription = true;
    qp.placeholder = 'Select a recent workspace or file (use the icon to open in a new window)';

    qp.onDidTriggerItemButton(async event => {
        qp.hide();
        await openEntry(event.item.entry, { newWindow: true });
    });

    qp.onDidAccept(async () => {
        const picked = qp.selectedItems[0];
        qp.hide();
        if (picked) {
            await openEntry(picked.entry);
        }
    });

    qp.onDidHide(() => qp.dispose());
    qp.show();
}

async function dumpRawRecentlyOpened(): Promise<void> {
    const raw = await vscode.commands.executeCommand<unknown>('_workbench.getRecentlyOpened');
    const decoded = decorateRaw(raw);
    const doc = await vscode.workspace.openTextDocument({
        language: 'json',
        content: JSON.stringify(decoded, null, 2),
    });
    await vscode.window.showTextDocument(doc, { preview: false });
}

function decorateRaw(raw: unknown): unknown {
    if (!raw || typeof raw !== 'object') { return raw; }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (Array.isArray(v)) {
            out[k] = v.map(item => decorateItem(item));
        } else {
            out[k] = v;
        }
    }
    return out;
}

function decorateItem(item: unknown): unknown {
    if (!item || typeof item !== 'object') { return item; }
    const entry = { ...(item as Record<string, unknown>) };
    for (const key of ['folderUri', 'workspaceUri', 'fileUri']) {
        const uri = entry[key];
        if (typeof uri !== 'string') { continue; }
        const decoded = tryDecodeAuthority(uri);
        if (decoded) {
            entry[`_decoded_${key}`] = decoded;
        }
    }
    if (entry['workspace'] && typeof entry['workspace'] === 'object') {
        entry['workspace'] = decorateItem(entry['workspace']);
    }
    return entry;
}

function tryDecodeAuthority(uriStr: string): unknown {
    try {
        const u = vscode.Uri.parse(uriStr);
        if (!u.authority) { return undefined; }
        const m = u.authority.match(/^(dev-container|attached-container)\+([0-9a-fA-F]+)(?:@(.+))?$/);
        if (!m) { return { authority: u.authority }; }
        const hex = m[2];
        const decoded = Buffer.from(hex, 'hex').toString('utf8');
        let parsed: unknown = decoded;
        try { parsed = JSON.parse(decoded); } catch { /* keep string */ }
        return {
            kindPrefix: m[1],
            hexDecoded: parsed,
            atSuffix: m[3],
            path: u.path,
        };
    } catch {
        return undefined;
    }
}

export function activate(context: vscode.ExtensionContext): void {
    const provider = new RecentWorkspacesProvider();

    const initialMode = context.globalState.get<GroupMode>(GROUP_MODE_KEY, 'remote');
    provider.setMode(initialMode);
    void vscode.commands.executeCommand('setContext', GROUP_MODE_CONTEXT, initialMode);

    const applyMode = async (mode: GroupMode): Promise<void> => {
        provider.setMode(mode);
        await context.globalState.update(GROUP_MODE_KEY, mode);
        await vscode.commands.executeCommand('setContext', GROUP_MODE_CONTEXT, mode);
    };

    const treeView = vscode.window.createTreeView('recentByRemote.tree', {
        treeDataProvider: provider,
        showCollapseAll: true,
    });

    context.subscriptions.push(treeView);

    context.subscriptions.push(
        vscode.commands.registerCommand('recentByRemote.refresh', () => {
            provider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('recentByRemote.groupByType', () => applyMode('type'))
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('recentByRemote.groupByRemote', () => applyMode('remote'))
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('recentByRemote.toggleGroupMode', () =>
            applyMode(provider.getMode() === 'remote' ? 'type' : 'remote')
        )
    );

    const resolveTarget = (node: EntryNode | undefined): EntryNode | undefined => {
        if (node) {
            return node;
        }
        // Keybinding invocations don't pass an argument; fall back to the current selection.
        return treeView.selection.find((n): n is EntryNode => n instanceof EntryNode);
    };

    context.subscriptions.push(
        vscode.commands.registerCommand('recentByRemote.openEntry', async (node?: EntryNode) => {
            const target = resolveTarget(node);
            if (target) {
                await openEntry(target.entry);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('recentByRemote.openEntryInNewWindow', async (node?: EntryNode) => {
            const target = resolveTarget(node);
            if (target) {
                await openEntry(target.entry, { newWindow: true });
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('recentByRemote.removeEntry', async (node: EntryNode) => {
            await vscode.commands.executeCommand(
                'vscode.removeFromRecentlyOpened',
                node.entry.uri
            );
            provider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('recentByRemote.open', () => showOpenQuickPick())
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('recentByRemote.dumpRaw', () => dumpRawRecentlyOpened())
    );

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('recentByRemote.clickAction')) {
                provider.refresh();
            }
        })
    );
}

export function deactivate(): void {}
