'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PoliciesRootPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/policies/privacy');
  }, [router]);

  return (
    <div className="flex h-96 items-center justify-center bg-slate-50">
      <div className="loader" />
    </div>
  );
}
