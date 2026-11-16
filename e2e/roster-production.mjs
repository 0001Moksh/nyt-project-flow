import {chromium,request} from 'playwright';
import fs from 'node:fs/promises';
if (!process.env.ROSTER_JSON) throw Error('Set ROSTER_JSON to the private extracted roster');
const fixture=JSON.parse(await fs.readFile(process.env.ROSTER_JSON,'utf8'));
const results=[];
const root=process.env.REPORT_DIR || 'test-results/roster';
await fs.mkdir(root,{recursive:true});
async function test(name,fn){try{await fn();results.push({name,status:'PASS'});}catch(e){results.push({name,status:'FAIL',error:e.message.slice(0,400)});}console.log(results.at(-1));await fs.writeFile(root+'/results.json',JSON.stringify(results,null,2));}
function assert(ok,message){if(!ok)throw Error(message);}
const api=await request.newContext({baseURL:'http://127.0.0.1:5173'});
await test('Anonymous list denied through production proxy',async()=>assert((await api.get('/api/students/paginated')).status()===401,'Expected 401'));
await test('Admin login through proxy',async()=>assert((await api.post('/api/admins/login',{data:{email:'admin@roster.test',password:'RosterOnly123!'}})).ok(),'Login failed'));
await test('58 valid students; pagination and private cache header',async()=>{const r=await api.get('/api/students/paginated?size=100');const d=await r.json();assert(d.totalElements===58,'Wrong student count');assert(r.headers()['cache-control'].includes('no-store'),'CDN caching enabled');});
for(const g of fixture.groups.filter(x=>x.seeded))await test('Group '+g.group+' membership/project/supervisor mapping',async()=>{
 const t=await (await api.get('/api/teams/roster_team_'+g.group)).json();
 const p=await (await api.get('/api/projects/roster_project_'+g.group)).json();
 assert(JSON.stringify(JSON.parse(t.teamMemberArray))===JSON.stringify(g.members.map(m=>'roster_'+m.roll)),'Wrong members');
 assert(p.teamId===t.teamId,'Wrong project team');
 if(g.title)assert(p.projectTitle===g.title,'Wrong project title');
 if(g.supervisors.length===1){const s=await (await api.get('/api/supervisors/'+p.supervisorId)).json();assert(s.name===g.supervisors[0],'Wrong supervisor');}
 else assert(!p.supervisorId,'Ambiguous supervisor silently assigned');
});
for(const g of fixture.groups.filter(x=>x.seeded))for(const m of g.members)await test('Student login group '+g.group+' '+m.roll,async()=>{
 const c=await request.newContext({baseURL:'http://127.0.0.1:5173'});
 try{const r=await c.post('/api/student/login',{data:{email:m.roll.toLowerCase()+'@roster.test',password:'RosterOnly123!'}});assert(r.ok(),'Login failed');assert((await r.json()).name===m.name,'Identity mismatch');assert((await c.get('/api/students/paginated')).status()===403,'Admin access allowed');}finally{await c.dispose();}
});
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {})});
async function login(page,email,route){await page.goto('http://127.0.0.1:5173/login');await page.locator('input[type=email]').fill(email);await page.locator('input[type=password]').fill('RosterOnly123!');await page.getByRole('button',{name:'Sign In',exact:true}).click();await page.waitForURL('**'+route);}
async function route(page,url,text){const errors=[];const error=e=>errors.push(e.message);const response=r=>{if(r.url().includes('/api/')&&r.status()>=400)errors.push(r.status()+' '+new URL(r.url()).pathname)};page.on('pageerror',error);page.on('response',response);try{await page.goto('http://127.0.0.1:5173'+url);await page.waitForLoadState('networkidle');assert(new URL(page.url()).pathname===url,'Unexpected redirect');if(text)assert((await page.locator('body').innerText()).includes(text),'Expected record missing');assert(!errors.length,errors.join('; '));}finally{page.off('pageerror',error);page.off('response',response);}}
const c=await browser.newContext();const page=await c.newPage();page.setDefaultTimeout(10000);
await test('Browser admin login with same-origin session',()=>login(page,'admin@roster.test','/admin/dashboard'));
for(const url of ['/admin/students','/admin/supervisors','/admin/projects','/admin/create-form','/admin/form-details/roster_form'])await test('Production route '+url,()=>route(page,url));
for(const g of fixture.groups.filter(x=>x.seeded))await test('Browser project detail group '+g.group,()=>route(page,'/admin/projects/roster_project_'+g.group,g.title||'TEST ONLY'));
await page.screenshot({path:root+'/admin-project.png',fullPage:true});await c.close();
for(let i=0;i<fixture.supervisors.length;i++){
 const c=await browser.newContext(),p=await c.newPage();p.setDefaultTimeout(10000);
 await test('Supervisor '+i+' login and project list',async()=>{await login(p,'supervisor'+i+'@roster.test','/supervisor/dashboard');await route(p,'/supervisor/projects');});await c.close();
}
for(const g of fixture.groups.filter(x=>x.seeded)){
 const c=await browser.newContext(),p=await c.newPage();p.setDefaultTimeout(10000);
 await test('Leader group '+g.group+' browser project view',async()=>{await login(p,g.members[0].roll.toLowerCase()+'@roster.test','/dashboard');await route(p,'/projects',g.title||'TEST ONLY');});await c.close();
}
await browser.close();await api.dispose();console.log({total:results.length,fail:results.filter(x=>x.status==='FAIL').length});
process.exitCode=results.some(x=>x.status==='FAIL')?1:0;

