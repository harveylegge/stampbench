import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SigninForm } from './signin-form';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false },
};

export default function SigninPage() {
  return (
    // The form reads ?next= via useSearchParams, which static export requires
    // to sit inside a Suspense boundary.
    <Suspense>
      <SigninForm />
    </Suspense>
  );
}
