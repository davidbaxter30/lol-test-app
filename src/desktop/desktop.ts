import { AppWindow } from "../AppWindow";
import { windowNames } from "../consts";
import SummonerInfoFetcher from "./utils/summonerInfoFetcher";

// The desktop window is the window displayed while Fortnite is not running.
// In our case, our desktop window has no logic - it only displays static data.
// Therefore, only the generic AppWindow class is called.
// new AppWindow(windowNames.desktop);

const interestingFeatures = [
  "game_flow",
  "summoner_info",
  "champ_select",
  "lcu_info",
  "lobby_info",
  "end_game",
  "game_info",
];

class Desktop extends AppWindow {
  private static _instance: Desktop;
  private _infoLog: HTMLElement;
  private _runningLauncher: overwolf.games.launchers.LauncherInfo;
  private _summonerInfoFetch: SummonerInfoFetcher;

  private constructor() {
    super(windowNames.desktop);
    this._infoLog = document.getElementById("infoLog");
    this._summonerInfoFetch = new SummonerInfoFetcher(this.onInfoUpdates);

    this.onInfoUpdates("hello world1");

    this.getLauncherInfo();
  }

  public static instance() {
    if (!this._instance) {
      this._instance = new Desktop();
    }

    return this._instance;
  }

  private getLauncherInfo() {
    overwolf.games.launchers.getRunningLaunchersInfo((info) => {
      this.onInfoUpdates("Getting running launchers: " + info.launchers.length);
      if (info.launchers.length) {
        this.onInfoUpdates("starting fetch");
        this._runningLauncher = info.launchers[0];
        const isStarted = this._summonerInfoFetch.start(info.launchers[0]);
        this.onInfoUpdates(isStarted);
      } else {
        setTimeout(this.getLauncherInfo, 1000);
        this.onInfoUpdates("waiting");
      }
    });
  }

  private onInfoUpdates(info) {
    this.logLine(this._infoLog, info, false);
  }

  private logLine(log: HTMLElement, data, highlight) {
    console.log(`${log.id}:`);
    console.log(data);
    const line = document.createElement("pre");
    line.textContent = JSON.stringify(data);

    if (highlight) {
      line.className = "highlight";
    }

    const shouldAutoScroll =
      log.scrollTop + log.offsetHeight > log.scrollHeight - 10;

    log.appendChild(line);

    if (shouldAutoScroll) {
      log.scrollTop = log.scrollHeight;
    }
  }
}

Desktop.instance();
