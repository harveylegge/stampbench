'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, me, register } from '@/lib/account-client';

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan');
  const destination = plan ? `/account?upgrade=${encodeURIComponent(plan)}` : '/account';
  const [name,setName]=useState(''); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [confirm,setConfirm]=useState(''); const [termsAccepted,setTermsAccepted]=useState(false);
  const [fieldErrors,setFieldErrors]=useState<{email?:string;password?:string;confirm?:string}>({});
  const [formError,setFormError]=useState<ReactNode>(null); const [busy,setBusy]=useState(false);
  useEffect(()=>{let active=true;me().then(user=>{if(user&&active)router.replace(destination)}).catch(()=>{});return()=>{active=false}},[router,destination]);
  const checks=useMemo(()=>({length:password.length>=10,number:/\d/.test(password),special:/[^A-Za-z0-9]/.test(password)}),[password]);
  const progress=[name.trim().length>1,EMAIL_SHAPE.test(email.trim()),checks.length].filter(Boolean).length;
  const strength=Object.values(checks).filter(Boolean).length+(password.length>=14?1:0);
  async function onSubmit(event:React.FormEvent){event.preventDefault();setFormError(null);const errors:typeof fieldErrors={};if(!EMAIL_SHAPE.test(email.trim()))errors.email='Enter a valid email address.';if(password.length<10)errors.password='Use at least 10 characters.';if(password!==confirm)errors.confirm='Passwords do not match.';setFieldErrors(errors);if(Object.keys(errors).length)return;if(!termsAccepted){setFormError('Please agree to the Terms and Privacy Policy to create an account.');return}setBusy(true);try{await register(email.trim(),password,termsAccepted);router.push(destination)}catch(err){if(err instanceof ApiError&&err.code==='email_taken')setFormError(<>That account already exists. <Link href="/signin">Sign in instead</Link>.</>);else setFormError(err instanceof Error?err.message:'Something went wrong. Try again.');setBusy(false)}}
  return <div className="signup-workbench">
    <section className="signup-copy"><p className="signup-kicker"><i/>CREATE YOUR ACCOUNT / FREE</p><h1>Set up your<br/>Stampbench<br/>account.</h1><p>Save invoices, reuse business details and manage developer access from one place.</p>
      <form onSubmit={onSubmit} noValidate className="signup-card">
        <label>YOUR NAME<input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" placeholder="Enter your name"/></label>
        <label>EMAIL ADDRESS<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" placeholder="you@company.com"/>{fieldErrors.email&&<span>{fieldErrors.email}</span>}</label>
        <label>CREATE A PASSWORD<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" placeholder="At least 10 characters"/>
          <div className="security-meter"><div><small>SECURITY</small><b>{password?['START','BASIC','GOOD','STRONG','VERY STRONG'][strength]:'START TYPING'}</b><em>{password.length} CHARACTERS</em></div><div className="security-bars">{[0,1,2,3].map(i=><i key={i} className={i<strength?'on':''}/>)}</div><p><span className={checks.length?'met':''}>✓ 10+ characters</span><span className={checks.number?'met':''}>✓ Number</span><span className={checks.special?'met':''}>✓ Special character <em>BONUS</em></span></p></div>{fieldErrors.password&&<span>{fieldErrors.password}</span>}
        </label>
        <label>CONFIRM PASSWORD<input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password"/>{fieldErrors.confirm&&<span>{fieldErrors.confirm}</span>}</label>
        <label className="signup-consent"><input type="checkbox" checked={termsAccepted} onChange={e=>setTermsAccepted(e.target.checked)} required/><span>I agree to the <Link href="/terms" target="_blank">Terms</Link> and acknowledge the <Link href="/privacy" target="_blank">Privacy Policy</Link>. This is required to create an account; it is not marketing consent.</span></label>
        {formError&&<p className="signup-error" role="alert">{formError}</p>}<button disabled={busy}>{busy?'Creating your workbench…':'Create my account'} <span>↗</span></button><p className="signup-switch">Already have an account? <Link href="/signin">Sign in</Link></p>
      </form><p className="signup-safe"><i/>Start free. No card required.</p>
    </section>
    <aside className="signup-preview"><div className="preview-heading"><small>ACCOUNT SETUP / LIVE</small><h2>See your workspace<br/>come together.</h2><p>The preview responds as you complete each step.</p><div className="setup-line"><span>SETUP PROGRESS</span><b>{progress} / 3</b><i style={{width:`${progress/3*100}%`}}/></div></div>
      <div className={`preview-stack progress-${progress}`}><div className="back-sheet one">RECURRING / 01</div><div className="back-sheet two">RECURRING / 02</div><article><header><div><small>FROM</small><strong>{name.trim()?name.toUpperCase():'YOUR BUSINESS'}</strong></div><span className={checks.length?'checked':''}>✓ COMPLIANT</span></header><div className="customer"><small>CUSTOMER</small><strong>Stampbench</strong><span>hello@stampbench.com</span></div><em className="saved-note">↶ client details saved</em><div className="invoice-lines"><i/><i/><i/></div><div className="preview-total"><small>TOTAL</small><strong>£1,240</strong></div><footer><span className={progress<2?'active':''}>Draft</span>→<span className={progress===2?'active':''}>Sent</span>→<span className={progress===3?'active':''}>Paid</span></footer>{checks.length&&<div className="compliance-seal">✓<small>EN 16931<br/>CHECKED</small></div>}</article>{progress===3&&<b className="ready-ticket">READY</b>}</div>
    </aside>
  </div>;
}
