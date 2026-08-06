import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SignupForm } from './signup-form';

export const metadata: Metadata = {
  title: 'Create account',
  robots: { index: false },
};

export default function SignupPage() {
  return (
    // The form reads ?plan= via useSearchParams, which static export requires
    // to sit inside a Suspense boundary.
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
