'use client'; // This is crucial for a client component

import { useEffect } from 'react';
import LogRocket from 'logrocket';

export function LogRocketInit() {
  useEffect(() => {
    LogRocket.init('ztaqym/stackisp');
  }, []); 

  return null;
}