/**
 * 시간 관련 공용 유틸
 * - 엔진/씬 로직과 분리된 순수 함수로 유지
 */

export class TimeUtility {
    /** 지정한 ms 만큼 대기 */
    public static delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /** delay의 별칭(alias). sleep(ms)로도 사용할 수 있음 */
    public static sleep(ms: number): Promise<void> {
        return TimeUtility.delay(ms);
    }

    /** 이벤트 루프에 한 번 양보(다음 tick/프레임에 이어서 실행) */
    public static async yieldOnce(): Promise<void> {
        await TimeUtility.delay(0);
    }
}
