import React,{lazy,Suspense,useEffect,useRef,useState} from 'react';
import Fallback from './SolarScene.native';
import type {SceneProps} from './SolarScene.types';
const World=lazy(()=>import('./SolarWorld.web'));
export default function SolarScene(props:SceneProps){
  const root=useRef<HTMLDivElement>(null);const [active,setActive]=useState(true);
  useEffect(()=>{if(!root.current||typeof IntersectionObserver==='undefined')return;const observer=new IntersectionObserver(([entry])=>setActive(entry?.isIntersecting??false),{threshold:.05});observer.observe(root.current);return()=>observer.disconnect();},[]);
  return <div ref={root} style={{display:'flex',flex:1,minHeight:300,width:'100%'}}><Suspense fallback={<Fallback {...props}/>}><World {...props} active={active}/></Suspense></div>;
}
