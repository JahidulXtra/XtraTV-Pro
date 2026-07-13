// Capacitor ScreenOrientation plugin — web implementation, backed by
// the native screen.orientation API. n = Capacitor's base WebPlugin class.
import { W as n } from "./app.js";

class o extends n {
  constructor() {
    super();
    // re-broadcast native orientation changes to Capacitor listeners
    typeof screen < "u" &&
      typeof screen.orientation < "u" &&
      screen.orientation.addEventListener("change", () => {
        const e = screen.orientation.type;
        this.notifyListeners("screenOrientationChange", { type: e });
      });
  }

  async orientation() {
    if (typeof screen > "u" || !screen.orientation)
      throw this.unavailable(
        "ScreenOrientation API not available in this browser",
      );
    return { type: screen.orientation.type };
  }

  async lock(e) {
    if (typeof screen > "u" || !screen.orientation || !screen.orientation.lock)
      throw this.unavailable(
        "ScreenOrientation API not available in this browser",
      );
    try {
      await screen.orientation.lock(e.orientation);
    } catch {
      throw this.unavailable(
        "ScreenOrientation API not available in this browser",
      );
    }
  }

  async unlock() {
    if (
      typeof screen > "u" ||
      !screen.orientation ||
      !screen.orientation.unlock
    )
      throw this.unavailable(
        "ScreenOrientation API not available in this browser",
      );
    try {
      screen.orientation.unlock();
    } catch {
      throw this.unavailable(
        "ScreenOrientation API not available in this browser",
      );
    }
  }
}
export { o as ScreenOrientationWeb };
