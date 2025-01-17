import { GlobalConfigurationStore } from '@nx-console/vscode/configuration';
import { revealNxProject } from '@nx-console/vscode/nx-workspace';
import { CliTaskProvider } from '@nx-console/vscode/tasks';
import { AbstractTreeProvider } from '@nx-console/vscode/utils';
import {
  commands,
  ExtensionContext,
  ProviderResult,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
} from 'vscode';
import {
  createListViewStrategy,
  createTreeViewStrategy,
  ListViewStrategy,
  TreeViewStrategy,
} from './views';
import { ListViewItem, ViewItem } from './views/nx-project-base-view';

/**
 * Provides data for the "Projects" tree view
 */
export class NxProjectTreeProvider extends AbstractTreeProvider<NxTreeItem> {
  private readonly listView: ListViewStrategy;
  private readonly treeView: TreeViewStrategy;

  constructor(
    context: ExtensionContext,
    private readonly cliTaskProvider: CliTaskProvider
  ) {
    super();

    (
      [
        ['editWorkspaceJson', this.editWorkspaceJson],
        ['revealInExplorer', this.revealInExplorer],
        ['runTask', this.runTask],
        ['refreshNxProjectsTree', this.refreshNxProjectsTree],
      ] as const
    ).forEach(([commandSuffix, callback]) => {
      context.subscriptions.push(
        commands.registerCommand(`nxConsole.${commandSuffix}`, callback, this)
      );
    });

    this.listView = createListViewStrategy(this.cliTaskProvider);
    this.treeView = createTreeViewStrategy(this.cliTaskProvider);
  }

  getParent() {
    // not implemented, because the reveal API is not needed for the projects view
    return null;
  }

  getChildren(element?: NxTreeItem): ProviderResult<NxTreeItem[]> {
    return this.getViewChildren(element?.item).then((items) => {
      if (!items) return [];
      return items.map((item) => new NxTreeItem(item));
    });
  }

  private async getViewChildren(viewItem?: ViewItem) {
    if (this.isListViewElement(viewItem)) {
      return this.listView.getChildren(viewItem);
    }
    return this.treeView.getChildren(viewItem);
  }

  private isListViewElement(_?: ViewItem): _ is ListViewItem {
    const config = GlobalConfigurationStore.instance.get('projectViewingStyle');
    return config === 'list' || config === null;
  }

  private async runTask(selection: NxTreeItem) {
    const viewItem = selection.item;
    if (
      viewItem.contextValue === 'project' ||
      viewItem.contextValue === 'folder'
    ) {
      // can not run a task on a project
      return;
    }
    const { project } = viewItem.nxProject;
    const target = viewItem.nxTarget;

    const flags = [];
    if (target.configuration) {
      flags.push(`--configuration=${target.configuration}`);
    }

    this.cliTaskProvider.executeTask({
      command: target.name,
      positional: project,
      flags,
    });
  }

  private async revealInExplorer(selection: NxTreeItem) {
    if (selection.resourceUri) {
      commands.executeCommand('revealInExplorer', selection.resourceUri);
    }
  }

  private async editWorkspaceJson(selection: NxTreeItem) {
    const viewItem = selection.item;
    if (viewItem.contextValue === 'folder') {
      return;
    }

    const { project, root } = viewItem.nxProject;
    if (viewItem.contextValue === 'project') {
      return revealNxProject(project, root);
    }
    const target = viewItem.nxTarget;
    return revealNxProject(project, root, target);
  }

  private async refreshNxProjectsTree() {
    this.refresh();
  }
}

export class NxTreeItem extends TreeItem {
  constructor(public readonly item: ViewItem) {
    super(item.label, TreeItemCollapsibleState[item.collapsible]);
    this.contextValue = item.contextValue;
    if (item.contextValue === 'folder' || item.contextValue === 'project') {
      this.resourceUri = Uri.file(item.resource);
    }
  }
}
