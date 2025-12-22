import { _decorator, Component } from 'cc';
import { UnitAnimationControl } from './unitanimationcontrol';
const { ccclass, property } = _decorator;

@ccclass('Unit')
export class Unit extends Component {
    @property({
        type: UnitAnimationControl,
        tooltip: '유닛 애니메이션 컨트롤러. 비워두면 이 노드에서 자동 탐색합니다.',
    })
    private animationControl: UnitAnimationControl | null = null;

    start() {
        this.animationControl = this.resolveAnimationControl();
        this.animationControl?.playIdle();
    }

    update(deltaTime: number) {
        // 유닛 상태(이동/공격/피격/사망 등)에 따라 animationControl.play* 를 내부에서 호출하는 책임만 갖습니다.
    }

    private resolveAnimationControl(): UnitAnimationControl | null {
        if (this.animationControl?.isValid) return this.animationControl;
        const found = this.getComponent(UnitAnimationControl) ?? this.getComponentInChildren(UnitAnimationControl);
        this.animationControl = found ?? null;
        if (!this.animationControl) {
            console.warn('[Unit] UnitAnimationControl을 찾지 못했습니다. 같은 노드(또는 자식)에 UnitAnimationControl 컴포넌트를 추가하세요.', this.node?.name);
        }
        return this.animationControl;
    }
}
