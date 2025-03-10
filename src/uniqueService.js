import { withResolvers, cacheGetClientId } from "./utils/sundry";

/**
 * @typedef {Object} UniqueServiceOptions
 * @property {string} name
 * @property {number} [maxAttempts] - max attempts to claim ownership
 * @property {()=>Promise<any>} start
 * @property {()=>Promise<any>} stop
 * @property {()=>Promise<any>} [onWillStart]
 * @property {()=>Promise<any>} [onDidStart]
 * @property {()=>Promise<any>} [onWillStop]
 * @property {()=>Promise<any>} [onDidStop]
 */
/**
 * @description Ensure that only one service instance runs in a multi-tab environment, other tabs can request the current owner to release ownership, and the applicant can take over the service.
 */
export class UniqueService {
  options;
  #ownership = false;
  #isClaiming = false;
  #channel;
  #releaser;

  get name() {
    return this.options.name;
  }
  /**
   * @param {UniqueServiceOptions} options
   */
  constructor(options) {
    this.options = {
      maxAttempts: 5,
      ...options,
    };
    this.#channel = new BroadcastChannel(this.options.name);
    this.#initChannel();
  }

  #initChannel = async () => {
    const selfClientId = await cacheGetClientId();
    this.#channel.addEventListener("message", async (ev) => {
      const { type, targetId } = ev.data;

      if (type === "claimOwnership") {
        if (targetId === selfClientId) {
          console.warn(
            `[UniqueService] ${this.name} received message from self, ignoring.`
          );
          return;
        }
        if (this.#ownership === false) {
          console.warn(
            `[UniqueService] ${this.name} already has ownership, ignoring.`
          );
          return;
        }
        console.log(
          `[UniqueService] ${this.name} received claimOwnership message, close soon .`
        );
        const res = await this.releaseOwnership();
        if (res) {
          this.#channel.postMessage({
            type: "handleClaimOwnership",
            targetId,
          });
        }
      }

      if (type === "handleClaimOwnership") {
        if (targetId !== selfClientId) {
          return;
        }
        if (this.#ownership === true) {
          console.warn(
            `[UniqueService] ${this.name} already has ownership, ignoring.`
          );
          return;
        }
        console.log(
          `[UniqueService] ${this.name} received handleClaimOwnership message, start soon.`
        );
        await this.claimOwnership();
      }
    });
  };

  async #start() {
    try {
      await this.options.onWillStart?.();
      await this.options.start();
      this.#ownership = true;
      await this.options.onDidStart?.();
    } catch (e) {
      console.error(`[UniqueService] Start failed: ${e}`);
      if (this.#releaser) {
        this.#releaser.resolve(); // 释放锁
        this.#releaser = null;
      }
      throw e;
    }
  }

  async #stop() {
    try {
      await this.options.onWillStop?.();
      await this.options.stop();
      if (this.#releaser) {
        this.#releaser.resolve();
        this.#releaser = null;
      }
      await this.options.onDidStop?.();
    } catch (e) {
      console.error(`[UniqueService] Stop failed: ${e}`);
      throw e;
    } finally {
      if (this.#releaser) {
        this.#releaser.resolve();
        this.#releaser = null;
      }
    }
  }

  claimOwnership = async () => {
    if (this.#ownership || this.#isClaiming) {
      console.warn(
        `[UniqueService] ${this.options.name} already has ownership, ignoring.`
      );
      return;
    }
    this.#isClaiming = true;
    const selfClientId = await cacheGetClientId();
    const releaser = withResolvers(); 
    this.#releaser = releaser;

    try {
      let attempts = 0;
      while (attempts < this.options.maxAttempts) {
        const lockAcquired = await new Promise((resolve) => {
          navigator.locks.request(
            this.options.name,
            { ifAvailable: true, mode: "exclusive" },
            (lock) => {
              resolve(!!lock);
              if (lock) {
                return releaser.promise;
              }
            }
          );
        });

        if (lockAcquired) {
          await this.#start();
          break;
        }

        this.#channel.postMessage({
          type: "claimOwnership",
          targetId: selfClientId,
        });
        await new Promise((resolve) => setTimeout(resolve, 240));
        attempts++;
      }
      if (attempts >= this.options.maxAttempts) {
        throw new Error("Max attempts reached");
      }
    } catch (error) {
      console.error(`[UniqueService] Claim ownership failed: ${error}`);
      this.#releaser = null;
      throw error;
    } finally {
      this.#isClaiming = false;
    }

    releaser.promise.finally(() => {
      this.#releaser = null;
      this.#ownership = false;
    });
  };

  releaseOwnership = async () => {
    if (this.#releaser) {
      await this.#stop();
      return true;
    }
    return false;
  };

  hasOwnership = () => {
    return this.#ownership;
  };
}
