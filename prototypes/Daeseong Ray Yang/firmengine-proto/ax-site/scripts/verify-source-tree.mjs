/** Fail build before bundling if an unresolved Git merge marker was committed. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
const roots=["app","lib","components","db","hooks","scripts","worker","tests","drizzle","n8n-reference"];
const exts=/\.(?:ts|tsx|mts|mjs|js|json|sql)$/i;
const marker=/^(?:<<<<<<< .+|=======|>>>>>>> .+)$/m;
const failures=[];
function scan(path){
  for(const entry of readdirSync(path)){
    if(["node_modules","dist",".next",".vinext",".wrangler"].includes(entry))continue;
    const full=join(path,entry);
    if(statSync(full).isDirectory())scan(full);
    else if(exts.test(entry)&&marker.test(readFileSync(full,"utf8")))failures.push(full);
  }
}
for(const root of roots)scan(root);
if(failures.length){
  console.error("Unresolved Git merge markers detected:\n"+failures.join("\n"));
  process.exitCode=1;
}else console.log("Source tree: no unresolved merge markers.");
