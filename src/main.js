import { UniqueService } from "./uniqueService";
import { createAsyncCaller } from "./utils/caller";
import { createCounter, withResolvers } from "./utils/sundry";
import workerUrl from "./worker?url";

const addLine = (text, style) => {
  const box = document.getElementById("terminal");
  const line = document.createElement("div");
  line.classList.add("line");
  const dateDiv = document.createElement("div");
  line.appendChild(dateDiv);
  dateDiv.innerText = new Date().toLocaleString().slice(10);
  const textDiv = document.createElement("div");
  Object.keys(style ?? {}).forEach((key) => {
    line.style[key] = style[key];
  });
  textDiv.innerText = text;
  line.appendChild(textDiv);
  box.appendChild(line);
};

let worker = new Worker(workerUrl, {
  type: "module",
});
worker.addEventListener("message", (event) => {
  console.log("worker message", event.data);
});

let store = new Proxy(
  {
    connected: false,
  },
  {
    set(target, key, value) {
      target[key] = value;
      renderConnected();
      return true;
    },
  }
);

const reqIdCounter = createCounter();

const workerRequest = createAsyncCaller((paths, args) => {
  if (!worker) {
    worker = new Worker(workerUrl, {
      type: "module",
    });
  }
  const reqId = reqIdCounter();
  const resolver = withResolvers();
  const handler = (event) => {
    const { reqId: resReqId, result } = event.data;
    if (reqId === resReqId) {
      worker.removeEventListener("message", handler);
      if (result.success) {
        resolver.resolve(result.data);
      } else {
        resolver.reject(result.error);
      }
    }
  };
  worker.addEventListener("message", handler);
  worker.postMessage({
    paths,
    args,
    reqId,
  });
  const result = resolver.promise;
  return result;
});

const dbService = {
  start: async () => {
    await workerRequest.connect("test");
    store.connected = true;
    addLine("db connected", {
      color: "rgb(11, 228, 11)",
    });
  },
  stop: async () => {
    if (worker && store.connected) {
      await workerRequest.close("test");
      worker = null;
      store.connected = false;
      addLine("db closed", {
        color: "rgb(228, 11, 11)",
      });
    }
  },
};

const uniqueService = new UniqueService({
  name: "uniqueDB",
  start: dbService.start,
  stop: dbService.stop,
  onWillStart: () => {
    console.log("onWillStart");
  },
  onDidStart: () => {
    console.log("onDidStart");
  },
  onWillStop: () => {
    console.log("onWillStop");
  },
  onDidStop: () => {
    console.log("onDidStop");
  },
});

const startServiceElement = document.getElementById("startService");
const closeServiceElement = document.getElementById("closeService");
const trafficSignalElemnt = document.getElementById("traffic_signal");
const sqlSelectElement = document.getElementById("sql_select");
const sqlEditorElement = document.getElementById("sql_editor");
const executeElement = document.getElementById("execute");

function renderConnected() {
  startServiceElement.disabled = store.connected;
  closeServiceElement.disabled = !store.connected;
  trafficSignalElemnt.style.backgroundColor = store.connected ? "green" : "red";
}

function renderSql() {
  const sql = sqlSelectElement.value;
  let sqlText = "";
  if (sql === "c") {
    sqlText =
      "CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, name TEXT);";
  } else if (sql === "r") {
    sqlText = "SELECT * FROM test;";
  } else if (sql === "u") {
    sqlText = "UPDATE test SET name = 'test' WHERE id = 1 RETURNING *;";
  } else if (sql === "d") {
    sqlText = "DELETE FROM test WHERE id = 1 RETURNING *;";
  } else if (sql === "i") {
    sqlText = "INSERT INTO test (name) VALUES ('test') RETURNING *;";
  } else {
    sqlText = sql;
  }
  sqlEditorElement.innerText = sqlText;
}

startServiceElement.addEventListener("click", () => {
  uniqueService.claimOwnership();
});

closeServiceElement.addEventListener("click", () => {
  uniqueService.releaseOwnership();
});

sqlSelectElement.addEventListener("change", () => {
  renderSql();
});

executeElement.addEventListener("click", async () => {
  if (store.connected === false) {
  }
  const sql = sqlEditorElement.value;
  console.log(sql);
  const result = await workerRequest.execute("test", sql);
  console.log("result", result);
  addLine(`sql: ${sql}`, {
    color: "f2e1ef",
  });
  addLine(`result: ${JSON.stringify(result)}`, {
    color: "rgb(40, 252, 40)",
  });
});

renderConnected();
sqlSelectElement.dispatchEvent(new CustomEvent("change"));
