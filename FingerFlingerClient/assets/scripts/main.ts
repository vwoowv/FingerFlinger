import { _decorator, Component, director, find } from 'cc';
import { ResourceManager } from './utility/resource/resourcemanager';
import { EntryUI } from './entry/ui/entryui';
import { TimeUtility } from './utility/base/timeutility';
const { ccclass, property } = _decorator;

// 빠른 첫 화면을 보여주기 위한 씬.
// 첫 이미지를 보여주고 바로 game 씬에 필요한 데이터 캐싱으로 들어간다
// 캐싱이 완료되면 game 씬으로 이동한다
@ccclass('Main')
export class Main extends Component {
    @property(EntryUI)
    private entryui: EntryUI = null;

    private _loadingProgress01 = 0;

    /** 프리로드(캐싱)할 프리팹 경로 목록(확장자 제외). 예: "map/Map_S01_GreenPlanet_01" */
    private preloadPrefabPaths: string[] = ['map/Map_S01_GreenPlanet_01'];

    /** 프리팹이 들어있는 번들 이름. (`assets/resource/prefab`가 bundle이면 보통 "prefab") */
    private preloadPrefabBundleName = 'prefab';
    constructor() {
        super();
    }

    start() {
        console.log('[Main] start. preload prefabs(list) before loading game scene.', this.preloadPrefabPaths);
        void this.preloadPrefabsAndLoadGame(this.preloadPrefabPaths);
    }

    private resolveEntryUI(): EntryUI | null {
        if (this.entryui?.isValid) return this.entryui;
        // 씬 직렬화가 빠져있어도 동작하도록 Canvas 아래에서 자동 탐색
        const canvas = find('Canvas');
        const ui = canvas?.getComponent(EntryUI) ?? canvas?.getComponentInChildren(EntryUI);
        this.entryui = (ui as any) ?? null;
        return this.entryui;
    }

    private setLoadingProgress(progress01: number): void {
        const clamped = Math.min(1, Math.max(0, progress01));
        // 병렬 프리로드 시 진행률이 뒤로 가지 않도록 단조 증가 보장
        this._loadingProgress01 = Math.max(this._loadingProgress01, clamped);
        const ui = this.resolveEntryUI();
        ui?.setProgress(this._loadingProgress01);
    }

    private async preloadPrefabsTask(prefabPaths: string[] | undefined, phase1Weight: number): Promise<void> {
        try {
            // ResourceManager를 통한 리스트 프리로드(preloadList)
            // - preload는 "캐시/의존성 파이프라인을 미리 데워서" 이후 load를 가볍게 하는 용도입니다.
            const rm = ResourceManager.instance;
            if (!rm) throw new Error('ResourceManager.instance is null. Ensure ResourceManager exists in the first scene.');

            const bundleName = this.preloadPrefabBundleName || 'prefab';
            const list = (prefabPaths ?? this.preloadPrefabPaths ?? []).filter((p) => !!p && p.trim().length > 0);

            if (list.length === 0) {
                // 로드할 게 없으면 1단계는 즉시 완료 처리
                this.setLoadingProgress(phase1Weight);
                return;
            }

            await rm.preloadList(
                bundleName,
                list.map((path) => ({ kind: 'prefab' as const, path: path.trim() })),
                {
                    onProgress: (finished, total) => {
                        const denom = Math.max(1, total || 0);
                        const ratio = Math.min(1, Math.max(0, (finished || 0) / denom));
                        // 0 ~ phase1Weight
                        this.setLoadingProgress(ratio * phase1Weight);
                    },
                }
            );

            // 프리팹 프리로드 완료 시 phase1Weight까지 올려둠
            this.setLoadingProgress(phase1Weight);
        } catch (e) {
            console.error('[Main] prefabs preload(list) via ResourceManager failed.', e);
        }
    }

    private preloadGameSceneTask(phase1Weight: number, phase2Weight: number): Promise<void> {
        return new Promise<void>((resolve) => {
            director.preloadScene(
                'game',
                (completedCount, totalCount) => {
                    const denom = Math.max(1, totalCount || 0);
                    const ratio = Math.min(1, Math.max(0, (completedCount || 0) / denom));
                    // phase1Weight ~ (phase1Weight + phase2Weight)
                    this.setLoadingProgress(phase1Weight + ratio * phase2Weight);
                },
                (err) => {
                    if (err) {
                        console.error('[Main] preloadScene(game) failed.', err);
                    } else {
                        this.setLoadingProgress(phase1Weight + phase2Weight);
                    }
                    resolve();
                }
            );
        });
    }

    private async preloadPrefabsAndLoadGame(prefabPaths?: string[]): Promise<void> {
        // const MIN_LOGO_MS = 3000;
        const PHASE1_WEIGHT = 0.5;  // 프리팹(맵) 프리로드 비중
        const PHASE2_WEIGHT = 0.45; // game 씬 프리로드 비중(0.95까지)

        this._loadingProgress01 = 0;
        this.setLoadingProgress(0);

        const preloadTask = this.preloadPrefabsTask(prefabPaths, PHASE1_WEIGHT);
        const preloadSceneTask = this.preloadGameSceneTask(PHASE1_WEIGHT, PHASE2_WEIGHT);

        // 로고 화면은 최소 3초 머물기 + 프리로드(프리팹/씬)도 병렬로 진행
        // await Promise.all([TimeUtility.delay(MIN_LOGO_MS), preloadTask, preloadSceneTask]);
        await Promise.all([preloadTask, preloadSceneTask]);

        // 최종 100% 후 씬 전환
        this.setLoadingProgress(1);
        console.log('Main start. load game scene.');
        director.loadScene('game');
    }
}