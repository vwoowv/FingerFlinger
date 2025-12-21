import { Asset, AssetManager, assetManager, AudioClip, instantiate, Prefab, TextAsset, Texture2D, Node } from 'cc';

/** Asset 생성자 타입(예: Texture2D, AudioClip, TextAsset, Prefab 등) */
export type AssetConstructor<T extends Asset> = new (...args: any[]) => T;

/**
 * 프리로드 요청 형식
 * - 일반 리소스는 `kind: 'asset'` + `type`(선택)
 * - 프리팹은 `kind: 'prefab'` (type 자동 Prefab)
 */
export type ResourcePreloadRequest = { kind?: 'asset'; path: string; type?: AssetConstructor<Asset> } | { kind: 'prefab'; path: string };

/**
 * Cocos 의존 로직(AssetManager/Bundle API)을 감싼 "순수 서비스" 클래스.
 * - Component/씬 라이프사이클과 분리해서 테스트/교체/확장 용이하게 구성
 */
export class ResourceService {
    /** 번들 캐시 */
    private readonly bundleCache = new Map<string, AssetManager.Bundle>();
    /** 로드 완료 에셋 캐시 */
    private readonly assetCache = new Map<string, Asset>();
    /** 로딩 중(동일 요청 디듀프) */
    private readonly inflight = new Map<string, Promise<Asset>>();

    private makeKey(bundleName: string, path: string, typeName: string) {
        return `${bundleName}::${path}::${typeName}`;
    }

    private getCached<T extends Asset>(bundleName: string, path: string, type: AssetConstructor<T>): T | null {
        const key = this.makeKey(bundleName, path, type.name ?? 'Asset');
        const cached = this.assetCache.get(key);
        return (cached as T) ?? null;
    }

    private setCached<T extends Asset>(bundleName: string, path: string, type: AssetConstructor<T>, asset: T) {
        const key = this.makeKey(bundleName, path, type.name ?? 'Asset');
        asset.addRef?.();
        this.assetCache.set(key, asset);
    }

    private async yieldOnce(): Promise<void> {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }

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

    public async load<T extends Asset>(bundleName: string, path: string, type: AssetConstructor<T>,
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

    public async loadPrefab(bundleName: string, path: string, onProgress?: (finished: number, total: number, item?: any) => void): Promise<Prefab> {
        return await this.load(bundleName, path, Prefab, onProgress);
    }

    public async instantiatePrefab(bundleName: string, path: string, parent?: Node,
        onProgress?: (finished: number, total: number, item?: any) => void
    ): Promise<Node> {
        const prefab = await this.loadPrefab(bundleName, path, onProgress);
        const node = instantiate(prefab);
        if (parent) node.parent = parent;
        return node;
    }

    public async loadTexture(bundleName: string, path: string) {
        return await this.load(bundleName, path, Texture2D);
    }
    public async loadAudio(bundleName: string, path: string) {
        return await this.load(bundleName, path, AudioClip);
    }
    public async loadText(bundleName: string, path: string) {
        return await this.load(bundleName, path, TextAsset);
    }

    public async preloadList(bundleName: string, requests: ResourcePreloadRequest[],
        options?: { yieldBetweenGroups?: boolean; onProgress?: (finished: number, total: number) => void }
    ): Promise<void> {
        const bundle = await this.loadBundle(bundleName);
        if (!requests || requests.length === 0) return;

        const normalized = requests
            .map((r) => {
                const kind = (r as any).kind ?? 'asset';
                const type = kind === 'prefab' ? Prefab : ((r as any).type ?? Asset);
                return { kind, path: r.path, type: type as AssetConstructor<Asset> };
            })
            .filter((r) => !this.getCached(bundleName, r.path, r.type));

        if (normalized.length === 0) return;

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

    public releaseAllCachedAssets(): void {
        for (const asset of this.assetCache.values()) {
            asset.decRef?.();
        }
        this.assetCache.clear();
        this.inflight.clear();
    }

    public releaseBundle(bundleName: string): void {
        const bundle = this.bundleCache.get(bundleName);
        if (!bundle) return;
        assetManager.removeBundle(bundle);
        this.bundleCache.delete(bundleName);
    }
}
