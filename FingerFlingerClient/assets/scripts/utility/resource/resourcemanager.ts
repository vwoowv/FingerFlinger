import { _decorator, Component, director, Asset, AudioClip, Prefab, TextAsset, Texture2D, Node } from 'cc';
import { ResourceService } from './resourceservice';
import type { AssetConstructor, ResourcePreloadRequest } from './resourceservice';
const { ccclass } = _decorator;

export type { AssetConstructor, ResourcePreloadRequest } from './resourceservice';

@ccclass('ResourceManager')
export class ResourceManager extends Component {
    /**
     * 번들 기반 리소스 로더 + 캐시.
     * - 번들은 `assetManager.loadBundle`로 로드 후 캐싱
     * - 리소스는 (bundleName + path + type) 키로 캐싱
     * - 동일 키 동시 로딩은 in-flight Promise를 디듀프
     * - 프리팹은 별도 메서드(`loadPrefab`, `instantiatePrefab`)로 제공
     * - 리스트 프리로드(`preloadList`) 지원: 런타임 로딩 스파이크 완화 목적
     */

    private static _instance: ResourceManager | null = null;

    private readonly service = new ResourceService();

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

    /** 번들 로드(캐시 + Promise) */
    public async loadBundle(bundleName: string) {
        return await this.service.loadBundle(bundleName);
    }

    /**
     * 일반 리소스 로드 (이미지/사운드/텍스트 등)
     * - 캐시가 있으면 즉시 반환
     * - 동일 리소스를 동시에 요청하면 in-flight Promise를 공유
     */
    public async load<T extends Asset>(bundleName: string, path: string, type: AssetConstructor<T>,
        onProgress?: (finished: number, total: number, item?: any) => void
    ): Promise<T> {
        return await this.service.load(bundleName, path, type, onProgress);
    }

    /** 프리팹 전용 로드 */
    public async loadPrefab(bundleName: string, path: string, onProgress?: (finished: number, total: number, item?: any) => void): Promise<Prefab> {
        return await this.service.loadPrefab(bundleName, path, onProgress);
    }

    /** 프리팹 인스턴스 생성 편의 메서드 */
    public async instantiatePrefab(bundleName: string, path: string, parent?: Node,
        onProgress?: (finished: number, total: number, item?: any) => void
    ): Promise<Node> {
        return await this.service.instantiatePrefab(bundleName, path, parent, onProgress);
    }

    /** 자주 쓰는 타입 로드 편의 메서드 */
    public async loadTexture(bundleName: string, path: string): Promise<Texture2D> {
        return await this.service.loadTexture(bundleName, path);
    }
    public async loadAudio(bundleName: string, path: string): Promise<AudioClip> {
        return await this.service.loadAudio(bundleName, path);
    }
    public async loadText(bundleName: string, path: string): Promise<TextAsset> {
        return await this.service.loadText(bundleName, path);
    }

    /**
     * 리스트 프리로드
     * - 런타임에서 "한 번에 로드"로 생기는 CPU/IO 스파이크를 줄이기 위해,
     *   타입별로 묶어서 `bundle.preload`를 호출하고 중간중간 yield 합니다.
     *
     * 주의: preload는 즉시 에셋을 반환하지는 않지만(요청 파이프라인/의존성 캐시),
     *       이후 실제 load()가 훨씬 가벼워지는 용도로 사용합니다.
     */
    public async preloadList(bundleName: string, requests: ResourcePreloadRequest[],
        options?: {
            /** type별 preload 호출 사이에 yield 할지 */
            yieldBetweenGroups?: boolean;
            /** progress 전달(타입별 preload의 진행률을 합산 형태로 제공) */
            onProgress?: (finished: number, total: number) => void;
        }
    ): Promise<void> {
        return await this.service.preloadList(bundleName, requests, options);
    }

    /**
     * 캐시 해제 (선택)
     * - 캐시에 addRef 한 만큼 decRef
     * - 필요하면 특정 번들의 특정 리소스만 해제하도록 확장 가능
     */
    public releaseAllCachedAssets(): void {
        this.service.releaseAllCachedAssets();
    }

    /** 번들 캐시 해제(원하면) */
    public releaseBundle(bundleName: string): void {
        this.service.releaseBundle(bundleName);
    }
}
