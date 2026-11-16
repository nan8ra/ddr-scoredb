import React,{useEffect,useMemo,useRef,useState} from 'react';
import{createRoot}from'react-dom/client';
import{NotebookPen,Upload,Download,X,Search}from'lucide-react';
import './style.css';
type Diff='expert'|'challenge';type Option='-'|'normal'|'mirror'|'right'|'left'|'random';
type Song={id:string;title:string;sortKey?:string;jacketUrl:string|null;charts:{difficulty:Diff;level:number}[]};
type Setting={option:Option;judgeMs:number|null;memo:string};
type RecordMap=Record<string,Setting>;
const optionLabels:Record<Option,string>={'-':'－',normal:'正',mirror:'鏡',right:'右',left:'左',random:'乱'};
const optionChoices:Option[]=['-','normal','mirror','right','left','random'];
const empty=():Setting=>({option:'-',judgeMs:null,memo:''});
const chartKey=(songId:string,diff:Diff)=>`${songId}:sp:${diff}`;
function validateSongs(value:unknown):Song[]{if(!Array.isArray(value))throw Error('JSON配列ではありません');const ids=new Set<string>();return value.map((s:any)=>{if(!s||typeof s.id!=='string'||!s.id||typeof s.title!=='string'||!Array.isArray(s.charts))throw Error('楽曲データ形式が不正です');if(ids.has(s.id))throw Error('楽曲IDが重複しています: '+s.id);ids.add(s.id);const charts=s.charts.map((c:any)=>{if(!['expert','challenge'].includes(c.difficulty)||!Number.isInteger(c.level)||c.level<1||c.level>19)throw Error('譜面データが不正です: '+s.id);return{difficulty:c.difficulty as Diff,level:c.level as number}});if(new Set(charts.map((c:{difficulty:Diff})=>c.difficulty)).size!==charts.length)throw Error('同一難易度が重複しています');return{id:s.id,title:s.title,sortKey:typeof s.sortKey==='string'?s.sortKey:s.title,jacketUrl:typeof s.jacketUrl==='string'&&/^https:\/\//.test(s.jacketUrl)?s.jacketUrl:null,charts}})}
function App(){const[level,setLevel]=useState(16);const[filter,setFilter]=useState<'all'|Diff>('all');const[songs,setSongs]=useState<Song[]>([]);const[settings,setSettings]=useState<RecordMap>(()=>{try{return JSON.parse(localStorage.getItem('ddr-settings-v1')||'{}')}catch{return{}}});const[selected,setSelected]=useState<string|null>(null);const[showMemo,setShowMemo]=useState(false);const[search,setSearch]=useState('');const[showSearch,setShowSearch]=useState(false);const[message,setMessage]=useState('');const fileRef=useRef<HTMLInputElement>(null);const dataRef=useRef<HTMLInputElement>(null);
useEffect(()=>{fetch(`${import.meta.env.BASE_URL}data/songs.json`).then(r=>{if(!r.ok)throw Error('読み込み失敗');return r.json()}).then(v=>setSongs(validateSongs(v))).catch(e=>setMessage(String(e)))},[]);
useEffect(()=>{localStorage.setItem('ddr-settings-v1',JSON.stringify(settings))},[settings]);
const entries=useMemo(()=>songs.flatMap(song=>song.charts.filter(c=>c.level===level&&(filter==='all'||filter===c.difficulty)).map(chart=>({...chart,song,key:chartKey(song.id,chart.difficulty)}))).filter(e=>e.song.title.toLocaleLowerCase().includes(search.toLocaleLowerCase())).sort((a,b)=>(a.song.sortKey||a.song.title).localeCompare(b.song.sortKey||b.song.title,'ja')||a.difficulty.localeCompare(b.difficulty)),[songs,level,filter,search]);
const [judgeDraft, setJudgeDraft] = useState('');
const current=entries.find(e=>e.key===selected);const currentSetting=current?(settings[current.key]||empty()):empty();
const update=(part:Partial<Setting>)=>{if(!selected)return;setSettings(p=>({...p,[selected]:{...(p[selected]||empty()),...part}}))};

useEffect(() => {
  setJudgeDraft(
    currentSetting.judgeMs === null
      ? ''
      : String(currentSetting.judgeMs)
  );
}, [selected, currentSetting.judgeMs]);

const saveJudge = () => {
  if (!current) return;

  const value = judgeDraft.trim();

  if (value === '') {
    update({ judgeMs: null });
    setMessage('判定値を未設定にしました');
    return;
  }

  if (!/^[+-]?\d+$/.test(value)) {
    setMessage('整数を入力してください');
    return;
  }

  const number = Number(value);

  if (!Number.isSafeInteger(number) || Math.abs(number) > 999) {
    setMessage('判定値は -999〜999 で入力してください');
    return;
  }

  update({ judgeMs: number });
  setJudgeDraft(String(number));
  setMessage(`判定値 ${number > 0 ? '+' : ''}${number} ms を保存しました`);
};

const importSongs=async(file?:File)=>{if(!file)return;try{const parsed=validateSongs(JSON.parse(await file.text()));setSongs(parsed);setSelected(null);setMessage(`${parsed.length}曲を読み込みました（このタブ内のみ）`)}catch(e){setMessage('読み込み失敗: '+String(e))}};
const exportSettings=()=>{const blob=new Blob([JSON.stringify({version:1,settings},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='ddr-option-backup.json';a.click();URL.revokeObjectURL(url)};
const importSettings=async(file?:File)=>{if(!file)return;try{const data=JSON.parse(await file.text());if(data.version!==1||!data.settings||typeof data.settings!=='object'||Array.isArray(data.settings))throw Error('形式が不正です');const restored:RecordMap={};for(const[k,v]of Object.entries(data.settings)){const x=v as any;if(!x||!optionChoices.includes(x.option)||!(x.judgeMs===null||(Number.isInteger(x.judgeMs)&&Math.abs(x.judgeMs)<=999))||typeof x.memo!=='string')throw Error('設定内容が不正です');restored[k]={option:x.option,judgeMs:x.judgeMs,memo:x.memo}}setSettings(p=>({...p,...restored}));setMessage('設定を復元しました')}catch(e){setMessage('復元失敗: '+String(e))}};
return <><header><div className="top"><span className="brand">DDR <b>MEMO</b></span><span className="count">SP {entries.length} charts</span><button className="icon" title="検索" onClick={()=>setShowSearch(v=>!v)}><Search size={19}/></button><button className="icon" title="楽曲JSON読み込み" onClick={()=>dataRef.current?.click()}><Upload size={19}/></button><button className="icon" title="設定バックアップ" onClick={exportSettings}><Download size={19}/></button></div><div className="controls"><select aria-label="レベル" value={level} onChange={e=>{setLevel(Number(e.target.value));setSelected(null);setShowMemo(false)}}>{Array.from({length:19},(_,i)=><option key={i} value={i+1}>Lv {i+1}</option>)}</select><select aria-label="譜面難易度" className="diff" value={filter} onChange={e=>{setFilter(e.target.value as typeof filter);setSelected(null)}}><option value="all">EX+CH</option><option value="expert">EX</option><option value="challenge">CH</option></select><div className="separator"/><div className="option-group">{optionChoices.map(o=><button key={o} disabled={!current} className={current&&currentSetting.option===o?'active':''} onClick={()=>update({option:o})}>{optionLabels[o]}</button>)}</div>
<input
  className="judge"
  aria-label="判定ミリ秒"
  type="text"
  inputMode="numeric"
  placeholder="±ms"
  disabled={!current}
  value={judgeDraft}
  onChange={e => setJudgeDraft(e.target.value)}
  onKeyDown={e => {
    if (e.key === 'Enter') {
      saveJudge();
      e.currentTarget.blur();
    }
  }}
/>
<button
  className="judge-save"
  type="button"
  disabled={!current}
  onClick={() => {
    saveJudge();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }}
>
  決定
</button>
<button className={'memo-btn '+(showMemo?'active':'')} title="メモ" disabled={!current} onClick={()=>setShowMemo(true)}><NotebookPen size={18}/></button></div>{showSearch&&<input className="search" autoFocus placeholder="曲名で絞り込み" value={search} onChange={e=>setSearch(e.target.value)}/>}</header><main><div className="grid">{entries.map((e,i)=>{const s=settings[e.key]||empty();return <button key={e.key} className={'tile '+(selected===e.key?'selected':'')} style={{background:`linear-gradient(${(i*29)%360}deg,hsl(${(i*31)%360} 35% 30%,#171a26)`}} onClick={()=>{setSelected(e.key);setShowMemo(false)}} aria-label={`${e.song.title} ${e.difficulty} ${optionLabels[s.option]} ${s.judgeMs??'未設定'}`}><span className="badge">{optionLabels[s.option]}/{s.judgeMs===null?'－':s.judgeMs>0?'+'+s.judgeMs:s.judgeMs}</span>{e.song.jacketUrl?<img loading={i<20?'eager':'lazy'} src={e.song.jacketUrl} alt="" onError={ev=>{ev.currentTarget.style.display='none'}}/>:<span className="placeholder">{e.song.title}</span>}<span className="diff-badge">{e.difficulty==='expert'?'EX':'CH'}</span></button>})}</div>{entries.length===0&&<div className="empty">該当する譜面がありません。<br/>レベルまたは楽曲データを確認してください。</div>}</main><input ref={dataRef} hidden type="file" accept=".json,application/json" onChange={e=>{void importSongs(e.target.files?.[0]);e.target.value=''}}/><input ref={fileRef} hidden type="file" accept=".json,application/json" onChange={e=>{void importSettings(e.target.files?.[0]);e.target.value=''}}/><footer><button onClick={()=>fileRef.current?.click()}>設定JSONを復元</button><span>個人用・非公式ツール</span></footer>{message&&<div className="toast" role="status" onClick={()=>setMessage('')}>{message} ×</div>}{showMemo&&current&&<div className="modal-backdrop" onClick={()=>setShowMemo(false)}><section className="modal" onClick={e=>e.stopPropagation()}><div className="modal-title"><strong>{current.song.title} / {current.difficulty==='expert'?'EX':'CH'}</strong><button className="icon" onClick={()=>setShowMemo(false)}><X size={20}/></button></div><textarea autoFocus rows={6} placeholder="配置・踏み方などのメモ" value={currentSetting.memo} onChange={e=>update({memo:e.target.value})}/><small>入力内容は自動保存されます</small><button className="close" onClick={()=>setShowMemo(false)}>閉じる</button></section></div>}</>}
createRoot(document.getElementById('root')!).render(<App/>);
