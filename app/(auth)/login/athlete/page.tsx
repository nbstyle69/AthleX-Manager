import { Suspense } from 'react';
import LoginForm from '../LoginForm';

export default function AthleteLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm audience="athlete" />
    </Suspense>
  );
}
