import sqlite3InitModule from "@sqlite.org/sqlite-wasm";

//Its readiness is urgently needed
const modulePromise = sqlite3InitModule({
  print: console.log,
  printErr: console.error,
});

/**
 * @type {{
 *   [key: string]: {
 *     creatingPromise: Promise<any>,
 *     db: any,
 *     poolUtil: import('@sqlite.org/sqlite-wasm').SAHPoolUtil,
 *   }
 * }}
 */
let workerState = {};

async function connect(name) {
  if (!workerState[name]) {
    workerState[name] = {
      creatingPromise: null,
      db: null,
      poolUtil: null,
    };
  }
  if (workerState[name].creatingPromise) {
    await workerState[name].creatingPromise;
    return name;
  }
  workerState[name].creatingPromise = new Promise(async (resolve, reject) => {
    try {
      const sqlite3 = await modulePromise;
      const poolUtil = await sqlite3.installOpfsSAHPoolVfs({
        name,
      });
      const db = new poolUtil.OpfsSAHPoolDb("common.db");

      // 设置为独占模式，doc: https://sqlite.org/wasm/doc/trunk/persistence.md 4.3
      db.exec("pragma locking_mode=exclusive");
      // 设置WAL模式.WAL模式下，checkPoint可以尝试在业务低谷期执行
      db.exec("pragma journal_mode=WAL");
      workerState[name].db = db;
      workerState[name].poolUtil = poolUtil;
      resolve(db);
    } catch (error) {
      reject(error);
    }
  });
  await workerState[name].creatingPromise;
  return name;
}

async function execute(name, sql) {
  const db = workerState[name].db;
  if (!db) {
    throw new Error("数据库未连接");
  }
  const result = db.exec(sql, {
    rowMode: "object",
  });
  console.log("execute", name, sql, result);
  return result;
}

async function close(name) {
  const db = workerState[name].db;
  const poolUtil = workerState[name].poolUtil;

  if (!db) {
    throw new Error("数据库未连接");
  }
  workerState[name] = undefined;
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  const fileNames = poolUtil.getFileNames();
  console.log("fileNames", fileNames);
  db.close();
  self.close();
}

const exportMethods = {
  connect,
  execute,
  close,
};

self.addEventListener("message", async (event) => {
  const { reqId, paths, args } = event.data;
  let result = {
    success: true,
    data: null,
    error: null,
  };
  console.log("worker message", event.data)
  try {
    result.data = await exportMethods[paths[0]](...args);
  } catch (error) {
    result.success = false;
    result.error = error;
  } finally {
  }

  self.postMessage({ reqId, result });
});
