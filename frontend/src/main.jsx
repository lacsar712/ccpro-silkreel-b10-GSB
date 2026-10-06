import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import {
  api,
  clearToken,
  clearUser,
  getUser,
  setToken,
  setUser,
  token,
} from "./api.js";
import "./app.css";

const STATUS_LABEL = { soaking: "浸茧", reeling: "缫丝中", reeled: "已缫完" };

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
      setUser(data.user);
      onOk(data.user);
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

function Topbar({ board, view, onNav, onLogout }) {
  return (
    <div class="topbar">
      <div>
        <h1>{board ? board.filature : "…"}</h1>
        <p>{board ? board.riverside : ""} · 点盆登记汤温；已缫完须最近汤温 38～42℃</p>
      </div>
      <nav class="tabs">
        <button class={view === "yard" ? "tab active" : "tab"} onClick={() => onNav("yard")}>
          环盆作业台
        </button>
        <button class={view === "dock" ? "tab active" : "tab"} onClick={() => onNav("dock")}>
          坞名专页
        </button>
        <button class="tab" onClick={onLogout}>退出</button>
      </nav>
    </div>
  );
}

function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("zh-CN", { hour12: false });
}

function Yard({ board, refresh }) {
  const [picked, setPicked] = useState(null);
  const [temp, setTemp] = useState("40");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (picked) {
      setPicked(board.basins.find((b) => b.id === picked.id) || null);
    }
  }, [board]);

  const n = board.basins.length;
  async function writeTemp() {
    setErr("");
    try {
      const row = await api(`/api/basins/${picked.id}/readings`, {
        method: "POST",
        body: JSON.stringify({ waterTempC: Number(temp) }),
      });
      await refresh();
      setPicked(row);
    } catch (ex) {
      setErr(ex.message);
    }
  }
  async function setStatus(status) {
    setErr("");
    try {
      const row = await api(`/api/basins/${picked.id}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      await refresh();
      setPicked(row);
    } catch (ex) {
      setErr(ex.message);
    }
  }

  return (
    <div>
      <div class="ring">
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
          <div class="feed">
            <h4>{board.filature} · 汤温流水</h4>
            {picked.readings && picked.readings.length ? (
              <ul>
                {picked.readings.map((r) => (
                  <li key={r.id}>
                    {fmtTime(r.takenAt)} · {r.waterTempC}℃ · {r.operator}
                  </li>
                ))}
              </ul>
            ) : (
              <p class="hint">暂无汤温记录</p>
            )}
          </div>
          {err && <p class="err">{err}</p>}
        </div>
      )}
    </div>
  );
}

function DockPage({ board, user, refresh }) {
  const isAdmin = user.role === "admin";
  const [name, setName] = useState(board.filature);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    setName(board.filature);
  }, [board.filature]);

  async function save(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    const trimmed = name.trim();
    if (!trimmed) {
      setErr("坞名不能为空");
      return;
    }
    try {
      await api("/api/filature/name", {
        method: "POST",
        body: JSON.stringify({ name: trimmed }),
      });
      await refresh();
      setMsg("已保存，环面标题、抽屉抬头、汤温流水同步换新名。");
    } catch (ex) {
      setErr(ex.message);
    }
  }

  return (
    <div class="dockpage">
      <h2>坞名专页</h2>
      <p>
        当前坞名：<strong>{board.filature}</strong>（{board.riverside}）
      </p>
      {isAdmin ? (
        <form onSubmit={save} autocomplete="off">
          <label>
            新坞名
            <input
              name="filatureName"
              value={name}
              onInput={(e) => setName(e.target.value)}
              placeholder="不能为空"
            />
          </label>
          <button type="submit" disabled={!name.trim()}>
            保存坞名
          </button>
          <p class="hint">
            保存后环面标题、抽屉抬头、汤温流水同步换新名；空名禁止保存；改名不动盆位与汤温数字。
          </p>
        </form>
      ) : (
        <p class="hint">缫丝工仅可查看坞名，改名请联系主管。</p>
      )}
      {err && <p class="err">{err}</p>}
      {msg && <p class="ok">{msg}</p>}
    </div>
  );
}

function Main({ user, onLogout }) {
  const [board, setBoard] = useState(null);
  const [view, setView] = useState("yard");
  const [err, setErr] = useState("");

  async function refresh() {
    const data = await api("/api/board");
    setBoard(data);
    return data;
  }

  useEffect(() => {
    refresh().catch((e) => setErr(e.message));
  }, []);

  return (
    <div class="yard">
      <Topbar board={board} view={view} onNav={setView} onLogout={onLogout} />
      {err && <p class="err">{err}</p>}
      {!board ? (
        "装载环盆…"
      ) : view === "yard" ? (
        <Yard board={board} refresh={refresh} />
      ) : (
        <DockPage board={board} user={user} refresh={refresh} />
      )}
    </div>
  );
}

function App() {
  const [user, setUserState] = useState(getUser());

  useEffect(() => {
    if (token() && !user) {
      api("/api/auth/me")
        .then((u) => {
          setUser(u);
          setUserState(u);
        })
        .catch(() => {
          clearToken();
          clearUser();
        });
    }
  }, []);

  if (token() && !user) return null;

  return user ? (
    <Main
      user={user}
      onLogout={() => {
        clearToken();
        clearUser();
        setUserState(null);
      }}
    />
  ) : (
    <Login onOk={(u) => setUserState(u)} />
  );
}

render(<App />, document.getElementById("app"));
