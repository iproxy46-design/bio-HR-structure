import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import ts from 'typescript';
const root=new URL('../',import.meta.url);
const files=['scripts/migrate-postgres.ts','lib/postgres.ts','lib/org-store.ts','lib/org.ts','lib/role-title.ts'];
for(const file of files){
 const source=await readFile(new URL(file,root),'utf8');
 const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText
  .replace(/(from\s+['"])(\.{1,2}\/[^'"]+)(['"])/g,(match,prefix,path,suffix)=>path.endsWith('.mjs')?match:`${prefix}${path}.mjs${suffix}`);
 const target=new URL('.migration/'+file.replace(/\.ts$/,'.mjs'),root);
 await mkdir(new URL('./',target),{recursive:true});
 await writeFile(target,output);
}
await copyFile(new URL('scripts/database-init.mjs',root),new URL('.migration/scripts/database-init.mjs',root));
await mkdir(new URL('.migration/db/',root),{recursive:true});
await copyFile(new URL('db/postgres.sql',root),new URL('.migration/db/postgres.sql',root));
