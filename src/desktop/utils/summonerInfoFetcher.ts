import SimpleIOPlugin from "./simpleIOPlugin";

class SummonerInfoFetcher {
  private SUMMONER_INFO_FETCHER_INTERVAL_MS = 2000;
  private SUMMONER_INFO_FETCHER_MAX_RETRIES = 20;
  private LOL_CEF_CLIENT_LOG_LISTENER_ID = "LOL_CEF_CLIENT_LOG_LISTENER_ID";
  private SUMMONER_NAME_REGEX =
    /\"localPlayerCellId\":(\d).*,\"myTeam\":(\[.*\])/;

  private _teamInfo;
  private _gameInfo;
  private _timerId;
  private _cefRegionTimer;
  private _cefSummonerNameTimer;
  private _logger;
  private _retries = 0;
  private _cefRegionRetries = 0;
  private _cefSummonerNameRetries = 0;
  private _fileListenerRetries = 0;
  private _gameRoot;
  private _ioPlugin;
  private _simpleIoPluginInstance: SimpleIOPlugin;

  constructor(logCallback) {
    this._logger = logCallback;
    this._simpleIoPluginInstance = new SimpleIOPlugin();
  }

  start(gameInfo) {
    this._logger(gameInfo.id);
    if (gameInfo == null) {
      this._logger("SummonerInfoFetcher - passed null gameInfo");
      return false;
    }

    this._logger("starting summoner info fetcher.");

    this._simpleIoPluginInstance.get((ioPlugin) => {
      this._ioPlugin = ioPlugin;

      stop();

      this._gameInfo = gameInfo;
      this._gameRoot = this._getGameRoot(gameInfo);

      this._retries = 0;
      this._cefRegionRetries = 0;
      this._cefSummonerNameRetries = 0;
      this._fileListenerRetries = 0;

      this._timerId = setTimeout(this._extractSummonerInfoCefClient, 0);
    });

    return true;
  }

  stop() {
    clearTimeout(this._timerId);
    clearTimeout(this._cefRegionTimer);
    clearTimeout(this._cefSummonerNameTimer);

    this._ioPlugin.stopFileListen(this.LOL_CEF_CLIENT_LOG_LISTENER_ID);
    this._ioPlugin.onFileListenerChanged.removeListener(
      this._cefClientLogFileListener
    );
  }

  private _getGameRoot(gameInfo) {
    let gameRoot;
    let gamePath = gameInfo.path;
    let pathIndex = gamePath.indexOf("RADS");

    if (pathIndex < 0) {
      pathIndex = gamePath.lastIndexOf("/") + 1;
    }

    gameRoot = gamePath.substring(0, pathIndex);
    return gameRoot;
  }

  private _extractSummonerInfoCefClient() {
    this._getRegionCefClient(this.regionCallback);
    this._getSummonerNameCefClient(this.summonerNameCallback);
  }

  private _getRegionCefClient(callback) {
    this._cefRegionRetries++;
    if (this._cefRegionRetries === this.SUMMONER_INFO_FETCHER_MAX_RETRIES) {
      this._logger("SummonerInfoFetcher - CEF region reached max retries!");
      this.sendTrack("REGION_FETCH_FAILURE");
      stop();
      return;
    }

    let filename = this._gameRoot + "Config/LeagueClientSettings.yaml";
    let regEx = /region:\s*"(.*)"/gim;
    this._logger("extract region from new client: " + filename);
    this._extractRegionFromFile(filename, regEx, callback);
  }

  // callback = function(status, statusReason, region)
  private _extractRegionFromFile(filename, regEx, callback) {
    if (!this._ioPlugin) {
      return callback(false, "no IO plugin", null);
    }

    this._ioPlugin.getTextFile(filename, false, (status, data) => {
      if (!status) {
        return setTimeout(function () {
          callback(false, "failed to read " + filename, null);
        }, 1);
      }

      let match = regEx.exec(data);

      if (null == match || match.length !== 2) {
        return setTimeout(function () {
          callback(false, "failed to read region from " + filename, null);
        }, 1);
      }

      return setTimeout(function () {
        callback(true, null, match[1].toUpperCase());
      }, 1);
    });
  }

  private regionCallback(status, statusReason, region) {
    // if we fail - retry
    if (!status) {
      this._logger(statusReason);

      this._cefRegionTimer = setTimeout(() => {
        this._getRegionCefClient(this.regionCallback);
      }, this.SUMMONER_INFO_FETCHER_INTERVAL_MS);

      return;
    }

    let div = document.getElementById("region");
    div.innerHTML = region;
    console.info(`My region: ${region}`);
  }

  private summonerNameCallback(status, statusReason) {
    // if we fail - retry
    if (!status) {
      this._logger(statusReason);

      this._cefSummonerNameTimer = setTimeout(() => {
        this._getSummonerNameCefClient(this.summonerNameCallback);
      }, this.SUMMONER_INFO_FETCHER_INTERVAL_MS);
    }
  }

  private _getSummonerNameCefClient(callback) {
    let path = this._gameRoot + "Logs/LeagueClient Logs/";
    let filePattern = path + "*_LeagueClient.log";

    this._cefSummonerNameRetries++;
    if (
      this._cefSummonerNameRetries === this.SUMMONER_INFO_FETCHER_MAX_RETRIES
    ) {
      this._logger("SummonerInfoFetcher - CEF region reached max retries!");
      this.sendTrack("SUMMONER_NAME_FETCH_FAILURE");
      stop();
      return;
    }

    this._ioPlugin.getLatestFileInDirectory(
      filePattern,
      (status, logFileName) => {
        if (!status || !logFileName.endsWith(".log")) {
          return callback(false, "couldn't find log file", null);
        }

        this._ioPlugin.onFileListenerChanged.removeListener(
          this._cefClientLogFileListener
        );
        this._ioPlugin.onFileListenerChanged.addListener(
          this._cefClientLogFileListener
        );

        let fullLogPath = path + logFileName;
        this._listenOnCefClientLog(fullLogPath, callback);
      }
    );
  }

  private _listenOnCefClientLog(fullLogPath, callback) {
    let skipToEnd = false;

    this._logger("starting to listen on " + fullLogPath);
    this._fileListenerRetries++;

    if (this._fileListenerRetries >= this.SUMMONER_INFO_FETCHER_MAX_RETRIES) {
      this._ioPlugin.stopFileListen(this.LOL_CEF_CLIENT_LOG_LISTENER_ID);
      this._ioPlugin.onFileListenerChanged.removeListener(
        this._cefClientLogFileListener
      );
      callback(false, "failed to stream cef log file", null);
      return;
    }

    this._ioPlugin.listenOnFile(
      this.LOL_CEF_CLIENT_LOG_LISTENER_ID,
      fullLogPath,
      skipToEnd,
      (id, status, data) => {
        if (!status) {
          this._logger(
            "failed to stream " + id + " (" + data + "), retrying..."
          );
          return setTimeout(this._listenOnCefClientLog, 500);
        }

        this._logger("now streaming " + id);
        callback(true);
      }
    );
  }

  private _cefClientLogFileListener(id, status, line) {
    if (id !== this.LOL_CEF_CLIENT_LOG_LISTENER_ID) {
      return;
    }

    if (!status) {
      this._logger("received an error on file: " + id + ": " + line);
      return;
    }

    if (line.includes("Shut down EventCollector")) {
      this._logger(
        "EventCollector shut down detected, switching to new log file..."
      );
      setTimeout(this.getNewLeagueClientLog, 3000);
    }

    if (line.includes("lol-champ-select|") && !this._teamInfo) {
      // looking for specific actions instead of the whole actions JSON
      // since sometimes the actions JSON is invalid

      let matches = line.match(this.SUMMONER_NAME_REGEX);
      if (matches && matches.length >= 3) {
        try {
          let localPlayerCellId = Number(matches[1]);
          let myTeam = matches[2];
          myTeam = myTeam.substring(0, myTeam.indexOf("]") + 1);
          this._teamInfo = JSON.parse(myTeam);
          this._printMyTeam(localPlayerCellId, this._teamInfo);
        } catch (e) {
          this._logger("failed to parse log line: " + e.message);
          this._teamInfo = null;
        }
      }
    }

    if (
      line.includes("GAMEFLOW_EVENT.QUIT_TO_LOBBY") ||
      line.includes("GAMEFLOW_EVENT.TERMINATED") ||
      line.includes("lol-end-of-game| Game client is now not running")
    ) {
      // return to lobby (dodge?)
      this._teamInfo = null;
      this._printMyTeam(null, []);
    }
  }

  private _printMyTeam(localPlayerCellId, myTeam) {
    let team = "TEAM:<br>";
    let me = "ME:<br>";

    for (let playerInfo of myTeam) {
      let summonerId = playerInfo.summonerId;
      if (playerInfo.cellId === localPlayerCellId) {
        me += summonerId;
      } else {
        team += summonerId + "<br>";
      }
    }
    this._logger(team + "<br>" + me);
    // this._logger(myTeam);
  }

  private getNewLeagueClientLog() {
    clearTimeout(this._cefSummonerNameTimer);

    this._ioPlugin.stopFileListen(this.LOL_CEF_CLIENT_LOG_LISTENER_ID);
    this._ioPlugin.onFileListenerChanged.removeListener(
      this._cefClientLogFileListener
    );

    this._cefSummonerNameRetries = 0;
    this._getSummonerNameCefClient(this.summonerNameCallback);
  }

  /**
   * Send tracking/monitoring info
   * @param info
   */
  private sendTrack(info) {
    let URL_TRACKING = "http://bugs.somewhere.com/endpoint";
    let payload = {
      info: info,
    };

    let xmlhttp = new XMLHttpRequest();
    xmlhttp.open("POST", URL_TRACKING);
    xmlhttp.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    xmlhttp.send(JSON.stringify(payload));
  }
}

export default SummonerInfoFetcher;
