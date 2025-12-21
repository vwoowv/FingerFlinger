import { _decorator, Component, director } from 'cc';
const { ccclass, property } = _decorator;

// 빠른 첫 화면을 보여주기 위한 씬.
// 첫 이미지를 보여주고 바로 game 씬에 필요한 데이터 캐싱으로 들어간다
// 캐싱이 완료되면 game 씬으로 이동한다
@ccclass('Main')
export class Main extends Component {
    constructor() {
        super();
    }

    start() {
        console.log("Main start. load game scene.");
        director.loadScene("game");
    }
}