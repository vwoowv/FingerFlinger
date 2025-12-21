import { director } from 'cc';
import { ResourceManager } from '../utility/resource/resourcemanager';

export const DEFAULT_PREFAB_BUNDLE_NAME = 'prefab';
/** 프리로드(캐싱)할 프리팹 경로 목록(확장자 제외). 예: "map/Map_S01_GreenPlanet_01" */
export const DEFAULT_PREFAB_PATHS: string[] = ['map/Map_S01_GreenPlanet_01'];

export type GamePreloaderOptions = {
    /** 0~1 진행률 업데이트 콜백(호출부에서 clamp/단조증가 처리 권장) */
    setProgress: (progress01: number) => void;
    /** 프리팹 번들명 */
    prefabBundleName?: string;
    /** 프리로드할 프리팹 경로 목록(확장자 제외) */
    prefabPaths?: string[];
    /** 진행률 가중치(프리팹) */
    phase1Weight?: number;
    /** 진행률 가중치(game 씬 프리로드) */
    phase2Weight?: number;
};

/**
 * 게임 진입 전 "미리 로딩" 전담 클래스
 * - 프리팹 리스트 프리로드(ResourceManager.preloadList)
 * - game 씬 preloadScene
 */
export class GamePreloader {
    private readonly setProgress: (p01: number) => void;
    private readonly prefabBundleName: string;
    private readonly prefabPaths: string[];
    private readonly phase1Weight: number;
    private readonly phase2Weight: number;

    public constructor(options: GamePreloaderOptions) {
        this.setProgress = options.setProgress;
        this.prefabBundleName = options.prefabBundleName || DEFAULT_PREFAB_BUNDLE_NAME;
        this.prefabPaths = options.prefabPaths ?? DEFAULT_PREFAB_PATHS;
        this.phase1Weight = options.phase1Weight ?? 0.5;
        this.phase2Weight = options.phase2Weight ?? 0.45;
    }

    public async run(): Promise<void> {
        this.setProgress(0);
        await Promise.all([this.preloadPrefabs(), this.preloadGameScene()]);
    }

    private async preloadPrefabs(): Promise<void> {
        try {
            const rm = ResourceManager.instance;
            if (!rm) throw new Error('ResourceManager.instance is null. Ensure ResourceManager exists in the first scene.');

            const list = (this.prefabPaths ?? []).filter((p) => !!p && p.trim().length > 0);
            if (list.length === 0) {
                this.setProgress(this.phase1Weight);
                return;
            }

            await rm.preloadList(
                this.prefabBundleName,
                list.map((path) => ({ kind: 'prefab' as const, path: path.trim() })),
                {
                    onProgress: (finished, total) => {
                        const denom = Math.max(1, total || 0);
                        const ratio = Math.min(1, Math.max(0, (finished || 0) / denom));
                        // 0 ~ phase1Weight
                        this.setProgress(ratio * this.phase1Weight);
                    },
                }
            );

            this.setProgress(this.phase1Weight);
        } catch (e) {
            console.error('[GamePreloader] prefabs preload(list) via ResourceManager failed.', e);
        }
    }

    private preloadGameScene(): Promise<void> {
        return new Promise<void>((resolve) => {
            director.preloadScene(
                'game',
                (completedCount, totalCount) => {
                    const denom = Math.max(1, totalCount || 0);
                    const ratio = Math.min(1, Math.max(0, (completedCount || 0) / denom));
                    // phase1Weight ~ (phase1Weight + phase2Weight)
                    this.setProgress(this.phase1Weight + ratio * this.phase2Weight);
                },
                (err) => {
                    if (err) {
                        console.error('[GamePreloader] preloadScene(game) failed.', err);
                    } else {
                        this.setProgress(this.phase1Weight + this.phase2Weight);
                    }
                    resolve();
                }
            );
        });
    }
}
