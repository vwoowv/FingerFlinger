import { _decorator, Component, Node, sp } from 'cc';
const { ccclass, property } = _decorator;

export enum UnitAnimKey {
    Idle = 'idle',
    Move = 'move',
    Attack = 'attack',
    Hit = 'hit',
    Die = 'die',
}

@ccclass('UnitAnimationControl')
export class UnitAnimationControl extends Component {
    @property({
        type: Node,
        tooltip: 'Spine(Skeleton) 컴포넌트가 붙어있는 노드(또는 그 부모). 비워두면 이 노드에서 탐색합니다.',
    })
    private readonly spineRoot: Node | null = null;

    @property({
        tooltip: 'spineRoot 기준으로 Skeleton이 있는 child 경로(예: "Model/Spine"). 비우면 spineRoot(또는 그 자식)에서 자동 탐색합니다.',
    })
    private readonly spineChildPath = '';

    @property({ tooltip: 'Idle 애니메이션 이름(데이터/프리팹마다 다를 수 있어요).' })
    private animIdle = 'idle';

    @property({ tooltip: 'Move 애니메이션 이름' })
    private animMove = 'move';

    @property({ tooltip: 'Attack 애니메이션 이름' })
    private animAttack = 'attack';

    @property({ tooltip: 'Hit(피격) 애니메이션 이름' })
    private animHit = 'hit';

    @property({ tooltip: 'Die(사망) 애니메이션 이름' })
    private animDie = 'die';

    @property({ tooltip: '공격/피격 애니메이션이 끝나면 자동으로 idle로 돌아갑니다.' })
    private readonly autoReturnToIdle = true;

    @property({ tooltip: 'die 재생 후에는 다른 애니메이션 재생을 막습니다.' })
    private readonly lockAfterDie = true;

    @property({ tooltip: '스파인 애니메이션 변경 로그를 출력합니다.' })
    private readonly debugLog = false;

    private skeleton: sp.Skeleton | null = null;
    private currentKey: UnitAnimKey | null = null;
    private deadLocked = false;
    private lastNonLoopKey: UnitAnimKey | null = null;

    protected onLoad(): void {
        this.skeleton = this.resolveSkeleton();
        if (!this.skeleton) {
            console.warn('[UnitAnimationControl] Spine Skeleton을 찾지 못했습니다. inspector의 spineRoot/spineChildPath를 확인하세요.', this.node?.name);
            return;
        }

        // 공격/피격 종료 후 idle 복귀 처리를 위해 complete 리스너 등록
        this.skeleton.setCompleteListener((trackEntry: any) => {
            if (!this.autoReturnToIdle) return;
            if (!trackEntry) return;
            if (this.deadLocked) return;

            const finishedKey = this.lastNonLoopKey;
            if (finishedKey !== UnitAnimKey.Attack && finishedKey !== UnitAnimKey.Hit) return;

            // 트랙 0만 사용한다고 가정(필요하면 확장)
            const trackIndex = trackEntry.trackIndex ?? 0;
            if (trackIndex !== 0) return;

            // 완료된 애니메이션이 실제로 skeleton에 있던 이름과 매칭되는지(안전장치)
            const finishedAnimName = trackEntry.animation?.name ?? '';
            const expectedName = this.getAnimName(finishedKey);
            if (expectedName && finishedAnimName && expectedName !== finishedAnimName) return;

            this.playIdle();
        });
    }

    start() {
        // 기본 상태: idle
        this.playIdle();
    }

    /** (에디터/런타임) 애니메이션 이름을 갱신합니다. */
    public setAnimationNames(names: Partial<Record<UnitAnimKey, string>>): void {
        if (names[UnitAnimKey.Idle] != null) this.animIdle = names[UnitAnimKey.Idle]!;
        if (names[UnitAnimKey.Move] != null) this.animMove = names[UnitAnimKey.Move]!;
        if (names[UnitAnimKey.Attack] != null) this.animAttack = names[UnitAnimKey.Attack]!;
        if (names[UnitAnimKey.Hit] != null) this.animHit = names[UnitAnimKey.Hit]!;
        if (names[UnitAnimKey.Die] != null) this.animDie = names[UnitAnimKey.Die]!;
    }

    public playIdle(force = false): boolean {
        return this.play(UnitAnimKey.Idle, { loop: true, force });
    }

    public playMove(force = false): boolean {
        return this.play(UnitAnimKey.Move, { loop: true, force });
    }

    /** 공격은 기본적으로 1회 재생 후(complete) idle로 복귀합니다. */
    public playAttack(force = true): boolean {
        return this.play(UnitAnimKey.Attack, { loop: false, force });
    }

    /** 피격은 기본적으로 1회 재생 후(complete) idle로 복귀합니다. */
    public playHit(force = true): boolean {
        return this.play(UnitAnimKey.Hit, { loop: false, force });
    }

    /** die는 기본적으로 1회 재생하며, lockAfterDie=true면 이후 다른 애니메이션 재생을 막습니다. */
    public playDie(force = true): boolean {
        const ok = this.play(UnitAnimKey.Die, { loop: false, force });
        if (ok && this.lockAfterDie) this.deadLocked = true;
        return ok;
    }

    public isDeadLocked(): boolean {
        return this.deadLocked;
    }

    public unlockAfterDieForDebug(): void {
        this.deadLocked = false;
    }

    private play(key: UnitAnimKey, opts: { loop: boolean; force?: boolean }): boolean {
        const skeleton = this.skeleton ?? this.resolveSkeleton();
        if (!skeleton) return false;
        this.skeleton = skeleton;

        if (this.deadLocked && key !== UnitAnimKey.Die) return false;

        const animName = this.getAnimName(key);
        if (!animName) {
            console.warn(`[UnitAnimationControl] 애니메이션 이름이 비어있습니다: ${key}. inspector에서 지정하세요.`, this.node?.name);
            return false;
        }

        const force = opts.force ?? false;
        if (!force && this.currentKey === key) return true;

        // non-loop는 complete 시점을 위해 기록
        if (opts.loop) this.lastNonLoopKey = null;
        else this.lastNonLoopKey = key;

        try {
            skeleton.setAnimation(0, animName, opts.loop);
            this.currentKey = key;
            if (this.debugLog) console.log(`[UnitAnimationControl] play ${key} (${animName}), loop=${opts.loop}`, this.node?.name);
            return true;
        } catch (e) {
            console.warn(`[UnitAnimationControl] setAnimation 실패: ${key} (${animName})`, e);
            return false;
        }
    }

    update(deltaTime: number) {
        // 필요하면 이동 상태와 연계해 playMove/playIdle 전환
    }

    private getAnimName(key: UnitAnimKey): string {
        switch (key) {
            case UnitAnimKey.Idle: return this.animIdle?.trim() ?? '';
            case UnitAnimKey.Move: return this.animMove?.trim() ?? '';
            case UnitAnimKey.Attack: return this.animAttack?.trim() ?? '';
            case UnitAnimKey.Hit: return this.animHit?.trim() ?? '';
            case UnitAnimKey.Die: return this.animDie?.trim() ?? '';
            default: return '';
        }
    }

    private resolveSkeleton(): sp.Skeleton | null {
        const root = this.spineRoot?.isValid ? this.spineRoot : this.node;
        const path = this.spineChildPath?.trim() ?? '';

        // 1) 경로가 있으면 해당 노드에서 Skeleton 탐색
        if (path.length > 0) {
            const targetNode = root.getChildByPath(path);
            const sk = this.findSkeletonUnder(targetNode);
            if (sk) return sk;
            return null;
        }

        // 2) root 자신 또는 자식에서 첫 Skeleton
        return this.findSkeletonUnder(root);
    }

    private findSkeletonUnder(node: Node | null | undefined): sp.Skeleton | null {
        if (!node?.isValid) return null;

        const self = node.getComponent(sp.Skeleton);
        if (self) return self;

        // getComponentInChildren가 있는 버전이면 활용
        const anyNode = node as any;
        const inChildren = typeof anyNode.getComponentInChildren === 'function'
            ? (anyNode.getComponentInChildren(sp.Skeleton) as sp.Skeleton | null)
            : null;
        if (inChildren) return inChildren;

        // 수동 DFS(안전)
        const stack: Node[] = [...node.children];
        while (stack.length > 0) {
            const cur = stack.pop();
            if (!cur) break;
            const sk = cur.getComponent(sp.Skeleton);
            if (sk) return sk;
            if (cur.children?.length) stack.push(...cur.children);
        }
        return null;
    }
}
