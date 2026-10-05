'use client';

import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';

type MotionVars = CSSProperties & { '--flow-x': string; '--flow-y': string };

const initialMotion: MotionVars = { '--flow-x': '0px', '--flow-y': '0px' };

const tools = [
  { mark: 'N', name: 'Next.js' },
  { mark: '▲', name: 'Vercel' },
  { mark: 'aws', name: 'AWS' },
  { mark: '◉', name: 'GitHub' },
  { mark: 'TS', name: 'TypeScript' },
  { mark: '⬡', name: 'Node.js' },
  { mark: '☁', name: 'Cloudflare' },
];

export function WorkflowProof() {
  const scene = useRef<HTMLDivElement>(null);
  const fractureScene = useRef<HTMLDivElement>(null);
  const [fractureRun, setFractureRun] = useState(0);

  function move(event: PointerEvent<HTMLElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width - 0.5) * 16;
    const y = ((event.clientY - box.top) / box.height - 0.5) * 10;
    scene.current?.style.setProperty('--flow-x', `${x}px`);
    scene.current?.style.setProperty('--flow-y', `${y}px`);
  }

  function reset() {
    scene.current?.style.setProperty('--flow-x', '0px');
    scene.current?.style.setProperty('--flow-y', '0px');
  }

  function moveFracture(event: PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width - 0.5) * 2;
    const y = ((event.clientY - box.top) / box.height - 0.5) * 2;
    fractureScene.current?.style.setProperty('--fracture-x', x.toFixed(3));
    fractureScene.current?.style.setProperty('--fracture-y', y.toFixed(3));
  }

  return (
    <section className="workflow-proof" aria-labelledby="workflow-proof-title" onPointerMove={move} onPointerLeave={reset}>
      <div className="workflow-trust">
        <p id="workflow-proof-title">Built for the modern developer workflow.</p>
        <div className="workflow-rail" aria-label="Works with common developer platforms and runtimes">
          <div className="workflow-track">
            {[0, 1].map((set) => (
              <div className="workflow-set" key={set} aria-hidden={set === 1}>
                {tools.map((tool) => <span key={tool.name}><i>{tool.mark}</i>{tool.name}</span>)}
              </div>
            ))}
          </div>
        </div>
        <small>COMPATIBLE WORKFLOW TOOLS · NO AFFILIATION OR ENDORSEMENT IMPLIED</small>
      </div>

      <div className="workflow-story">
        <div className="workflow-story-copy">
          <p className="editorial-kicker"><i />ONE DOCUMENT / EVERY HANDOFF</p>
          <h2>Made once.<br /><em>Ready everywhere.</em></h2>
          <p>Stampbench turns familiar invoice details into the files people and accounting systems can both use.</p>
          <div><span>01 / BUILD</span><span>02 / CHECK</span><span>03 / SEND</span></div>
        </div>
        <div className="invoice-motion" ref={scene} style={initialMotion} aria-label="Animated invoice moving from draft to checked PDF, UBL and CII outputs">
          <div className="motion-grid" aria-hidden />
          <div className="motion-source" aria-hidden><span>{'{'}</span><i>invoice</i><span>{'}'}</span></div>
          <div className="motion-sheet sheet-shadow" aria-hidden />
          <div className="motion-sheet sheet-main">
            <header><small>INVOICE</small><b>№ 001</b></header>
            <div className="motion-lines"><i/><i/><i/><i/></div>
            <footer><span>TOTAL</span><strong>£1,240</strong></footer>
            <em>✓</em>
          </div>
          <div className="motion-stamp" aria-hidden>CHECKED</div>
          <div className="motion-output output-pdf" aria-hidden><b>PDF</b><small>FOR PEOPLE</small></div>
          <div className="motion-output output-ubl" aria-hidden><b>UBL</b><small>FOR SYSTEMS</small></div>
          <div className="motion-output output-cii" aria-hidden><b>CII</b><small>FOR SYSTEMS</small></div>
          <p>WATCH THE HANDOFF <span>→</span></p>
        </div>
      </div>
      <div className="fracture-study" id="material-study">
        <div className="fracture-head">
          <div><p className="editorial-kicker"><i />MATERIAL STUDY / 01</p><h2>Readable outside.<br /><em>Structured within.</em></h2></div>
          <p>A familiar invoice opens into the data underneath, checks itself, then returns ready to send.</p>
        </div>
        <div
          className="fracture-stage"
          onPointerMove={moveFracture}
          onPointerLeave={() => { fractureScene.current?.style.setProperty('--fracture-x', '0'); fractureScene.current?.style.setProperty('--fracture-y', '0'); }}
        >
          <div className="fracture-scene" ref={fractureScene} key={fractureRun}>
            <div className="fracture-aura" aria-hidden />
            <div className="fracture-data" aria-hidden>
              <small>&lt;Invoice&gt;</small><span>cbc:ID&nbsp;&nbsp;SB-001</span><span>cbc:Currency&nbsp;&nbsp;GBP</span><span>cac:Customer&nbsp;&nbsp;Stampbench</span><span>cbc:Payable&nbsp;&nbsp;1240.00</span><small>&lt;/Invoice&gt;</small>
            </div>
            <div className="fracture-paper" aria-hidden>
              <header><b>INVOICE</b><span>№ SB-001</span></header>
              <section><small>FROM</small><strong>STAMPBENCH</strong><small>TO</small><strong>YOUR CUSTOMER</strong></section>
              <div className="fracture-rule" /><div className="fracture-rule short" /><div className="fracture-rule" />
              <footer><span>TOTAL</span><b>£1,240</b></footer>
            </div>
            <div className="fracture-shards" aria-hidden>
              {Array.from({ length: 12 }, (_, index) => <i key={index} style={{ '--shard': index } as CSSProperties} />)}
            </div>
            <div className="fracture-seal" aria-hidden><b>✓</b><span>COMPLIANT</span><small>EN 16931</small></div>
            <div className="fracture-scan" aria-hidden />
          </div>
          <div className="fracture-caption"><span>INVOICE → STRUCTURE → CHECKED</span><button type="button" onClick={() => setFractureRun((run) => run + 1)}>Replay the check ↻</button></div>
        </div>
      </div>
    </section>
  );
}
