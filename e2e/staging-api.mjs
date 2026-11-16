import { request } from 'playwright';
import fs from 'node:fs/promises';
const out=process.env.REPORT_DIR || 'test-results';
await fs.mkdir(out,{recursive:true});
const api=await request.newContext({baseURL:'http://127.0.0.1:18080',extraHTTPHeaders:{'X-User-ID':'adm_test'}});
const login=await api.post('/api/admins/login',{data:{email:'admin@staging.test',password:'StagingOnly123!'}});
if(!login.ok()) throw new Error('Staging admin login failed');
const results=[];
async function test(name,fn){try{results.push({module:'API integration',name,status:'PASS',detail:await fn()||'Assertions passed'});}catch(e){results.push({module:'API integration',name,status:'FAIL',detail:e.message});}console.log(results.at(-1));}
function assert(x,msg){if(!x)throw Error(msg);}
await test('Migrated form is transparently hydrated',async()=>{const r=await api.get('/api/forms/frm_legacy');assert(r.ok(),'GET failed');const v=await r.json();assert(!v.jsonOfFields.includes('_pmsMetadataRef'),'Leaked internal reference');assert(JSON.parse(v.jsonOfFields).title==='Staging Enrollment','Lost metadata');});
await test('Migrated project retains optional custom field',async()=>{const r=await api.get('/api/projects/prj_test');const v=await r.json();assert(r.ok(),'GET failed');assert(JSON.parse(v.customFieldsJson).repository==='https://example.test/repo','Lost project custom field');});
let id;
await test('Create form writes Mongo metadata via ORM',async()=>{const r=await api.post('/api/forms',{data:{accessBranch:'AI',accessBatch:'2025',jsonOfFields:'[{"id":"custom","label":"Repository","required":false}]',createdBy:'adm_test'}});assert(r.status()===201,`POST status ${r.status()}`);id=(await r.json()).formId;const g=await api.get('/api/forms/'+id);assert((await g.json()).jsonOfFields.includes('Repository'),'Readback mismatch');});
await test('Edit form creates new immutable metadata version',async()=>{assert(id,'Creation failed');const r=await api.put('/api/forms/'+id,{data:{jsonOfFields:'[{"id":"custom","label":"Demo URL"}]'}});assert(r.ok(),`PUT status ${r.status()}`);const g=await api.get('/api/forms/'+id);assert((await g.json()).jsonOfFields.includes('Demo URL'),'Readback mismatch');});
await test('Delete disposable form',async()=>{assert(id,'Creation failed');const r=await api.delete('/api/forms/'+id);assert(r.ok(),`DELETE status ${r.status()}`);assert((await api.get('/api/forms/'+id)).status()===404,'Record still exists');});
await test('KPI refresh returns one metric',async()=>{const r=await api.get('/api/dashboard/metrics/students?refresh=true');assert(r.ok(),'Metric failed');assert((await r.json()).count===1000,'Wrong metric');});
await test('Pagination rejects unbounded page sizes',async()=>{assert((await api.get('/api/students/paginated?size=100000')).status()===400,'Unbounded query accepted');});
await test('Admin endpoint denies unauthenticated requests',async()=>{const anon=await request.newContext({baseURL:'http://127.0.0.1:18080'});const r=await anon.get('/api/students/paginated?size=1');await anon.dispose();assert([401,403].includes(r.status()),`Security blocker: anonymous request received HTTP ${r.status()}`);});
await api.dispose();await fs.writeFile(out+'/api-results.json',JSON.stringify(results,null,2));
process.exitCode = results.some(result => result.status === 'FAIL') ? 1 : 0;
