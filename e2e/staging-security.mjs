import {request} from 'playwright';
import fs from 'node:fs/promises';
const baseURL='http://127.0.0.1:18080';
const results=[];
async function check(name,response,expected){const actual=response.status();results.push({name,expected,actual,pass:actual===expected});}
const anon=await request.newContext({baseURL});
await check('Anonymous paginated list',await anon.get('/api/students/paginated?size=1'),401);
await check('Anonymous full list',await anon.get('/api/students'),401);
await check('Forged user header',await anon.get('/api/students/paginated',{headers:{'X-User-ID':'adm_test'}}),401);
await check('Forged cookie',await anon.get('/api/students/paginated',{headers:{Cookie:'JSESSIONID=forged'}}),401);
await check('Incorrect password',await anon.post('/api/admins/login',{data:{email:'admin@staging.test',password:'wrong'}}),400);
await check('Failed login gives no access',await anon.get('/api/students/paginated'),401);
for(const [role,path,email] of [['ADMIN','admins','admin'],['STUDENT','student','student1'],['SUPERVISOR','supervisor','supervisor']]){
 const ctx=await request.newContext({baseURL});
 await check(role+' login',await ctx.post('/api/'+path+'/login',{data:{email:email+'@staging.test',password:'StagingOnly123!'}}),200);
 await check(role+' directory',await ctx.get('/api/students?excludeEnrolled=true'),200);
 await check(role+' admin list',await ctx.get('/api/students/paginated?size=1'),role==='ADMIN'?200:403);
 await check(role+' logout',await ctx.post('/api/session/logout'),204);
 await check(role+' after logout',await ctx.get('/api/students'),401);
 await ctx.dispose();
}
await anon.dispose();
const out=process.env.REPORT_DIR || 'test-results';
await fs.mkdir(out,{recursive:true});
await fs.writeFile(out+'/security-retest.json',JSON.stringify(results,null,2));
console.log(results);process.exitCode=results.every(x=>x.pass)?0:1;

