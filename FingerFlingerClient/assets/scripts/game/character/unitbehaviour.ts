import { _decorator, Component, Node } from 'cc';
import * as XState from 'xstate';
import type { Subscription } from 'xstate';
import { UnitAnimationControl } from './unitanimationcontrol';
import {
    createUnitMachine,
    type UnitState,
    type UnitFsmState,
} from './unitbehaviour.fsm';
const { ccclass, property } = _decorator;

// eslint-disable-next-line deprecation/deprecation
const interpret: typeof import('xstate').interpret =
    (XState as any).interpret ?? (XState as any).default?.interpret;

if (typeof interpret !== 'function') {
    throw new TypeError('[UnitBehaviour] xstate import 실패: interpret가 함수가 아닙니다.');
}

type UnitService = {
    start(): void;
    stop(): void;
    send(event: unknown): void;
    subscribe(listener: (state: UnitFsmState) => void): Subscription;
    state: UnitFsmState;
};

@ccclass('UnitBehaviour')
export class UnitBehaviour extends Component {
    @property({
        type: UnitAnimationControl,
        tooltip: '유닛 애니메이션 컨트롤러. 비워두면 이 노드(또는 자식)에서 자동 탐색합니다.',
    })
    private animationControl: UnitAnimationControl | null = null;

    @property({ tooltip: '대기 상태에서 배회로 넘어가기까지의 시간(초)' })
    public idleToWanderSec = 1.5;

    @property({ tooltip: '배회 지속 시간(초)' })
    public wanderSec = 2;

    @property({ tooltip: '공격 상태 유지 시간(초). 애니메이션 길이에 맞추세요.' })
    public attackSec = 0.6;

    @property({ tooltip: '피격 상태(경직) 유지 시간(초)' })
    public hitStunSec = 0.35;

    // xstate v4를 Cocos 에디터(SystemJS) 호환 목적으로 사용합니다.
    private service: UnitService | null = null;
    private subscription: Subscription | null = null;
    private lastState: UnitState | null = null;

    protected onLoad(): void {
        this.animationControl = this.resolveAnimationControl();

        // 인스펙터 설정을 머신 컨텍스트로 반영(런타임 수정도 가능)
        // enable 시점에 service를 생성/시작합니다.
    }

    protected onEnable(): void {
        if (this.service) return;
        this.recreateServiceFromInspector();
        const svc = this.service;
        if (!svc) return;
        svc.start();
        this.subscription = svc.subscribe((state) => this.onState(state));
        this.lastState = null;
        // 초기 상태 반영
        this.onState(svc.state);
    }

    protected onDisable(): void {
        this.stopActorAndUnsubscribe();
    }

    protected onDestroy(): void {
        this.stopActorAndUnsubscribe();
    }

    update(dt: number): void {
        if (!this.service) return;
        this.service.send({ type: 'TICK', dt });
    }

    /** 외부(감지 시스템)에서 타겟을 지정합니다. */
    public setTarget(target: Node | null): void {
        if (!this.service) return;
        if (target?.isValid) this.service.send({ type: 'SET_TARGET', target });
        else this.service.send({ type: 'CLEAR_TARGET' });
    }

    /** 외부(거리 계산/트리거)에서 공격 사거리 내/외를 갱신합니다. */
    public setTargetInRange(inRange: boolean): void {
        if (!this.service) return;
        this.service.send({ type: inRange ? 'TARGET_IN_RANGE' : 'TARGET_OUT_OF_RANGE' });
    }

    /** 외부(피격 시스템)에서 피격 이벤트를 넣습니다. */
    public onHit(): void {
        if (!this.service) return;
        this.service.send({ type: 'HIT' });
    }

    /** 외부에서 사망 처리(HP<=0 등). */
    public die(): void {
        if (!this.service) return;
        this.service.send({ type: 'DIE' });
    }

    public getState(): UnitState {
        if (!this.service) return 'idle';
        return this.service.state.value as UnitState;
    }

    private onState(stateObj: UnitFsmState): void {
        const state = stateObj.value as UnitState;
        if (this.lastState === state) return;
        this.lastState = state;

        // 상태 진입에 따른 애니메이션 동기화(필요하면 여기서 이동/공격 로직도 호출)
        const anim = this.animationControl ?? this.resolveAnimationControl();
        if (!anim) return;

        switch (state) {
            case 'idle':
                anim.playIdle();
                break;
            case 'wander':
            case 'chase':
                anim.playMove();
                break;
            case 'attack':
                anim.playAttack(true);
                break;
            case 'hit':
                anim.playHit(true);
                break;
            case 'dead':
                anim.playDie(true);
                break;
        }
    }

    private resolveAnimationControl(): UnitAnimationControl | null {
        if (this.animationControl?.isValid) return this.animationControl;
        const found = this.getComponent(UnitAnimationControl) ?? this.getComponentInChildren(UnitAnimationControl);
        this.animationControl = found ?? null;
        if (!this.animationControl) {
            console.warn('[UnitBehaviour] UnitAnimationControl을 찾지 못했습니다. 같은 노드(또는 자식)에 UnitAnimationControl 컴포넌트를 추가하세요.', this.node?.name);
        }
        return this.animationControl;
    }

    private recreateServiceFromInspector(): void {
        // 기존 구독/service 정리
        this.stopActorAndUnsubscribe();

        // eslint-disable-next-line deprecation/deprecation
        this.service = interpret(
            createUnitMachine({
                idleToWanderSec: this.idleToWanderSec,
                wanderSec: this.wanderSec,
                attackSec: this.attackSec,
                hitStunSec: this.hitStunSec,
            })
        );
    }

    private stopActorAndUnsubscribe(): void {
        this.subscription?.unsubscribe();
        this.subscription = null;
        try {
            this.service?.stop();
        } catch {}
        this.service = null;
    }
}
