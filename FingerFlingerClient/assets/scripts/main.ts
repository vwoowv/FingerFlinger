import { _decorator, Component, director, find } from 'cc';
import { ResourceManager } from './utility/resource/resourcemanager';
import { entryui } from './entry/ui/entryui';
const { ccclass, property } = _decorator;

// 빠른 첫 화면을 보여주기 위한 씬.
// 첫 이미지를 보여주고 바로 game 씬에 필요한 데이터 캐싱으로 들어간다
// 캐싱이 완료되면 game 씬으로 이동한다
@ccclass('Main')
export class Main extends Component {
    @property(entryui)
    private entryui: entryui = null;
    constructor() {
        super();
    }

    start() {
        console.log('Main start. preload Map_S01_GreenPlanet_01 prefab before loading game scene.');
        void this.preloadMapPrefabAndLoadGame();
    }

    private resolveEntryUI(): entryui | null {
        if (this.entryui?.isValid) return this.entryui;
        // 씬 직렬화가 빠져있어도 동작하도록 Canvas 아래에서 자동 탐색
        const canvas = find('Canvas');
        const ui = canvas?.getComponent(entryui) ?? canvas?.getComponentInChildren(entryui);
        this.entryui = (ui as any) ?? null;
        return this.entryui;
    }

    private setLoadingProgress(progress01: number): void {
        const ui = this.resolveEntryUI();
        ui?.setProgress(progress01);
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private async preloadMapPrefabAndLoadGame(): Promise<void> {
        const MIN_LOGO_MS = 3000;
        const PHASE1_WEIGHT = 0.5;  // 프리팹(맵) 프리로드 비중
        const PHASE2_WEIGHT = 0.45; // game 씬 프리로드 비중(0.95까지)

        this.setLoadingProgress(0);

        const preloadTask = (async () => {
            try {
                // ResourceManager를 통한 로딩(캐시/동시요청 디듀프/Ref 관리)
                // `assets/resource/prefab` 폴더가 Asset Bundle(`isBundle: true`)이므로 bundleName="prefab"
                // path="map/Map_S01_GreenPlanet_01" (확장자 제외)
                const rm = ResourceManager.instance;
                if (!rm) throw new Error('ResourceManager.instance is null. Ensure ResourceManager exists in the first scene.');
                await rm.loadPrefab('prefab', 'map/Map_S01_GreenPlanet_01', (finished, total) => {
                    const denom = Math.max(1, total || 0);
                    const ratio = Math.min(1, Math.max(0, (finished || 0) / denom));
                    // 0 ~ 0.5
                    this.setLoadingProgress(ratio * PHASE1_WEIGHT);
                });
                // 프리팹 프리로드 완료 시 0.5까지 올려둠
                this.setLoadingProgress(PHASE1_WEIGHT);
            } catch (e) {
                console.error('[Main] prefab preload via ResourceManager failed.', e);
            }
        })();

        // 로고 화면은 최소 3초 머물기 + 프리로드도 병렬로 진행
        await Promise.all([this.delay(MIN_LOGO_MS), preloadTask]);

        // game 씬도 미리 프리로드해서 진행률에 반영
        await new Promise<void>((resolve) => {
            director.preloadScene(
                'game',
                (completedCount, totalCount) => {
                    const denom = Math.max(1, totalCount || 0);
                    const ratio = Math.min(1, Math.max(0, (completedCount || 0) / denom));
                    // 0.5 ~ 0.95
                    this.setLoadingProgress(PHASE1_WEIGHT + ratio * PHASE2_WEIGHT);
                },
                (err) => {
                    if (err) {
                        console.error('[Main] preloadScene(game) failed.', err);
                    } else {
                        this.setLoadingProgress(PHASE1_WEIGHT + PHASE2_WEIGHT);
                    }
                    resolve();
                }
            );
        });

        // 최종 100% 후 씬 전환
        this.setLoadingProgress(1);
        console.log('Main start. load game scene.');
        director.loadScene('game');
    }
}