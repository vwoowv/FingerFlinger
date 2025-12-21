import { _decorator, Component, director, find } from 'cc';
import { EntryUI } from './entry/ui/entryui';
import { DEFAULT_PREFAB_PATHS, GamePreloader } from './entry/gamepreloader';
const { ccclass, property } = _decorator;

// 빠른 첫 화면을 보여주기 위한 씬.
// 첫 이미지를 보여주고 바로 game 씬에 필요한 데이터 캐싱으로 들어간다
// 캐싱이 완료되면 game 씬으로 이동한다
@ccclass('Main')
export class Main extends Component {
    @property(EntryUI)
    private entryui: EntryUI = null;

    private _loadingProgress01 = 0;

    constructor() {
        super();
    }

    start() {
        console.log('[Main] start. preload prefabs(list) before loading game scene.', DEFAULT_PREFAB_PATHS);
        void this.preloadPrefabsAndLoadGame();
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

    private async preloadPrefabsAndLoadGame(): Promise<void> {
        const PHASE1_WEIGHT = 0.5;  // 프리팹(맵) 프리로드 비중
        const PHASE2_WEIGHT = 0.45; // game 씬 프리로드 비중(0.95까지)

        this._loadingProgress01 = 0;
        this.setLoadingProgress(0);

        // 미리 로딩 로직은 별도 클래스로 분리
        const preloader = new GamePreloader({
            setProgress: (p01) => this.setLoadingProgress(p01),
            phase1Weight: PHASE1_WEIGHT,
            phase2Weight: PHASE2_WEIGHT,
        });
        await preloader.run();

        // 최종 100% 후 씬 전환
        this.setLoadingProgress(1);
        console.log('Main start. load game scene.');
        director.loadScene('game');
    }
}