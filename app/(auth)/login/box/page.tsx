import { Suspense } from 'react';
import LoginForm from '../LoginForm';

export default function BoxLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm audience="box" />
    </Suspense>
  );
}
