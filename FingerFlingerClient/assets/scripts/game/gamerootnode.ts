import { _decorator, Component, Node } from 'cc';
import { ResourceManager } from '../utility/resource/resourcemanager';
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
            const rm = ResourceManager.instance;
            if (!rm) {
                console.error('[GameRootNode] ResourceManager.instance is null. Ensure ResourceManager persists from entry scene.');
                return;
            }

            const bundleName = (this.mapPrefabBundleName ?? '').trim() || DEFAULT_PREFAB_BUNDLE_NAME;
            const path = (this.mapPrefabPath ?? '').trim();
            if (!path) {
                console.error('[GameRootNode] mapPrefabPath is empty.');
                return;
            }

            const pm = PoolManager.instance;
            const poolKey = `${bundleName}::${path}`;

            // 기존 맵이 있으면 먼저 회수
            if (this.mapNode?.isValid) {
                pm ? pm.despawn(this.mapNode) : this.mapNode.destroy();
                this.mapNode = null;
            }

            // 풀 매니저가 있으면: loadPrefab + spawnFromPrefab로 명시적으로 풀링
            // 없으면: 기존대로 instantiatePrefab 폴백
            const spawned = pm
                ? pm.spawnFromPrefab(poolKey, await rm.loadPrefab(bundleName, path), this.node)
                : await rm.instantiatePrefab(bundleName, path, this.node);

            const safePathLabel = path.split('/').join('_').split('\\').join('_');
            spawned.name = `Map(${safePathLabel})`;
            this.mapNode = spawned;
        } catch (e) {
            console.error('[GameRootNode] failed to load/attach map prefab.', e);
        }
    }
}
