import { _decorator, Component, director, instantiate, Node, NodePool, Prefab } from 'cc';
import { PooledObject } from './pooledobject';
import { ResourceManager } from './resourcemanager';
const { ccclass } = _decorator;

@ccclass('PoolManager')
export class PoolManager extends Component {
    private static instanceRef: PoolManager | null = null;

    /** 풀에 들어간 노드들을 임시로 붙여둘 루트(계층 정리용) */
    private poolRoot: Node | null = null;

    /** poolKey -> NodePool */
    private readonly pools = new Map<string, NodePool>();

    public onLoad() {
        if (PoolManager.instanceRef && PoolManager.instanceRef !== this) {
            this.node.destroy();
            return;
        }
        PoolManager.instanceRef = this;
        director.addPersistRootNode(this.node);

        // 풀 보관용 루트 노드 생성(씬에서 안 보이게)
        if (!this.poolRoot?.isValid) {
            this.poolRoot = new Node('__PoolRoot__');
            this.poolRoot.active = false;
            this.poolRoot.parent = this.node;
        }
    }

    public onDestroy() {
        if (PoolManager.instanceRef === this) PoolManager.instanceRef = null;
        this.clearAll(true);
    }

    public static get instance(): PoolManager | null {
        return PoolManager.instanceRef;
    }

    private ensurePool(poolKey: string): NodePool {
        const key = (poolKey ?? '').trim();
        if (!key) throw new Error('[PoolManager] poolKey is empty.');
        const existing = this.pools.get(key);
        if (existing) return existing;
        const pool = new NodePool();
        this.pools.set(key, pool);
        return pool;
    }

    private makePoolKey(bundleName: string, path: string): string {
        const b = (bundleName ?? '').trim();
        const p = (path ?? '').trim();
        if (!b) throw new Error('[PoolManager] bundleName is empty.');
        if (!p) throw new Error('[PoolManager] path is empty.');
        return `${b}::${p}`;
    }

    /**
     * ResourceManager를 내부에서 사용해 (bundleName, path)만으로 로드 + 풀 스폰
     * - 호출부에서 ResourceManager를 따로 부르지 않아도 됨
     */
    public async spawn(bundleName: string, path: string, parent?: Node,
        onProgress?: (finished: number, total: number, item?: any) => void
    ): Promise<Node> {
        const rm = ResourceManager.instance;
        if (!rm) throw new Error('[PoolManager] ResourceManager.instance is null. Ensure ResourceManager exists.');
        const key = this.makePoolKey(bundleName, path);
        const prefab = await rm.loadPrefab(bundleName, path, onProgress);
        return this.spawnFromPrefab(key, prefab, parent);
    }

    /**
     * (prefab + key) 기반 스폰
     * - 풀에 있으면 재사용
     * - 없으면 instantiate(prefab)
     */
    public spawnFromPrefab(poolKey: string, prefab: Prefab, parent?: Node): Node {
        const pool = this.ensurePool(poolKey);
        const node = pool.size() > 0 ? pool.get() : instantiate(prefab);

        // 풀 키 메타데이터(회수 시 필요)
        const meta = node.getComponent(PooledObject) ?? node.addComponent(PooledObject);
        meta.poolKey = poolKey;

        node.active = true;
        parent && (node.parent = parent);

        // 스폰 훅(선택)
        meta.onSpawned();
        return node;
    }

    /**
     * 노드 회수
     * - PooledObject.poolKey가 있으면 해당 풀로 put
     * - 없으면 기본은 destroy(옵션으로 그냥 비활성화만 할 수도 있음)
     */
    public despawn(node: Node | null | undefined, options?: { destroyIfUnpooled?: boolean }): void {
        if (!node?.isValid) return;

        const destroyIfUnpooled = options?.destroyIfUnpooled ?? true;
        const meta = node.getComponent(PooledObject);
        const poolKey = (meta?.poolKey ?? '').trim();

        if (!poolKey) {
            if (destroyIfUnpooled) {
                node.destroy();
            } else {
                node.removeFromParent();
                node.active = false;
            }
            return;
        }

        const pool = this.ensurePool(poolKey);

        // 회수 훅(선택)
        meta?.onDespawned();

        // 안전 처리: 부모에서 떼고 비활성화 후 보관
        node.removeFromParent();
        node.active = false;
        this.poolRoot?.isValid && (node.parent = this.poolRoot);
        pool.put(node);
    }

    /** 해당 풀을 비움(노드 destroy 여부 선택) */
    public clear(poolKey: string, destroyNodes: boolean = true): void {
        const key = (poolKey ?? '').trim();
        const pool = this.pools.get(key);
        if (!pool) return;

        if (destroyNodes) pool.clear();
        else {
            // NodePool은 내부 노드를 노출하지 않아서, destroy=false는 실질적으로 "참조만 제거"가 불가.
            // 안전하게 clear()로 정리하는 쪽을 권장.
            pool.clear();
        }
        this.pools.delete(key);
    }

    public clearAll(destroyNodes: boolean = true): void {
        for (const key of this.pools.keys()) {
            this.clear(key, destroyNodes);
        }
        this.pools.clear();
    }

    /** 미리 생성해 두기(프레임 스파이크 완화) */
    public prewarmFromPrefab(poolKey: string, prefab: Prefab, count: number): void {
        const n = Math.max(0, Math.floor(count || 0));
        if (n <= 0) return;
        const pool = this.ensurePool(poolKey);
        for (let i = 0; i < n; i++) {
            const node = instantiate(prefab);
            const meta = node.getComponent(PooledObject) ?? node.addComponent(PooledObject);
            meta.poolKey = poolKey;
            node.active = false;
            this.poolRoot?.isValid && (node.parent = this.poolRoot);
            pool.put(node);
        }
    }
}
