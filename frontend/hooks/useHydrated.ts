import {useEffect,useState} from 'react';
import {useSolarStore} from '../store/useSolarStore';
export function useHydrated(){
  const [ready,setReady]=useState(useSolarStore.persist.hasHydrated());
  useEffect(()=>{const unsubscribe=useSolarStore.persist.onFinishHydration(()=>setReady(true));if(useSolarStore.persist.hasHydrated())setReady(true);return unsubscribe;},[]);
  return ready;
}
