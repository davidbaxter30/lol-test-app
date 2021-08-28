import { OWGamesEvents, OWListener } from "@overwolf/overwolf-api-ts";
import { AppWindow } from "../AppWindow";
import { windowNames } from "../consts";

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
  private _leagueGameEventsListener: OWGamesEvents;
  private _infoLog: HTMLElement;

  private constructor() {
    super(windowNames.desktop);
    this._infoLog = document.getElementById("infoLog");

    this._leagueGameEventsListener = new OWGamesEvents(
      {
        onInfoUpdates: this.onInfoUpdates.bind(this),
        onNewEvents: this.onInfoUpdates.bind(this),
      },
      interestingFeatures
    );

    this.onInfoUpdates("hello world");
  }

  public static instance() {
    if (!this._instance) {
      this._instance = new Desktop();
    }

    return this._instance;
  }

  public run() {
    this._leagueGameEventsListener.start();
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
