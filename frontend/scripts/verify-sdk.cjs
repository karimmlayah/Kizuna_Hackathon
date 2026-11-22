const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const stage=process.argv[2];
if(!/^sdk(56|57|58)$/.test(stage||''))throw new Error('Usage: node scripts/verify-sdk.cjs sdk56|sdk57|sdk58');
const root=path.resolve(__dirname,'..');
const output=path.join(root,'verification',stage);
fs.mkdirSync(output,{recursive:true});
const manifest=require(path.join(root,'package.json'));
const installed=Object.fromEntries(Object.keys({...manifest.dependencies,...manifest.devDependencies}).map(name=>{
  const p=path.join(root,'node_modules',name,'package.json');
  return [name,JSON.parse(fs.readFileSync(p,'utf8')).version];
}));
fs.writeFileSync(path.join(output,'versions.json'),JSON.stringify(installed,null,2)+'\n');
const checks=[['typescript','npm run typecheck'],['tests','npm test'],['expo-versions','npx expo install --check'],['expo-doctor','npx expo-doctor'],['native-exports',`npx expo export --platform ios --platform android --output-dir verification/exports/${stage}`]];
const results=[];
for(const [name,command] of checks){
  console.log(`[${stage}] ${name}: ${command}`);
  const result=spawnSync(command,{cwd:root,shell:true,encoding:'utf8',env:{...process.env,CI:'1'},maxBuffer:30*1024*1024});
  fs.writeFileSync(path.join(output,`${name}.log`),(result.stdout||'')+(result.stderr||''));
  results.push({name,command,exitCode:result.status,error:result.error?.message});
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2)+'\n');
  console.log((result.stdout||'').slice(-1800));
  if(result.status!==0){
    const knownSdk56Regression=stage==='sdk56'&&name==='expo-doctor'&&result.stdout.includes('21/22 checks passed')&&result.stdout.includes('affected by a known memory regression');
    if(knownSdk56Regression){
      results[results.length-1].knownIssue='SDK 56 Hermes V1 regression; upgrading to SDK 57 is the official fix.';
      fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2)+'\n');
      console.log('Recording the known SDK 56 Hermes regression; continuing exports before SDK 57.');
    }else{console.error((result.stderr||'').slice(-4000));process.exit(result.status||1);}
  }
}
fs.copyFileSync(path.join(root,'package.json'),path.join(output,'package.snapshot.json'));
fs.copyFileSync(path.join(root,'package-lock.json'),path.join(output,'package-lock.snapshot.json'));
console.log(`[${stage}] Checks completed. See results.json for exact outcomes.`);
