import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import { api, clearToken, setToken, token } from "./api.js";
import "./app.css";

const STATUS_LABEL = { soaking: "浸茧", reeling: "缫丝中", reeled: "已缫完" };

function fmtTime(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("zh-CN", { hour12: false });
}

function Login({ onOk }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("123456");
  const [err, setErr] = useState("");
  async function submit(e) {
    e.preventDefault();
    setErr("");
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setToken(data.access_token);
      onOk();
    } catch (ex) {
      setErr(ex.message);
    }
  }
  return (
    <div class="login">
      <h1>江口缫丝坞</h1>
      <p>汤温环盆作业台，不是列表台账。</p>
      <form onSubmit={submit} autocomplete="off">
        <label>
          用户名
          <input name="username" autocomplete="off" value={username} onInput={(e) => setUsername(e.target.value)} />
        </label>
        <label>
          密码
          <input name="password" type="password" autocomplete="off" value={password} onInput={(e) => setPassword(e.target.value)} />
        </label>
        <p class="hint">已预填 admin / 123456，另有 worker / 123456</p>
        <button type="submit">登录</button>
      </form>
      {err && <p class="err">{err}</p>}
    </div>
  );
}

function Yard({ board, refresh }) {
  const [picked, setPicked] = useState(null);
  const [temp, setTemp] = useState("40");
  const [err, setErr] = useState("");

  // 坞名一改，环面上的盆位对象整批换新，抽屉跟着对齐到同一盆。
  useEffect(() => {
    setPicked((cur) =>
      cur ? board.basins.find((b) => b.id === cur.id) || null : cur
    );
  }, [board]);

  const n = board.basins.length;
  async function writeTemp() {
    setErr("");
    try {
      await api(`/api/basins/${picked.id}/readings`, {
        method: "POST",
        body: JSON.stringify({ waterTempC: Number(temp) }),
      });
      await refresh();
    } catch (ex) {
      setErr(ex.message);
    }
  }
  async function setStatus(status) {
    setErr("");
    try {
      await api(`/api/basins/${picked.id}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      await refresh();
    } catch (ex) {
      setErr(ex.message);
    }
  }

  return (
    <div>
      <div class="ring">
        <div class="ring-title">{board.filature}</div>
        {board.basins.map((b, i) => {
          const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
          const left = 50 + Math.cos(angle) * 38;
          const top = 50 + Math.sin(angle) * 38;
          return (
            <button
              key={b.id}
              class={`basin ${b.status}`}
              style={{ left: `${left}%`, top: `${top}%` }}
              onClick={() => setPicked(b)}
            >
              <strong>{b.code}</strong>
              <span>{STATUS_LABEL[b.status]}</span>
            </button>
          );
        })}
      </div>
      {picked && (
        <div class="drawer">
          <h3>
            {board.filature} · {picked.code} · {STATUS_LABEL[picked.status]}
          </h3>
          <p>最近汤温：{picked.latestTempC ?? "无"} ℃ · 记录 {picked.readingCount} 次</p>
          <input value={temp} onInput={(e) => setTemp(e.target.value)} />
          <button onClick={writeTemp}>登记汤温</button>
          <div>
            <button onClick={() => setStatus("soaking")}>浸茧</button>
            <button onClick={() => setStatus("reeling")}>缫丝中</button>
            <button onClick={() => setStatus("reeled")}>已缫完</button>
          </div>
          {err && <p class="err">{err}</p>}
          <div class="stream">
            <h4>汤温流水 · {board.filature}</h4>
            {picked.readings.length === 0 ? (
              <p class="hint">暂无汤温记录</p>
            ) : (
              <ul>
                {picked.readings.map((r) => (
                  <li key={r.id}>
                    <strong>{r.waterTempC}℃</strong> · {r.operator} · {fmtTime(r.takenAt)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NamePage({ board, me, refresh }) {
  const isAdmin = me && me.role === "admin";
  const [name, setName] = useState(board.filature);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const blank = !name.trim();

  // 别的主管改完名，专页跟着服务器最新一版走。
  useEffect(() => {
    setName(board.filature);
  }, [board.filature]);

  async function save(e) {
    e.preventDefault();
    setErr("");
    setOk("");
    if (blank) {
      setErr("坞名不能为空");
      return;
    }
    try {
      await api("/api/filature/name", {
        method: "PUT",
        body: JSON.stringify({ name: name.trim() }),
      });
      await refresh();
      setOk("已保存，环面标题、抽屉抬头、汤温流水都已换新名。");
    } catch (ex) {
      setErr(ex.message);
    }
  }

  return (
    <div class="namepage">
      <h2>坞名专页</h2>
      <p class="hint">{board.riverside} · 改的是缫丝坞显示名，盆位与汤温数字不动。</p>
      {isAdmin ? (
        <form onSubmit={save} autocomplete="off">
          <label>
            缫丝坞显示名
            <input
              name="filatureName"
              value={name}
              onInput={(e) => {
                setName(e.target.value);
                setOk("");
              }}
            />
          </label>
          <button type="submit" disabled={blank}>
            保存
          </button>
          {blank && <p class="err">空名禁止保存</p>}
        </form>
      ) : (
        <div>
          <p class="mill-name">{board.filature}</p>
          <p class="hint">缫丝工只能查看坞名，改名请联系管理员。</p>
        </div>
      )}
      {err && <p class="err">{err}</p>}
      {ok && <p class="ok">{ok}</p>}
    </div>
  );
}

function Main() {
  const [me, setMe] = useState(null);
  const [board, setBoard] = useState(null);
  const [view, setView] = useState("yard");
  const [err, setErr] = useState("");

  async function refresh() {
    const data = await api("/api/board");
    setBoard(data);
    return data;
  }

  useEffect(() => {
    (async () => {
      try {
        const [meData] = await Promise.all([api("/api/auth/me"), refresh()]);
        setMe(meData);
      } catch (ex) {
        if (ex.status === 401) {
          clearToken();
          location.reload();
          return;
        }
        setErr(ex.message);
      }
    })();
  }, []);

  function logout() {
    clearToken();
    location.reload();
  }

  if (!board) {
    return <div class="yard">{err || "装载环盆…"}</div>;
  }

  return (
    <div class="yard">
      <div class="topbar">
        <div>
          <h1>{board.filature}</h1>
          <p>{board.riverside} · 点盆登记汤温；已缫完须最近汤温 38～42℃</p>
        </div>
        <nav class="tabs">
          <button class={view === "yard" ? "on" : ""} onClick={() => setView("yard")}>
            环盆作业台
          </button>
          <button class={view === "name" ? "on" : ""} onClick={() => setView("name")}>
            坞名专页
          </button>
        </nav>
        <div>
          {me && (
            <span class="who">
              {me.username} · {me.role === "admin" ? "管理员" : "缫丝工"}
            </span>
          )}
          <button onClick={logout}>退出</button>
        </div>
      </div>
      {view === "yard" ? (
        <Yard board={board} refresh={refresh} />
      ) : (
        <NamePage board={board} me={me} refresh={refresh} />
      )}
    </div>
  );
}

function App() {
  const [ready, setReady] = useState(Boolean(token()));
  return ready ? <Main /> : <Login onOk={() => setReady(true)} />;
}

render(<App />, document.getElementById("app"));
