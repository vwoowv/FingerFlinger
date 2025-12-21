import { _decorator, Component, instantiate, director, Asset, AssetManager, assetManager, AudioClip, Prefab, TextAsset, Texture2D, Node } from 'cc';
const { ccclass } = _decorator;

/** Asset 생성자 타입(예: Texture2D, AudioClip, TextAsset, Prefab 등) */
export type AssetConstructor<T extends Asset> = new (...args: any[]) => T;

/**
 * 프리로드 요청 형식
 * - 일반 리소스는 `kind: 'asset'` + `type`(선택)
 * - 프리팹은 `kind: 'prefab'` (type 자동 Prefab)
 */
export type ResourcePreloadRequest = { kind?: 'asset'; path: string; type?: AssetConstructor<Asset> } | { kind: 'prefab'; path: string };

@ccclass('ResourceManager')
export class ResourceManager extends Component {
    /**
     * 번들 기반 리소스 로더 + 캐시.
     * - 번들은 `assetManager.loadBundle`로 로드 후 캐싱
     * - 리소스는 (bundleName + path + type) 키로 캐싱
     * - 동일 키 동시 로딩은 in-flight Promise로 디듀프
     * - 프리팹은 별도 메서드(`loadPrefab`, `instantiatePrefab`)로 제공
     * - 리스트 프리로드(`preloadList`) 지원: 런타임 로딩 스파이크 완화 목적
     */

    private static _instance: ResourceManager | null = null;

    /** 번들 캐시 */
    private readonly bundleCache = new Map<string, AssetManager.Bundle>();
    /** 로드 완료 에셋 캐시 */
    private readonly assetCache = new Map<string, Asset>();
    /** 로딩 중(동일 요청 디듀프) */
    private readonly inflight = new Map<string, Promise<Asset>>();

    public onLoad() {
        // 씬이 바뀌어도 유지되도록 Persist 등록 + 중복 생성 방지
        if (ResourceManager._instance && ResourceManager._instance !== this) {
            // 다음 씬에 동일 매니저가 또 배치된 경우: 새로 생성된 쪽 제거
            this.node.destroy();
            return;
        }

        ResourceManager._instance = this;

        // Persist Root Node 등록(씬 전환에도 유지)
        // 이미 등록된 노드면 addPersistRootNode를 여러 번 호출해도 무방하지만,
        // 의도를 명확히 하기 위해 여기서 1회만 수행
        director.addPersistRootNode(this.node);
    }

    public onDestroy() {
        if (ResourceManager._instance === this) {
            ResourceManager._instance = null;
        }
    }

    /** 필요시 씬에 붙어있는 컴포넌트를 싱글톤으로 쓰기 위한 접근자 */
    public static get instance(): ResourceManager | null {
        return ResourceManager._instance;
    }

    /** 캐시 키 생성 */
    private makeKey(bundleName: string, path: string, typeName: string) {
        return `${bundleName}::${path}::${typeName}`;
    }

    /** 에셋 캐시 조회(타입까지 포함) */
    private getCached<T extends Asset>(bundleName: string, path: string, type: AssetConstructor<T>): T | null {
        const key = this.makeKey(bundleName, path, type.name ?? 'Asset');
        const cached = this.assetCache.get(key);
        return (cached as T) ?? null;
    }

    /** 에셋 캐시에 저장(필요하면 ref 증가) */
    private setCached<T extends Asset>(bundleName: string, path: string, type: AssetConstructor<T>, asset: T) {
        const key = this.makeKey(bundleName, path, type.name ?? 'Asset');
        // 캐싱해서 들고 있을 목적이라 ref를 하나 확보 (명시적으로 releaseCache 할 때 decRef)
        asset.addRef?.();
        this.assetCache.set(key, asset);
    }

    /** 다음 tick으로 양보(프리로드/연속 로딩 시 스파이크 완화용) */
    private async yieldOnce(): Promise<void> {
        // director가 없을 수도 있는 초기 타이밍을 고려해서 setTimeout 기반으로 처리
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }

    /** 번들 로드(캐시 + Promise) */
    public async loadBundle(bundleName: string): Promise<AssetManager.Bundle> {
        const cached = this.bundleCache.get(bundleName);
        if (cached) return cached;

        const bundle = await new Promise<AssetManager.Bundle>((resolve, reject) => {
            assetManager.loadBundle(bundleName, (err, bndl) => {
                if (err || !bndl) {
                    reject(err ?? new Error(`Failed to load bundle: ${bundleName}`));
                    return;
                }
                resolve(bndl);
            });
        });

        this.bundleCache.set(bundleName, bundle);
        return bundle;
    }

    /**
     * 일반 리소스 로드 (이미지/사운드/텍스트 등)
     * - 캐시가 있으면 즉시 반환
     * - 동일 리소스를 동시에 요청하면 in-flight Promise를 공유
     */
    public async load<T extends Asset>(
        bundleName: string,
        path: string,
        type: AssetConstructor<T>,
        onProgress?: (finished: number, total: number, item?: any) => void
    ): Promise<T> {
        const cached = this.getCached(bundleName, path, type);
        if (cached) return cached;

        const inflightKey = this.makeKey(bundleName, path, type.name ?? 'Asset');
        const inflight = this.inflight.get(inflightKey);
        if (inflight !== undefined) return (await inflight) as T;

        const p = (async () => {
            const bundle = await this.loadBundle(bundleName);
            const asset = await new Promise<T>((resolve, reject) => {
                bundle.load(path, type as any, onProgress ?? null, (err, a) => {
                    if (err || !a) {
                        reject(err ?? new Error(`Failed to load asset: ${bundleName}/${path}`));
                        return;
                    }
                    resolve(a as T);
                });
            });

            this.setCached(bundleName, path, type, asset);
            return asset;
        })();

        this.inflight.set(inflightKey, p as unknown as Promise<Asset>);
        try {
            return await p;
        } finally {
            this.inflight.delete(inflightKey);
        }
    }

    /** 프리팹 전용 로드 */
    public async loadPrefab(bundleName: string, path: string, onProgress?: (finished: number, total: number, item?: any) => void): Promise<Prefab> {
        return await this.load(bundleName, path, Prefab, onProgress);
    }

    /** 프리팹 인스턴스 생성 편의 메서드 */
    public async instantiatePrefab(
        bundleName: string,
        path: string,
        parent?: Node,
        onProgress?: (finished: number, total: number, item?: any) => void
    ): Promise<Node> {
        const prefab = await this.loadPrefab(bundleName, path, onProgress);
        const node = instantiate(prefab);
        if (parent) node.parent = parent;
        return node;
    }

    /** 자주 쓰는 타입 로드 편의 메서드 */
    public async loadTexture(bundleName: string, path: string) {
        return await this.load(bundleName, path, Texture2D);
    }
    public async loadAudio(bundleName: string, path: string) {
        return await this.load(bundleName, path, AudioClip);
    }
    public async loadText(bundleName: string, path: string) {
        return await this.load(bundleName, path, TextAsset);
    }

    /**
     * 리스트 프리로드
     * - 런타임에서 "한 번에 로드"로 생기는 CPU/IO 스파이크를 줄이기 위해,
     *   타입별로 묶어서 `bundle.preload`를 호출하고 중간중간 yield 합니다.
     *
     * 주의: preload는 즉시 에셋을 반환하지는 않지만(요청 파이프라인/의존성 캐시),
     *       이후 실제 load()가 훨씬 가벼워지는 용도로 사용합니다.
     */
    public async preloadList(
        bundleName: string,
        requests: ResourcePreloadRequest[],
        options?: {
            /** type별 preload 호출 사이에 yield 할지 */
            yieldBetweenGroups?: boolean;
            /** progress 전달(타입별 preload의 진행률을 합산 형태로 제공) */
            onProgress?: (finished: number, total: number) => void;
        }
    ): Promise<void> {
        const bundle = await this.loadBundle(bundleName);
        if (!requests || requests.length === 0) return;

        // 이미 캐시된 건 제외 (프리팹/일반 동일하게 Prefab/Asset 타입으로 키 체크)
        const normalized = requests
            .map((r) => {
                const kind = (r as any).kind ?? 'asset';
                const type = kind === 'prefab' ? Prefab : ((r as any).type ?? Asset);
                return { kind, path: r.path, type: type as AssetConstructor<Asset> };
            })
            .filter((r) => !this.getCached(bundleName, r.path, r.type));

        if (normalized.length === 0) return;

        // type 별로 묶어서 preload를 최소 호출
        const groups = new Map<AssetConstructor<Asset>, string[]>();
        for (const r of normalized) {
            const arr = groups.get(r.type) ?? [];
            arr.push(r.path);
            groups.set(r.type, arr);
        }

        const total = normalized.length;
        let finished = 0;
        const onProgress = options?.onProgress;
        const yieldBetweenGroups = options?.yieldBetweenGroups ?? true;

        for (const [type, paths] of groups.entries()) {
            await new Promise<void>((resolve, reject) => {
                bundle.preload(
                    paths,
                    type as any,
                    (fin, tot) => {
                        // 그룹 진행률을 전체 진행률로 환산(대략)
                        const groupTotal = tot || paths.length || 1;
                        const groupFinished = Math.min(fin || 0, groupTotal);
                        const approxFinished = finished + groupFinished;
                        onProgress?.(approxFinished, total);
                    },
                    (err) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        finished += paths.length;
                        onProgress?.(finished, total);
                        resolve();
                    }
                );
            });

            if (yieldBetweenGroups) {
                await this.yieldOnce();
            }
        }
    }

    /**
     * 캐시 해제 (선택)
     * - 캐시에 addRef 한 만큼 decRef
     * - 필요하면 특정 번들의 특정 리소스만 해제하도록 확장 가능
     */
    public releaseAllCachedAssets(): void {
        for (const asset of this.assetCache.values()) {
            asset.decRef?.();
        }
        this.assetCache.clear();
        this.inflight.clear();
    }

    /** 번들 캐시 해제(원하면) */
    public releaseBundle(bundleName: string): void {
        const bundle = this.bundleCache.get(bundleName);
        if (!bundle) return;
        assetManager.removeBundle(bundle);
        this.bundleCache.delete(bundleName);
    }
}
