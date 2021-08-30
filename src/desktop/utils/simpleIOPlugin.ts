class SimpleIOPlugin {
  private _simpleIOPlugin = null;
  private MAX_RETRIES = 5;
  private retries = 0;

  constructor() {}

  public get(callback) {
    if (this._simpleIOPlugin) {
      return callback(this._simpleIOPlugin);
    }

    return this.loadIOPlugin(callback);
  }

  private loadIOPlugin(callback) {
    callback = callback || function () {};

    if (this._simpleIOPlugin) {
      return callback(this._simpleIOPlugin);
    }

    overwolf.extensions.current.getExtraObject(
      "simple-io-plugin",
      (result: any) => {
        if (result.status == "success") {
          this._simpleIOPlugin = result.object;
          callback(this._simpleIOPlugin);
          return;
        }

        if (this.retries >= this.MAX_RETRIES) {
          console.log("reached max retries for ioplugin");
          return callback(null);
        }

        console.log("Fail to load ioplugin, retrying", result);
        this.retries++;
        setTimeout(() => {
          this.loadIOPlugin(callback);
        }, 500);
      }
    );
  }
}

export default SimpleIOPlugin;
