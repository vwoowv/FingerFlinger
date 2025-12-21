import { _decorator, Component, ProgressBar } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('EntryUI')
export class EntryUI extends Component {
    @property(ProgressBar)
    private loadingProgressBar: ProgressBar | null = null;

    private targetProgress = 0;
    private currentProgress = 0;

    /** UI가 따라가는 속도(값이 클수록 더 빨리 target을 따라감) */
    private readonly smoothSpeed = 10;

    private clamp01(v: number) {
        if (v < 0) return 0;
        if (v > 1) return 1;
        return v;
    }

    private ensureProgressBar(): ProgressBar | null {
        if (!this.loadingProgressBar?.isValid) {
            // 씬에서 프로퍼티가 연결되지 않은 경우를 대비해 자동 탐색
            this.loadingProgressBar = this.node.getComponentInChildren(ProgressBar);
        }
        return this.loadingProgressBar;
    }

    start() {
        this.targetProgress = 0;
        this.currentProgress = 0;
        const bar = this.ensureProgressBar();
        if (bar) bar.progress = 0;
    }

    update(deltaTime: number) {
        const bar = this.ensureProgressBar();
        if (!bar) return;

        // 간단한 지수 접근(프레임레이트에 덜 민감)
        const k = Math.min(1, deltaTime * this.smoothSpeed);
        this.currentProgress += (this.targetProgress - this.currentProgress) * k;
        bar.progress = this.clamp01(this.currentProgress);
    }

    /** 로딩 진행률(0~1)을 UI에 반영 */
    public setProgress(progress01: number): void {
        this.targetProgress = this.clamp01(progress01);
    }
}
