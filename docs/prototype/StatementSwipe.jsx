import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Check, Search, Layers, RotateCcw, Upload, ShieldAlert,
  X, FolderPlus, ChevronLeft, ChevronRight, Flag, Wallet, CheckCircle2,
  FileText, ArrowRight, Sparkles, Trash2, Folder, Pencil
} from "lucide-react";
import Papa from "papaparse";

// ---- palette (inline styles; Tailwind base classes don't ship arbitrary hex) ----
const C = {
  ink: "#101119", inkSoft: "#191B26", inkLift: "#20222F",
  paper: "#FBFAF6", paperEdge: "#EAE7DC",
  approve: "#12A150", investigate: "#E0872B", pile: "#6D5CE7",
  flag: "#E5484D", wait: "#3B82F6",
  textInk: "#16171D", textMute: "#7A7C88", hairline: "#2A2C39",
};
const mono = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontVariantNumeric: "tabular-nums" };

const ACTIONS = {
  todo: { label: "To do", color: C.investigate },
  waiting: { label: "Waiting", color: C.wait },
  done: { label: "Done", color: C.approve },
};
const ACTION_CYCLE = [null, "todo", "waiting", "done"];

const DEMO = [
  { d: "TRADER JOE'S #512 BOSTON MA", a: 87.43, dt: "Mar 03", cat: "Groceries" },
  { d: "SQ *DD BAR LLC 8004563", a: 164.2, dt: "Mar 05", cat: "Dining" },
  { d: "NETFLIX.COM 866-579-7", a: 15.49, dt: "Mar 06", cat: "Subscription" },
  { d: "AMZN MKTP US*RT4G9Q1", a: 23.99, dt: "Mar 07", cat: "Shopping" },
  { d: "WAYFAIR *ORDER 99120", a: 312.0, dt: "Mar 08", cat: "Home" },
  { d: "PADDLE.NET* BUNDLEXQ", a: 89.0, dt: "Mar 09", cat: "—", sus: true, loc: "Valletta, MT" },
  { d: "SHELL OIL 574123900", a: 52.3, dt: "Mar 10", cat: "Gas" },
  { d: "DOORDASH*CHIPOTLE", a: 28.44, dt: "Mar 11", cat: "Dining" },
  { d: "SEPHORA #123 NEWBURY", a: 88.0, dt: "Mar 12", cat: "Shopping" },
  { d: "DIGITALOCEAN.COM", a: 12.0, dt: "Mar 13", cat: "Software" },
  { d: "UBER *EATS PENDING", a: 34.1, dt: "Mar 14", cat: "Dining" },
  { d: "SQ *THE COMEDY STUDIO", a: 210.0, dt: "Mar 15", cat: "Entertainment" },
  { d: "APLPAY 8299 GLOBAL DIGI", a: 419.55, dt: "Mar 16", cat: "—", sus: true, loc: "Amsterdam, NL" },
  { d: "H MART CAMBRIDGE", a: 41.02, dt: "Mar 17", cat: "Groceries" },
  { d: "SPOTIFY USA", a: 11.99, dt: "Mar 18", cat: "Subscription" },
  { d: "CVS/PHARMACY #4021", a: 19.87, dt: "Mar 19", cat: "Health" },
];

const mkTxns = (rows) =>
  rows.map((r, i) => ({
    id: `t${i}_${Math.random().toString(36).slice(2, 7)}`,
    desc: r.d, amount: r.a, date: r.dt || "", cat: r.cat || "—",
    sus: !!r.sus, loc: r.loc || null,
    status: "unreviewed", pileId: null, action: null, note: "",
  }));

const usd = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PAYMENT_RX = /payment|autopay|thank you|online pmt|e-payment/i;
const STORE_KEY = "statement-swipe-session-v1";
const hasStore = typeof window !== "undefined" && window.storage;

export default function StatementSwipe() {
  const [ready, setReady] = useState(false);
  const [txns, setTxns] = useState([]);
  const [index, setIndex] = useState(0);
  const [screen, setScreen] = useState("import"); // import | deck | summary | pile
  const [openPile, setOpenPile] = useState(null);
  const [piles, setPiles] = useState([]);
  const [confirmDel, setConfirmDel] = useState(null);
  const [history, setHistory] = useState([]);
  const [investigating, setInvestigating] = useState(null);
  const [showPiles, setShowPiles] = useState(false);
  const [newPile, setNewPile] = useState("");
  const [label, setLabel] = useState("");

  // import state
  const [rawRows, setRawRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [map, setMap] = useState({ desc: "", amount: "", date: "" });
  const [negPurchase, setNegPurchase] = useState(false);
  const [fileName, setFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [released, setReleased] = useState(false);
  const drag = useRef({ on: false, x: 0, y: 0 });
  const fileRef = useRef(null);
  const saveTimer = useRef(null);

  const current = txns[index] || null;
  const sourceTotal = useMemo(() => txns.reduce((s, t) => s + t.amount, 0), [txns]);
  const reviewedCount = txns.filter((t) => t.status !== "unreviewed").length;

  // ---- restore saved session on mount ----
  useEffect(() => {
    (async () => {
      if (hasStore) {
        try {
          const res = await window.storage.get(STORE_KEY);
          const s = res && res.value ? JSON.parse(res.value) : null;
          if (s && Array.isArray(s.txns) && s.txns.length) {
            setTxns(s.txns); setIndex(s.index || 0); setPiles(s.piles || []);
            setScreen(s.screen && s.screen !== "import" ? s.screen : "deck");
            setLabel(s.label || ""); setOpenPile(s.openPile || null);
          }
        } catch (e) { /* no saved session yet */ }
      }
      setReady(true);
    })();
  }, []);

  // ---- persist session on change (debounced) ----
  useEffect(() => {
    if (!ready || !hasStore || screen === "import" || !txns.length) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try { window.storage.set(STORE_KEY, JSON.stringify({ txns, index, piles, screen, label, openPile })); } catch (e) {}
    }, 400);
  }, [ready, txns, index, piles, screen, label, openPile]);

  useEffect(() => {
    if (screen === "deck" && txns.length && index >= txns.length) setScreen("summary");
  }, [index, txns.length, screen]);

  useEffect(() => {
    if (screen === "pile" && !piles.some((p) => p.id === openPile)) setScreen("summary");
  }, [screen, openPile, piles]);

  const snapshot = () => setHistory((h) => [...h, { txns, index }]);
  const updateTxn = (id, patch) => setTxns((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const commit = (status, pileId, dir) => {
    snapshot();
    setTxns((prev) => prev.map((t, i) => (i === index ? { ...t, status, pileId } : t)));
    setReleased(true);
    if (dir === "right") { setDragX(720); setDragY(40); }
    else if (dir === "left") { setDragX(-720); setDragY(40); }
    else { setDragY(-820); }
    setTimeout(() => { setDragX(0); setDragY(0); setReleased(false); setIndex((i) => i + 1); }, 230);
  };

  const approve = () => commit("approved", null, "right");
  const investigate = () => { setReleased(true); setDragX(0); setDragY(0); setInvestigating(current); };
  const openPileSheet = () => { setReleased(true); setDragX(0); setDragY(0); setShowPiles(true); };

  const undo = () => {
    setHistory((h) => {
      if (!h.length) return h;
      const last = h[h.length - 1];
      setTxns(last.txns); setIndex(last.index); setScreen("deck");
      setDragX(0); setDragY(0); setReleased(false); setInvestigating(null); setShowPiles(false);
      return h.slice(0, -1);
    });
  };

  const restart = () => {
    setTxns((prev) => prev.map((t) => ({ ...t, status: "unreviewed", pileId: null, action: null, note: "" })));
    setIndex(0); setHistory([]); setScreen("deck"); setPiles([]); setConfirmDel(null); setOpenPile(null);
    setDragX(0); setDragY(0); setReleased(false);
  };

  const pileCount = (id) => txns.filter((t) => t.pileId === id && t.status === "piled").length;
  const removePile = (id) => {
    setTxns((prev) => prev.map((t) => t.pileId === id ? { ...t, pileId: null, status: t.status === "piled" ? "approved" : t.status } : t));
    setPiles((prev) => prev.filter((p) => p.id !== id));
    setConfirmDel(null);
  };
  const requestDelete = (id) => { pileCount(id) === 0 ? removePile(id) : setConfirmDel(id); };
  const closePiles = () => { setShowPiles(false); setConfirmDel(null); setNewPile(""); };
  const createAndFile = () => {
    const n = newPile.trim(); if (!n) return;
    const id = n.toLowerCase().replace(/\s+/g, "-") + Math.random().toString(36).slice(2, 5);
    setPiles((prev) => [...prev, { id, name: n }]);
    setNewPile(""); setShowPiles(false); setConfirmDel(null);
    commit("piled", id, "up");
  };

  // ---------- import ----------
  const parseFile = (file) => {
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const rows = res.data.filter((r) => Object.values(r).some((v) => String(v).trim()));
        if (!rows.length) return alert("That file looked empty.");
        const hs = Object.keys(rows[0]).map((k) => k.trim()).filter(Boolean);
        const find = (subs) => hs.find((k) => subs.some((s) => k.toLowerCase().includes(s))) || "";
        const aK = find(["amount", "debit"]), nK = find(["description", "merchant", "name", "payee", "memo"]), tK = find(["date"]);
        let neg = 0, pos = 0;
        rows.forEach((r) => { const v = parseFloat(String(r[aK] ?? "").replace(/[$,]/g, "")); if (!isNaN(v)) (v < 0 ? neg++ : pos++); });
        setRawRows(rows); setHeaders(hs); setMap({ desc: nK, amount: aK, date: tK }); setNegPurchase(neg > pos); setFileName(file.name);
      },
      error: () => alert("Couldn't read that file. Make sure it's a CSV export from your bank."),
    });
  };

  const buildValid = useMemo(() => {
    if (!map.desc || !map.amount || !rawRows.length) return [];
    return rawRows.map((r) => {
      const n = parseFloat(String(r[map.amount] ?? "").replace(/[$,]/g, "").trim());
      return { d: String(r[map.desc] ?? "").trim(), n, dt: map.date ? String(r[map.date] ?? "").trim() : "" };
    }).filter((x) => x.d && !isNaN(x.n) && (negPurchase ? x.n < 0 : x.n > 0) && !PAYMENT_RX.test(x.d))
      .map((x) => ({ d: x.d, a: Math.abs(x.n), dt: x.dt, cat: "—" }));
  }, [rawRows, map, negPurchase]);

  const importTotal = buildValid.reduce((s, r) => s + r.a, 0);
  const startReview = () => {
    if (!buildValid.length) return;
    setTxns(mkTxns(buildValid)); setIndex(0); setHistory([]); setPiles([]); setConfirmDel(null); setOpenPile(null);
    setLabel(fileName.replace(/\.[^.]+$/, "")); setScreen("deck");
  };
  const loadSample = () => {
    setTxns(mkTxns(DEMO)); setIndex(0); setHistory([]); setPiles([]); setConfirmDel(null); setOpenPile(null);
    setLabel("March 2026 · Sample"); setScreen("deck");
  };
  const goImport = () => { setScreen("import"); setInvestigating(null); setShowPiles(false); setOpenPile(null); };

  // keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (screen !== "deck" || investigating || showPiles || !current) return;
      if (e.key === "ArrowRight") approve();
      else if (e.key === "ArrowLeft") investigate();
      else if (e.key === "ArrowUp") openPileSheet();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onDown = (e) => { if (!current) return; drag.current = { on: true, x: e.clientX, y: e.clientY }; setReleased(false); e.currentTarget.setPointerCapture?.(e.pointerId); };
  const onMove = (e) => { if (!drag.current.on) return; setDragX(e.clientX - drag.current.x); setDragY(e.clientY - drag.current.y); };
  const onUp = () => {
    if (!drag.current.on) return;
    drag.current.on = false;
    const dx = dragX, dy = dragY, T = 92;
    if (dy < -T && Math.abs(dy) > Math.abs(dx)) openPileSheet();
    else if (dx > T) approve();
    else if (dx < -T) investigate();
    else { setReleased(true); setDragX(0); setDragY(0); }
  };

  const vertical = Math.abs(dragY) > Math.abs(dragX) && dragY < 0;
  const okOp = !vertical && dragX > 8 ? Math.min(dragX / 120, 1) : 0;
  const lookOp = !vertical && dragX < -8 ? Math.min(-dragX / 120, 1) : 0;
  const pileOp = vertical ? Math.min(-dragY / 120, 1) : 0;
  const rot = dragX / 18;
  const mapReady = map.desc && map.amount;

  const activePile = piles.find((p) => p.id === openPile);
  const activeItems = txns.filter((t) => t.pileId === openPile && t.status === "piled");

  return (
    <div className="w-full flex justify-center py-6" style={{ background: "#08080C", minHeight: "100vh" }}>
      <div className="relative w-full flex flex-col overflow-hidden select-none"
        style={{ maxWidth: 400, height: 780, background: C.ink, borderRadius: 34, boxShadow: "0 30px 80px rgba(0,0,0,.5)", border: `1px solid ${C.hairline}` }}>

        {/* header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <button onClick={undo} disabled={!history.length || screen !== "deck"} className="flex items-center justify-center rounded-full transition"
            style={{ width: 38, height: 38, background: C.inkSoft, color: (history.length && screen === "deck") ? "#C9CBD6" : "#4A4C58", border: `1px solid ${C.hairline}` }}>
            <RotateCcw size={17} />
          </button>
          <div className="text-center">
            <div style={{ color: C.textMute, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>Statement</div>
            <div style={{ color: "#EDEEF2", fontSize: 14, fontWeight: 600 }}>{screen === "import" ? "New import" : label}</div>
          </div>
          <button onClick={goImport} title="Import a statement" className="flex items-center justify-center rounded-full transition"
            style={{ width: 38, height: 38, background: screen === "import" ? C.pile : C.inkSoft, color: screen === "import" ? "white" : "#C9CBD6", border: `1px solid ${screen === "import" ? C.pile : C.hairline}` }}>
            <Upload size={17} />
          </button>
        </div>

        {screen === "deck" && (
          <div className="px-5 pb-2">
            <div className="flex items-center justify-between mb-2" style={{ color: C.textMute, fontSize: 12 }}>
              <span style={mono}>{reviewedCount} of {txns.length}</span>
              <span style={mono}>${usd(sourceTotal)}</span>
            </div>
            <div style={{ height: 4, background: C.inkSoft, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${txns.length ? (reviewedCount / txns.length) * 100 : 0}%`, background: C.approve, transition: "width .3s" }} />
            </div>
          </div>
        )}

        {!ready ? (
          <div className="flex-1 flex items-center justify-center" style={{ color: C.textMute, fontSize: 13 }}>Loading…</div>
        ) : (
          <>
            {/* IMPORT */}
            {screen === "import" && (
              <div className="flex-1 overflow-auto px-5 py-3">
                {!fileName ? (
                  <>
                    <div style={{ color: "#EDEEF2", fontSize: 19, fontWeight: 700, marginTop: 6 }}>Import your statement</div>
                    <div style={{ color: C.textMute, fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>Download a CSV from your bank or card site, then drop it in. Nothing leaves this screen.</div>
                    <label onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) parseFile(f); }}
                      className="flex flex-col items-center justify-center text-center cursor-pointer mt-6"
                      style={{ border: `2px dashed ${dragOver ? C.pile : C.hairline}`, background: dragOver ? "rgba(109,92,231,.08)" : C.inkSoft, borderRadius: 20, padding: "38px 20px", transition: "all .15s" }}>
                      <div className="flex items-center justify-center rounded-full mb-3" style={{ width: 52, height: 52, background: C.inkLift, color: C.pile }}><FileText size={24} /></div>
                      <div style={{ color: "#EDEEF2", fontSize: 15, fontWeight: 600 }}>Drop your CSV here</div>
                      <div style={{ color: C.textMute, fontSize: 12, marginTop: 4 }}>or tap to choose a file</div>
                      <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); e.target.value = ""; }} />
                    </label>
                    <button onClick={loadSample} className="w-full flex items-center justify-center gap-2 rounded-xl mt-4" style={{ background: C.inkSoft, color: "#C9C2FA", height: 46, border: `1px solid ${C.hairline}`, fontSize: 14 }}>
                      <Sparkles size={16} /> Try the sample statement
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
                        <FileText size={16} color={C.pile} />
                        <span style={{ color: "#EDEEF2", fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fileName}</span>
                      </div>
                      <button onClick={() => { setFileName(""); setRawRows([]); setHeaders([]); }} style={{ color: C.textMute }}><X size={18} /></button>
                    </div>
                    <div style={{ color: C.textMute, fontSize: 12, marginTop: 4 }}>{rawRows.length} rows found. Confirm the columns below.</div>
                    <div className="mt-5 space-y-3">
                      <MapRow label="Description" value={map.desc} headers={headers} onChange={(v) => setMap((m) => ({ ...m, desc: v }))} />
                      <MapRow label="Amount" value={map.amount} headers={headers} onChange={(v) => setMap((m) => ({ ...m, amount: v }))} />
                      <MapRow label="Date" value={map.date} headers={headers} optional onChange={(v) => setMap((m) => ({ ...m, date: v }))} />
                    </div>
                    <button onClick={() => setNegPurchase((v) => !v)} className="flex items-center justify-between w-full mt-4 p-3 rounded-xl" style={{ background: C.inkSoft, border: `1px solid ${C.hairline}` }}>
                      <span style={{ color: "#DDDFE6", fontSize: 13, textAlign: "left" }}>Purchases appear as negative numbers</span>
                      <span style={{ width: 42, height: 24, borderRadius: 12, background: negPurchase ? C.pile : C.hairline, position: "relative", transition: "background .15s", flexShrink: 0 }}>
                        <span style={{ position: "absolute", top: 2, left: negPurchase ? 20 : 2, width: 20, height: 20, borderRadius: 10, background: "white", transition: "left .15s" }} />
                      </span>
                    </button>
                    <div className="mt-5">
                      <div style={{ color: C.textMute, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Preview</div>
                      {buildValid.length ? (
                        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.hairline}` }}>
                          {buildValid.slice(0, 5).map((r, i) => (
                            <div key={i} className="flex items-center justify-between px-3 py-2" style={{ background: C.inkSoft, borderBottom: i < 4 ? `1px solid ${C.hairline}` : "none" }}>
                              <div style={{ minWidth: 0, marginRight: 10 }}>
                                <div style={{ color: "#DDDFE6", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.d}</div>
                                {r.dt && <div style={{ color: C.textMute, fontSize: 11 }}>{r.dt}</div>}
                              </div>
                              <div style={{ ...mono, color: "#EDEEF2", fontSize: 13, flexShrink: 0 }}>${usd(r.a)}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl p-3" style={{ background: "rgba(229,72,77,.10)", border: `1px solid ${C.flag}`, color: "#F0B4B6", fontSize: 12 }}>
                          No purchases parsed with these columns. Check the Amount column, or flip the negative-numbers switch above.
                        </div>
                      )}
                      {buildValid.length > 5 && <div style={{ color: C.textMute, fontSize: 12, marginTop: 8 }}>+ {buildValid.length - 5} more</div>}
                    </div>
                    <button onClick={startReview} disabled={!buildValid.length || !mapReady} className="w-full flex items-center justify-center gap-2 rounded-xl font-semibold mt-5 transition"
                      style={{ background: buildValid.length ? C.approve : C.inkLift, color: buildValid.length ? "white" : C.textMute, height: 52 }}>
                      Start review · {buildValid.length} purchases · ${usd(importTotal)} <ArrowRight size={18} />
                    </button>
                    <div style={{ color: C.textMute, fontSize: 11, marginTop: 8, textAlign: "center" }}>Card payments and credits are skipped automatically.</div>
                  </>
                )}
              </div>
            )}

            {/* DECK */}
            {screen === "deck" && (
              <>
                <div className="relative flex-1 mx-5 my-3">
                  {[2, 1].map((off) => {
                    const t = txns[index + off];
                    if (!t) return null;
                    return (
                      <div key={t.id} className="absolute inset-0" style={{ transform: `translateY(${off * 10}px) scale(${1 - off * 0.04})`, zIndex: 1 }}>
                        <div style={{ height: "100%", background: C.paper, borderRadius: 24, opacity: off === 1 ? 0.55 : 0.3, border: `1px solid ${C.paperEdge}` }} />
                      </div>
                    );
                  })}
                  {current && (
                    <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} className="absolute inset-0 cursor-grab active:cursor-grabbing"
                      style={{ zIndex: 5, touchAction: "none", transform: `translate(${dragX}px, ${dragY}px) rotate(${rot}deg)`, transition: released ? "transform .23s ease-out" : "none" }}>
                      <div className="h-full flex flex-col p-6" style={{ background: C.paper, borderRadius: 24, border: `1px solid ${C.paperEdge}`, boxShadow: "0 12px 30px rgba(0,0,0,.28)", position: "relative", overflow: "hidden" }}>
                        <Stamp op={okOp} color={C.approve} label="RECOGNIZED" side="left" />
                        <Stamp op={lookOp} color={C.investigate} label="LOOK CLOSER" side="right" />
                        <Stamp op={pileOp} color={C.pile} label="PILE" side="top" />
                        <div className="flex items-center justify-between">
                          <span style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: C.textMute }}>{current.cat}</span>
                          <span style={{ ...mono, fontSize: 12, color: C.textMute }}>{current.date}</span>
                        </div>
                        <div className="flex-1 flex flex-col justify-center">
                          <div style={{ ...mono, fontSize: 46, fontWeight: 600, color: C.textInk, letterSpacing: -1 }}>${usd(current.amount)}</div>
                          <div style={{ fontSize: 17, fontWeight: 600, color: C.textInk, marginTop: 10, lineHeight: 1.3 }}>{current.desc}</div>
                          {current.loc && <div style={{ fontSize: 13, color: C.textMute, marginTop: 6 }}>{current.loc}</div>}
                        </div>
                        <div style={{ fontSize: 12, color: C.textMute, borderTop: `1px solid ${C.paperEdge}`, paddingTop: 12 }}>Swipe right to approve · up to file · left to look closer</div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-center gap-5 pb-7 pt-1">
                  <ActionBtn color={C.investigate} onClick={investigate} icon={<Search size={22} />} sub="Look closer" />
                  <ActionBtn color={C.pile} onClick={openPileSheet} icon={<Layers size={26} />} big sub="File it" />
                  <ActionBtn color={C.approve} onClick={approve} icon={<Check size={22} />} sub="Approve" />
                </div>
              </>
            )}

            {/* SUMMARY */}
            {screen === "summary" && (
              <Summary txns={txns} piles={piles} sourceTotal={sourceTotal} onRestart={restart} onNew={goImport}
                setInvestigating={setInvestigating} onOpenPile={(id) => { setOpenPile(id); setScreen("pile"); }} />
            )}

            {/* PILE DETAIL */}
            {screen === "pile" && activePile && (
              <PileDetail pile={activePile} items={activeItems} onBack={() => setScreen("summary")} updateTxn={updateTxn} />
            )}
          </>
        )}

        {/* investigation overlay */}
        {investigating && (
          <Overlay>
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setInvestigating(null)} className="flex items-center gap-1" style={{ color: C.textMute, fontSize: 14 }}><ChevronLeft size={18} /> Back</button>
              {investigating.sus && <span className="flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: "rgba(229,72,77,.12)", color: C.flag, fontSize: 11, fontWeight: 600 }}><ShieldAlert size={13} /> Unusual</span>}
            </div>
            <div style={{ ...mono, fontSize: 40, fontWeight: 600, color: "#EDEEF2" }}>${usd(investigating.amount)}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#EDEEF2", marginTop: 8 }}>{investigating.desc}</div>
            <div className="mt-5 space-y-3">
              <Field k="Transaction date" v={investigating.date || "—"} />
              <Field k="Category" v={investigating.cat} />
              <Field k="Location" v={investigating.loc || "Not in statement"} />
              <Field k="Descriptor" v={investigating.desc} mono />
            </div>
            <div className="mt-5 p-3 rounded-xl" style={{ background: C.inkSoft, border: `1px solid ${C.hairline}`, fontSize: 12, color: C.textMute }}>
              This is everything the statement line carries. Connecting your card later fills in the real merchant, logo, and exact location.
            </div>
            {index < txns.length && txns[index]?.id === investigating.id && (
              <div className="mt-6 space-y-3">
                <button onClick={() => { setInvestigating(null); setTxns((p) => p.map((x, i) => i === index ? { ...x, status: "approved" } : x)); snapshot(); setIndex((i) => i + 1); }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl font-semibold" style={{ background: C.approve, color: "white", height: 50 }}><Check size={18} /> I recognize it — approve</button>
                <button onClick={() => { setInvestigating(null); setTxns((p) => p.map((x, i) => i === index ? { ...x, status: "flagged" } : x)); snapshot(); setIndex((i) => i + 1); }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl font-semibold" style={{ background: "rgba(229,72,77,.14)", color: C.flag, height: 50, border: `1px solid ${C.flag}` }}><Flag size={18} /> Flag as possible fraud</button>
              </div>
            )}
          </Overlay>
        )}

        {/* pile sheet */}
        {showPiles && (
          <div className="absolute inset-0 flex items-end" style={{ zIndex: 40, background: "rgba(0,0,0,.45)" }} onClick={closePiles}>
            <div onClick={(e) => e.stopPropagation()} className="w-full p-5 pb-7" style={{ background: C.inkLift, borderTopLeftRadius: 26, borderTopRightRadius: 26, border: `1px solid ${C.hairline}` }}>
              <div className="flex items-center justify-between mb-1">
                <span style={{ color: "#EDEEF2", fontWeight: 600, fontSize: 15 }}>File this purchase</span>
                <button onClick={closePiles} style={{ color: C.textMute }}><X size={20} /></button>
              </div>
              <div style={{ color: C.textMute, fontSize: 12, marginBottom: 14 }}>Tap a folder to file it into, or make a new one.</div>
              {piles.length === 0 ? (
                <div className="flex flex-col items-center text-center py-3 mb-3" style={{ color: C.textMute }}>
                  <Folder size={26} style={{ marginBottom: 8, opacity: 0.7 }} />
                  <div style={{ fontSize: 13, maxWidth: 240 }}>No folders yet. Name one below and this purchase goes straight into it.</div>
                </div>
              ) : (
                <div className="mb-3" style={{ maxHeight: 224, overflowY: "auto" }}>
                  {piles.map((p) => {
                    const n = pileCount(p.id);
                    return (
                      <div key={p.id} className="flex items-center gap-2 mb-2">
                        {confirmDel === p.id ? (
                          <div className="flex-1 flex items-center justify-between rounded-xl px-4" style={{ height: 50, background: "rgba(229,72,77,.10)", border: `1px solid ${C.flag}` }}>
                            <span style={{ color: "#F0B4B6", fontSize: 13 }}>Delete “{p.name}”? Un-files {n}.</span>
                            <div className="flex items-center gap-2">
                              <button onClick={() => removePile(p.id)} className="flex items-center justify-center rounded-lg" style={{ width: 34, height: 34, background: C.flag, color: "white" }}><Check size={17} /></button>
                              <button onClick={() => setConfirmDel(null)} className="flex items-center justify-center rounded-lg" style={{ width: 34, height: 34, background: C.inkSoft, color: C.textMute, border: `1px solid ${C.hairline}` }}><X size={17} /></button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button onClick={() => { closePiles(); commit("piled", p.id, "up"); }} className="flex-1 flex items-center justify-between rounded-xl px-4 transition" style={{ height: 50, background: "rgba(109,92,231,.12)", border: `1px solid ${C.pile}` }}>
                              <span className="flex items-center gap-2" style={{ color: "#D6D0FB", fontSize: 14, fontWeight: 500 }}><Folder size={16} /> {p.name}</span>
                              {n > 0 && <span style={{ ...mono, fontSize: 12, color: "#A79CF2" }}>{n}</span>}
                            </button>
                            <button onClick={() => requestDelete(p.id)} className="flex items-center justify-center rounded-xl" style={{ width: 50, height: 50, background: C.inkSoft, color: C.textMute, border: `1px solid ${C.hairline}` }}><Trash2 size={17} /></button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex gap-2">
                <input value={newPile} onChange={(e) => setNewPile(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") createAndFile(); }} placeholder="Name a new folder…" autoFocus
                  className="flex-1 px-4 rounded-xl outline-none" style={{ background: C.inkSoft, color: "#EDEEF2", height: 48, border: `1px solid ${C.hairline}` }} />
                <button onClick={createAndFile} disabled={!newPile.trim()} className="flex items-center justify-center gap-1 rounded-xl px-4 font-semibold" style={{ background: newPile.trim() ? C.pile : C.inkSoft, color: newPile.trim() ? "white" : C.textMute, border: newPile.trim() ? "none" : `1px solid ${C.hairline}` }}>
                  <FolderPlus size={18} /> File
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MapRow({ label, value, headers, onChange, optional }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span style={{ color: "#DDDFE6", fontSize: 13, width: 92, flexShrink: 0 }}>{label}{optional && <span style={{ color: C.textMute }}> · optional</span>}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 rounded-lg px-3 outline-none" style={{ background: C.inkSoft, color: value ? "#EDEEF2" : C.textMute, height: 42, border: `1px solid ${value ? C.pile : C.hairline}`, fontSize: 13 }}>
        <option value="">Choose column…</option>
        {headers.map((h) => <option key={h} value={h} style={{ background: C.inkSoft }}>{h}</option>)}
      </select>
    </div>
  );
}

function Stamp({ op, color, label, side }) {
  const pos = side === "left" ? { top: 22, left: 22, transform: "rotate(-14deg)" } : side === "right" ? { top: 22, right: 22, transform: "rotate(14deg)" } : { top: 22, left: "50%", transform: "translateX(-50%)" };
  return <div style={{ position: "absolute", ...pos, opacity: op, zIndex: 8, border: `3px solid ${color}`, color, borderRadius: 10, padding: "4px 12px", fontWeight: 800, fontSize: 15, letterSpacing: 1, pointerEvents: "none" }}>{label}</div>;
}

function ActionBtn({ color, onClick, icon, sub, big }) {
  const s = big ? 66 : 56;
  return (
    <div className="flex flex-col items-center gap-2">
      <button onClick={onClick} className="flex items-center justify-center rounded-full transition active:scale-90" style={{ width: s, height: s, background: "rgba(255,255,255,.04)", color, border: `2px solid ${color}` }}>{icon}</button>
      <span style={{ fontSize: 11, color: "#8A8C98" }}>{sub}</span>
    </div>
  );
}

function Overlay({ children }) { return <div className="absolute inset-0 p-6 overflow-auto" style={{ zIndex: 45, background: C.ink }}>{children}</div>; }

function Field({ k, v, mono: m }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span style={{ color: C.textMute, fontSize: 13 }}>{k}</span>
      <span style={{ color: "#DDDFE6", fontSize: 13, textAlign: "right", ...(m ? mono : {}) }}>{v}</span>
    </div>
  );
}

function Summary({ txns, piles, sourceTotal, onRestart, onNew, setInvestigating, onOpenPile }) {
  const flagged = txns.filter((t) => t.status === "flagged");
  const piled = txns.filter((t) => t.status === "piled");
  const approved = txns.filter((t) => t.status === "approved");
  const pileGroups = piles.map((p) => ({ p, items: piled.filter((t) => t.pileId === p.id) })).filter((g) => g.items.length);

  return (
    <div className="flex-1 overflow-auto px-5 pb-6">
      <div className="text-center mt-2 mb-5">
        <CheckCircle2 size={40} color={C.approve} style={{ margin: "0 auto 8px" }} />
        <div style={{ color: "#EDEEF2", fontSize: 20, fontWeight: 700 }}>Review complete</div>
        <div style={{ color: C.textMute, fontSize: 13, marginTop: 4 }}>{txns.length} of {txns.length} reviewed · ${usd(sourceTotal)} of ${usd(sourceTotal)}</div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-5">
        <Stat n={approved.length} label="Approved" color={C.approve} />
        <Stat n={piled.length} label="Filed" color={C.pile} />
        <Stat n={flagged.length} label="Flagged" color={C.flag} />
      </div>

      {flagged.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-1.5 mb-1" style={{ color: C.flag, fontSize: 13, fontWeight: 600 }}><ShieldAlert size={15} /> Flagged for fraud</div>
          {flagged.map((t) => (
            <button key={t.id} onClick={() => setInvestigating(t)} className="w-full flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${C.hairline}` }}>
              <span style={{ color: "#DDDFE6", fontSize: 13, textAlign: "left" }}>{t.desc}</span>
              <span style={{ ...mono, color: C.flag, fontSize: 13 }}>${usd(t.amount)}</span>
            </button>
          ))}
        </div>
      )}

      {pileGroups.length > 0 && (
        <div className="mb-5">
          <div style={{ color: C.textMute, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Your folders</div>
          <div className="space-y-2">
            {pileGroups.map(({ p, items }) => {
              const sub = items.reduce((s, t) => s + t.amount, 0);
              const open = items.filter((t) => t.action !== "done").length;
              return (
                <button key={p.id} onClick={() => onOpenPile(p.id)} className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 transition" style={{ background: C.inkSoft, border: `1px solid ${C.hairline}` }}>
                  <div className="flex items-center justify-center rounded-xl" style={{ width: 42, height: 42, background: "rgba(109,92,231,.14)", color: C.pile, flexShrink: 0 }}><Folder size={20} /></div>
                  <div className="flex-1 text-left" style={{ minWidth: 0 }}>
                    <div style={{ color: "#EDEEF2", fontSize: 15, fontWeight: 600 }}>{p.name}</div>
                    <div style={{ color: C.textMute, fontSize: 12, marginTop: 1 }}>
                      {items.length} item{items.length !== 1 ? "s" : ""}{open > 0 && <span style={{ color: C.investigate }}> · {open} to act on</span>}
                    </div>
                  </div>
                  <span style={{ ...mono, color: "#DDDFE6", fontSize: 14, fontWeight: 600 }}>${usd(sub)}</span>
                  <ChevronRight size={18} color={C.textMute} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <button onClick={onRestart} className="flex-1 rounded-xl font-semibold" style={{ background: C.inkLift, color: "#EDEEF2", height: 50, border: `1px solid ${C.hairline}` }}>Start over</button>
        <button onClick={onNew} className="flex-1 rounded-xl font-semibold" style={{ background: C.pile, color: "white", height: 50 }}>New statement</button>
      </div>
    </div>
  );
}

function PileDetail({ pile, items, onBack, updateTxn }) {
  const [openNote, setOpenNote] = useState(null);
  const total = items.reduce((s, t) => s + t.amount, 0);
  const doneCount = items.filter((t) => t.action === "done").length;
  const toSettle = items.filter((t) => t.action !== "done").reduce((s, t) => s + t.amount, 0);

  const cycle = (t) => {
    const i = ACTION_CYCLE.indexOf(t.action || null);
    updateTxn(t.id, { action: ACTION_CYCLE[(i + 1) % ACTION_CYCLE.length] });
  };

  return (
    <div className="flex-1 overflow-auto px-5 pb-6">
      <button onClick={onBack} className="flex items-center gap-1 mt-1 mb-3" style={{ color: C.textMute, fontSize: 14 }}><ChevronLeft size={18} /> All folders</button>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center rounded-xl" style={{ width: 44, height: 44, background: "rgba(109,92,231,.14)", color: C.pile }}><Folder size={22} /></div>
        <div>
          <div style={{ color: "#EDEEF2", fontSize: 20, fontWeight: 700 }}>{pile.name}</div>
          <div style={{ color: C.textMute, fontSize: 12 }}>{items.length} item{items.length !== 1 ? "s" : ""} · ${usd(total)} total</div>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="flex-1 rounded-xl p-3" style={{ background: C.inkSoft, border: `1px solid ${C.hairline}` }}>
          <div style={{ ...mono, fontSize: 18, fontWeight: 700, color: C.investigate }}>${usd(toSettle)}</div>
          <div style={{ fontSize: 11, color: C.textMute, marginTop: 2 }}>Still to act on</div>
        </div>
        <div className="flex-1 rounded-xl p-3" style={{ background: C.inkSoft, border: `1px solid ${C.hairline}` }}>
          <div style={{ ...mono, fontSize: 18, fontWeight: 700, color: C.approve }}>{doneCount}/{items.length}</div>
          <div style={{ fontSize: 11, color: C.textMute, marginTop: 2 }}>Done</div>
        </div>
      </div>

      <div style={{ color: C.textMute, fontSize: 12, marginBottom: 10 }}>Tap the status to set your next step. Add a note for the details.</div>

      <div className="space-y-3">
        {items.map((t) => {
          const act = t.action ? ACTIONS[t.action] : null;
          const noteOpen = openNote === t.id;
          return (
            <div key={t.id} className="rounded-2xl p-4" style={{ background: C.inkSoft, border: `1px solid ${C.hairline}` }}>
              <div className="flex items-start justify-between gap-3">
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: "#EDEEF2", fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{t.desc}</div>
                  <div style={{ color: C.textMute, fontSize: 12, marginTop: 2 }}>{t.date || "—"}{t.cat && t.cat !== "—" ? ` · ${t.cat}` : ""}</div>
                </div>
                <span style={{ ...mono, color: "#EDEEF2", fontSize: 16, fontWeight: 600, flexShrink: 0 }}>${usd(t.amount)}</span>
              </div>

              <div className="flex items-center gap-2 mt-3">
                <button onClick={() => cycle(t)} className="flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ background: act ? `${act.color}22` : C.inkLift, border: `1px solid ${act ? act.color : C.hairline}` }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: act ? act.color : C.textMute }} />
                  <span style={{ color: act ? act.color : C.textMute, fontSize: 13, fontWeight: 500 }}>{act ? act.label : "Set next step"}</span>
                </button>
                <button onClick={() => setOpenNote(noteOpen ? null : t.id)} className="flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ background: C.inkLift, border: `1px solid ${C.hairline}`, color: t.note ? "#DDDFE6" : C.textMute }}>
                  <Pencil size={13} /> <span style={{ fontSize: 13 }}>{t.note ? "Edit note" : "Add note"}</span>
                </button>
              </div>

              {t.note && !noteOpen && (
                <div className="mt-3 rounded-xl px-3 py-2" style={{ background: C.inkLift, color: "#C9CBD6", fontSize: 13, lineHeight: 1.4 }}>{t.note}</div>
              )}
              {noteOpen && (
                <div className="mt-3">
                  <textarea value={t.note} onChange={(e) => updateTxn(t.id, { note: e.target.value })} autoFocus rows={2}
                    placeholder="e.g. ask the ski trip group to Venmo their share"
                    className="w-full rounded-xl px-3 py-2 outline-none" style={{ background: C.inkLift, color: "#EDEEF2", border: `1px solid ${C.pile}`, fontSize: 13, resize: "none" }} />
                  <div className="flex justify-end mt-2">
                    <button onClick={() => setOpenNote(null)} className="rounded-lg px-3 py-1.5" style={{ background: C.pile, color: "white", fontSize: 13, fontWeight: 500 }}>Done</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ n, label, color }) {
  return (
    <div className="rounded-xl p-3 text-center" style={{ background: C.inkSoft, border: `1px solid ${C.hairline}` }}>
      <div style={{ ...mono, fontSize: 24, fontWeight: 700, color }}>{n}</div>
      <div style={{ fontSize: 11, color: C.textMute, marginTop: 2 }}>{label}</div>
    </div>
  );
}
