import { Node } from 'cc';
import * as XState from 'xstate';
import type { StateFrom } from 'xstate';

// Cocos Creator 에디터(SystemJS)에서 named import가 깨지는 케이스가 있어 namespace import로 안전하게 접근합니다.
const assign: typeof import('xstate').assign =
    (XState as any).assign ?? (XState as any).default?.assign;
const createMachine: typeof import('xstate').createMachine =
    (XState as any).createMachine ?? (XState as any).default?.createMachine;

if (typeof assign !== 'function' || typeof createMachine !== 'function') {
    throw new TypeError('[UnitBehaviourFsm] xstate import 실패: assign/createMachine이 함수가 아닙니다.');
}

export type UnitState = 'idle' | 'wander' | 'chase' | 'attack' | 'hit' | 'dead';

export type UnitFsmInput = {
    idleToWanderSec: number;
    wanderSec: number;
    attackSec: number;
    hitStunSec: number;
};

export const DEFAULT_UNIT_FSM_INPUT: UnitFsmInput = {
    idleToWanderSec: 1.5,
    wanderSec: 2,
    attackSec: 0.6,
    hitStunSec: 0.35,
};

export type UnitFsmContext = {
    target: Node | null;
    /** 외부(감지/충돌)에서 갱신해주는 "공격 가능 거리 안" 여부 */
    targetInRange: boolean;

    // 타이머들(초 단위)
    idleToWanderSecLeft: number;
    wanderSecLeft: number;
    attackSecLeft: number;
    hitStunSecLeft: number;

    // 기본 설정
    idleToWanderSec: number;
    wanderSec: number;
    attackSec: number;
    hitStunSec: number;
};

export type UnitFsmEvent =
    | { type: 'TICK'; dt: number }
    | { type: 'SET_TARGET'; target: Node }
    | { type: 'CLEAR_TARGET' }
    | { type: 'TARGET_IN_RANGE' }
    | { type: 'TARGET_OUT_OF_RANGE' }
    | { type: 'HIT' }
    | { type: 'DIE' };

export function createUnitMachine(input: UnitFsmInput) {
    return createMachine<UnitFsmContext, UnitFsmEvent>(
        {
            // xstate 권장 옵션: 액션 인자 형태를 예측 가능하게 고정(경고 제거 + 향후 마이그레이션 용이)
            predictableActionArguments: true,
            id: 'unit-ai',
            initial: 'idle',
            context: {
                target: null,
                targetInRange: false,

                idleToWanderSecLeft: 0,
                wanderSecLeft: 0,
                attackSecLeft: 0,
                hitStunSecLeft: 0,

                idleToWanderSec: input.idleToWanderSec,
                wanderSec: input.wanderSec,
                attackSec: input.attackSec,
                hitStunSec: input.hitStunSec,
            },
            on: {
                DIE: 'dead',
                HIT: 'hit',
                SET_TARGET: {
                    actions: assign((ctx, e) => ({
                        ...ctx,
                        target: e.target,
                    })),
                },
                CLEAR_TARGET: {
                    actions: assign((ctx) => ({
                        ...ctx,
                        target: null,
                        targetInRange: false,
                    })),
                },
                TARGET_IN_RANGE: {
                    actions: assign((ctx) => ({
                        ...ctx,
                        targetInRange: true,
                    })),
                },
                TARGET_OUT_OF_RANGE: {
                    actions: assign((ctx) => ({
                        ...ctx,
                        targetInRange: false,
                    })),
                },
            },
            states: {
                idle: {
                    entry: assign((ctx) => ({
                        ...ctx,
                        idleToWanderSecLeft: ctx.idleToWanderSec,
                    })),
                    on: {
                        TICK: [
                            { target: 'chase', cond: (ctx) => !!ctx.target?.isValid },
                            {
                                target: 'wander',
                                cond: (ctx, e) => ctx.idleToWanderSecLeft - e.dt <= 0,
                                actions: assign((ctx, e) => ({
                                    ...ctx,
                                    idleToWanderSecLeft: Math.max(0, ctx.idleToWanderSecLeft - e.dt),
                                })),
                            },
                            {
                                actions: assign((ctx, e) => ({
                                    ...ctx,
                                    idleToWanderSecLeft: Math.max(0, ctx.idleToWanderSecLeft - e.dt),
                                })),
                            },
                        ],
                    },
                },
                wander: {
                    entry: assign((ctx) => ({
                        ...ctx,
                        wanderSecLeft: ctx.wanderSec,
                    })),
                    on: {
                        TICK: [
                            { target: 'chase', cond: (ctx) => !!ctx.target?.isValid },
                            {
                                target: 'idle',
                                cond: (ctx, e) => ctx.wanderSecLeft - e.dt <= 0,
                                actions: assign((ctx, e) => ({
                                    ...ctx,
                                    wanderSecLeft: Math.max(0, ctx.wanderSecLeft - e.dt),
                                })),
                            },
                            {
                                actions: assign((ctx, e) => ({
                                    ...ctx,
                                    wanderSecLeft: Math.max(0, ctx.wanderSecLeft - e.dt),
                                })),
                            },
                        ],
                    },
                },
                chase: {
                    on: {
                        TICK: [
                            { target: 'idle', cond: (ctx) => !ctx.target?.isValid },
                            { target: 'attack', cond: (ctx) => !!ctx.target?.isValid && ctx.targetInRange },
                        ],
                    },
                },
                attack: {
                    entry: assign((ctx) => ({
                        ...ctx,
                        attackSecLeft: ctx.attackSec,
                    })),
                    on: {
                        TICK: [
                            {
                                target: 'chase',
                                cond: (ctx, e) => ctx.attackSecLeft - e.dt <= 0,
                                actions: assign((ctx, e) => ({
                                    ...ctx,
                                    attackSecLeft: Math.max(0, ctx.attackSecLeft - e.dt),
                                })),
                            },
                            {
                                actions: assign((ctx, e) => ({
                                    ...ctx,
                                    attackSecLeft: Math.max(0, ctx.attackSecLeft - e.dt),
                                })),
                            },
                        ],
                    },
                },
                hit: {
                    entry: assign((ctx) => ({
                        ...ctx,
                        hitStunSecLeft: ctx.hitStunSec,
                    })),
                    on: {
                        TICK: [
                            {
                                target: 'chase',
                                cond: (ctx, e) => ctx.hitStunSecLeft - e.dt <= 0 && !!ctx.target?.isValid,
                                actions: assign((ctx, e) => ({
                                    ...ctx,
                                    hitStunSecLeft: Math.max(0, ctx.hitStunSecLeft - e.dt),
                                })),
                            },
                            {
                                target: 'idle',
                                cond: (ctx, e) => ctx.hitStunSecLeft - e.dt <= 0 && !ctx.target?.isValid,
                                actions: assign((ctx, e) => ({
                                    ...ctx,
                                    hitStunSecLeft: Math.max(0, ctx.hitStunSecLeft - e.dt),
                                })),
                            },
                            {
                                actions: assign((ctx, e) => ({
                                    ...ctx,
                                    hitStunSecLeft: Math.max(0, ctx.hitStunSecLeft - e.dt),
                                })),
                            },
                        ],
                    },
                },
                dead: {
                    type: 'final',
                },
            },
        },
        {}
    );
}

export type UnitFsmState = StateFrom<ReturnType<typeof createUnitMachine>>;


