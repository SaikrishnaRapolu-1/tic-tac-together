import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import './styles.css';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = url && key ? createClient(url, key) : null;
const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const newId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
const outcome = (board) => {
  const line = lines.find(([a,b,c]) => board[a] && board[a] === board[b] && board[a] === board[c]);
  return line ? { winner: board[line[0]], line } : board.every(Boolean) ? { winner: 'draw', line: [] } : null;
};
const initialState = (host) => ({ board: Array(9).fill(null), players: { X: host, O: null }, turn: 'X', scores: { X: 0, O: 0 }, status: 'waiting', result: null, version: 1 });

function App() {
  const params = new URLSearchParams(location.search);
  const roomParam = params.get('room');
  const [name, setName] = useState(localStorage.getItem('ttt-name') || '');
  const [draft, setDraft] = useState(localStorage.getItem('ttt-name') || '');
  const [room, setRoom] = useState(roomParam || '');
  const [game, setGame] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(Boolean(roomParam));
  const [copied, setCopied] = useState(false);
  const [opponentOnline, setOpponentOnline] = useState(true);
  const share = useMemo(() => room ? `${location.origin}${location.pathname}?room=${room}` : '', [room]);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase.channel(`game-${room}`).on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${room}` }, p => {
      if (p.new?.state) { setGame(p.new.state); setLoading(false); }
      if (p.eventType === 'DELETE') setGame(null);
    }).on('presence', { event: 'sync' }, () => {
      const names = Object.values(channel.presenceState()).flat().map(p => p.name);
      setOpponentOnline(!game?.players?.O || names.some(n => n !== name));
    }).subscribe(status => {
      if (status === 'SUBSCRIBED' && name) channel.track({ name, online_at: new Date().toISOString() });
    });
    return () => supabase.removeChannel(channel);
  }, [room, name]);

  useEffect(() => {
    if (roomParam && supabase) loadRoom(roomParam);
    if (roomParam && !supabase) { setLoading(false); setMessage('Supabase is not configured yet. Add your environment variables and redeploy.'); }
  }, []);

  async function loadRoom(id) {
    const { data, error } = await supabase.from('games').select('state').eq('id', id).maybeSingle();
    setLoading(false);
    if (error || !data) { setMessage('That room could not be found. Ask your friend for a fresh invite link.'); return; }
    setRoom(id); setGame(data.state);
  }
  function saveName() { const trimmed = draft.trim().slice(0, 20); if (!trimmed) return setMessage('Choose a display name to play.'); localStorage.setItem('ttt-name', trimmed); setName(trimmed); setMessage(''); }
  async function createRoom() {
    if (!name) return setMessage('Enter your name first.');
    if (!supabase) return setMessage('Supabase is not configured yet.');
    const id = newId(), state = initialState(name);
    const { error } = await supabase.from('games').insert({ id, state });
    if (error) return setMessage(`Could not create room: ${error.message}`);
    history.replaceState({}, '', `?room=${id}`); setRoom(id); setGame(state); setMessage('');
  }
  async function join() {
    if (!name) return setMessage('Enter your name first.');
    if (!game) return;
    if (game.players.O) return setMessage('This room already has two players.');
    await update({ ...game, players: { ...game.players, O: name }, status: 'playing', version: game.version + 1 });
  }
  async function update(next) {
    if (!supabase) return;
    const { data, error } = await supabase.from('games').update({ state: next, updated_at: new Date().toISOString() }).eq('id', room).eq('state->>version', String(game.version)).select('id');
    if (error || !data?.length) setMessage('That move arrived after a newer update — the board has refreshed.');
  }
  async function play(i) {
    if (!game || game.status !== 'playing' || game.result || game.board[i]) return;
    const me = game.players.X === name ? 'X' : game.players.O === name ? 'O' : null;
    if (me !== game.turn) return setMessage(`It’s ${game.players[game.turn] || game.turn}’s turn.`);
    const board = [...game.board]; board[i] = me;
    const result = outcome(board); const scores = { ...game.scores };
    if (result?.winner === 'X' || result?.winner === 'O') scores[result.winner]++;
    await update({ ...game, board, turn: game.turn === 'X' ? 'O' : 'X', scores, result, status: result ? 'finished' : 'playing', version: game.version + 1 });
  }
  async function rematch() { if (game) await update({ ...game, board: Array(9).fill(null), turn: 'X', result: null, status: 'playing', version: game.version + 1 }); }
  async function copy() { await navigator.clipboard.writeText(share); setCopied(true); setTimeout(() => setCopied(false), 1800); }
  const playerSymbol = game && (game.players.X === name ? 'X' : game.players.O === name ? 'O' : null);

  return <main>
    <header><a className="brand" href="/">tic<span>•</span>tac<span>•</span>together</a><div className="pill"><i></i> Live multiplayer</div></header>
    {!supabase && <div className="setup">Demo UI only — add Supabase keys to enable live games.</div>}
    {!room && <section className="hero"><div><p className="eyebrow">THE CLASSIC, CONNECTED</p><h1>Three in a row.<br/><em>Together.</em></h1><p className="lede">A joyful little game for two people, wherever you are.</p><div className="namebox"><label>Your display name</label><div><input maxLength="20" value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>e.key==='Enter'&&saveName()} placeholder="e.g. Jamie"/><button onClick={saveName}>Save</button></div></div>{name && <button className="primary" onClick={createRoom}>Create a game <b>→</b></button>}{message && <p className="notice">{message}</p>}</div><aside><div className="mini"><span>×</span><span>○</span><span>×</span><span>○</span><span>×</span><span>○</span><span>×</span><span>○</span><span>×</span></div><p>Make a room, share the link,<br/>and take the first move.</p></aside></section>}
    {room && <section className="gamewrap">{loading ? <p className="loading">Finding your game…</p> : !game ? <div className="missing"><h2>Room unavailable</h2><p>{message}</p><a href="/">Create a new game</a></div> : <><div className="roomtop"><div><p className="eyebrow">ROOM {room}</p><h2>{game.status === 'waiting' ? 'Waiting for a challenger' : game.result ? (game.result.winner === 'draw' ? 'A perfectly even match' : `${game.players[game.result.winner]} wins!`) : `${game.players[game.turn]}’s turn`}</h2></div><button className="share" onClick={copy}>{copied ? 'Link copied!' : 'Share invite ↗'}</button></div><div className="playarea"><div className="scorecard"><div className={game.turn==='X'&&!game.result?'active':''}><b className="x">×</b><span>{game.players.X}</span><strong>{game.scores.X}</strong></div><div className={game.turn==='O'&&!game.result?'active':''}><b className="o">○</b><span>{game.players.O || 'Waiting…'}</span><strong>{game.scores.O}</strong></div></div><div className="board" aria-label="Tic tac toe board">{game.board.map((v,i)=><button key={i} onClick={()=>play(i)} className={(game.result?.line||[]).includes(i)?'win':''} disabled={!!v || !!game.result}>{v === 'X' ? '×' : v === 'O' ? '○' : ''}</button>)}</div><p className="status">{game.status==='waiting' ? 'Invite someone with the link above to start.' : !opponentOnline && game.players.O ? 'Your opponent has disconnected. Their board will be ready when they return.' : game.result ? 'Want another round? The score stays.' : playerSymbol ? `You’re ${playerSymbol}. Choose an open square on your turn.` : 'You’re watching this match.'}</p>{game.status==='waiting' && !game.players.O && name !== game.players.X && <button className="primary" onClick={join}>Join as O</button>}{game.result && playerSymbol && <button className="primary" onClick={rematch}>Play again <b>↻</b></button>}{message && <p className="notice">{message}</p>}</div><footer><span>How to play</span><p>Players take turns placing their mark. First to make three in a row wins. If every square fills, it’s a draw.</p></footer></div></>}</section>}
  </main>;
}
createRoot(document.getElementById('root')).render(<App/>);
