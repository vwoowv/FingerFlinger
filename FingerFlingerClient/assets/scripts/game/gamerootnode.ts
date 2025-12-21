import { _decorator, Component, Node } from 'cc';
import { PoolManager } from '../utility/resource/poolmanager';
import { DEFAULT_PREFAB_BUNDLE_NAME, DEFAULT_PREFAB_PATHS } from '../entry/gamepreloader';
const { ccclass, property } = _decorator;

@ccclass('GameRootNode')
export class GameRootNode extends Component {
    /** 맵 프리팹이 들어있는 번들 이름 */
    @property
    private readonly mapPrefabBundleName = DEFAULT_PREFAB_BUNDLE_NAME;

    /** 로드/인스턴스화할 맵 프리팹 경로(확장자 제외) */
    @property
    private readonly mapPrefabPath = DEFAULT_PREFAB_PATHS[0] ?? '';

    private mapNode: Node | null = null;

    start() {
        void this.loadAndAttachMap();
    }

    protected onDestroy(): void {
        // 씬 종료 시 현재 맵을 풀로 반납
        const pm = PoolManager.instance;
        if (pm && this.mapNode?.isValid) {
            pm.despawn(this.mapNode);
        }
        this.mapNode = null;
    }

    private async loadAndAttachMap(): Promise<void> {
        try {
            const bundleName = (this.mapPrefabBundleName ?? '').trim() || DEFAULT_PREFAB_BUNDLE_NAME;
            const path = (this.mapPrefabPath ?? '').trim();
            if (!path) {
                console.error('[GameRootNode] mapPrefabPath is empty.');
                return;
            }

            const pm = PoolManager.instance;
            if (!pm) {
                console.error('[GameRootNode] PoolManager.instance is null. Ensure PoolManager exists/persists.');
                return;
            }

            // 기존 맵이 있으면 먼저 회수
            if (this.mapNode?.isValid) {
                pm.despawn(this.mapNode);
                this.mapNode = null;
            }

            // PoolManager만으로 로드 + 풀 스폰 (실패 시 로그 남기고 종료)
            let spawned: Node;
            try {
                spawned = await pm.spawn(bundleName, path, this.node);
            } catch (e) {
                console.error('[GameRootNode] failed to spawn map via PoolManager.', { bundleName, path, error: e });
                return;
            }

            const safePathLabel = path.split('/').join('_').split('\\').join('_');
            spawned.name = `Map(${safePathLabel})`;
            this.mapNode = spawned;
        } catch (e) {
            console.error('[GameRootNode] failed to load/attach map prefab.', e);
        }
    }
}
