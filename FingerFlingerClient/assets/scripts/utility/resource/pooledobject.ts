import { _decorator, Component } from 'cc';
const { ccclass } = _decorator;
/**
 * 풀링되는 노드에 붙는 메타 컴포넌트
 * - `poolKey`로 어떤 풀로 회수할지 결정
 * - 필요하면 상속해서 훅을 구현해서 reset 로직을 넣을 수 있음
 */
@ccclass('PooledObject')
export class PooledObject extends Component {
    public poolKey: string = '';

    /** 스폰 직후 호출(필요 시 상속해서 구현) */
    public onSpawned(): void {}
    /** 디스폰 직전 호출(필요 시 상속해서 구현) */
    public onDespawned(): void {}
}
