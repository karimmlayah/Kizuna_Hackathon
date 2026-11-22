const os = require('node:os');
const path = require('node:path');
const {spawn} = require('node:child_process');
const args=process.argv.slice(2);
const tunnel=args.includes('--tunnel');
const env={...process.env};
let selectedInterface = null;
if(!tunnel&&!env.REACT_NATIVE_PACKAGER_HOSTNAME){
  const candidates=Object.entries(os.networkInterfaces()).flatMap(([name,entries])=>
    entries.filter(item=>item.family==='IPv4'&&!item.internal&&!item.address.startsWith('169.254.')&&!/vmware|vmnet|vethernet|virtual|wsl|docker|loopback|tailscale|vpn|tap|tun/i.test(name))
      .map(item=>({name,address:item.address,rank:/wi-?fi|wireless|wlan/i.test(name)?0:1}))
  ).sort((a,b)=>a.rank-b.rank);
  if(candidates[0]){
    selectedInterface = candidates[0].name;
    env.REACT_NATIVE_PACKAGER_HOSTNAME=candidates[0].address;
  }
}
console.log('==================================================');
console.log('Smart Solar — Application native dans Expo Go (SDK 58)');
console.log('==================================================');
if(!tunnel){
  console.log(`Interface Wi-Fi détectée : ${selectedInterface || 'inconnue'}`);
  console.log(`IP locale du serveur Metro : ${env.REACT_NATIVE_PACKAGER_HOSTNAME || 'détection automatique Expo'}`);
  console.log(`URL Expo Go directe        : exp://${env.REACT_NATIVE_PACKAGER_HOSTNAME || 'localhost'}:8081`);
  console.log('Assurez-vous que votre iPhone est connecté sur le même réseau Wi-Fi.');
} else {
  console.log('Mode tunnel activé via @expo/ngrok (contourne les pare-feu et les réseaux isolés).');
}
console.log('--------------------------------------------------');
const expoRoot=path.dirname(require.resolve('expo/package.json'));
const bin=require('expo/package.json').bin;
const cli=path.resolve(expoRoot,typeof bin==='string'?bin:bin.expo);
const child=spawn(process.execPath,[cli,'start','--go',...(tunnel?[]:['--lan']),...args],{cwd:path.resolve(__dirname,'..'),env,stdio:'inherit'});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
